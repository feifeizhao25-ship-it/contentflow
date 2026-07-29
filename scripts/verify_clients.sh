#!/usr/bin/env bash
# Verify the web and mobile client surfaces with one command.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAVA17_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"

PASSED=()
FAILED=()
SKIPPED=()

step() {
  printf "\n==== %s ====\n" "$1"
}

run_step() {
  local name="$1"
  shift
  step "$name"
  if "$@"; then
    PASSED+=("$name")
  else
    FAILED+=("$name")
  fi
}

skip_step() {
  local name="$1"
  local reason="$2"
  step "$name"
  printf "SKIP: %s\n" "$reason"
  SKIPPED+=("$name: $reason")
}

verify_web_app() {
  local app_dir="$1"
  (
    cd "$ROOT/$app_dir" &&
      npx tsc --noEmit &&
      npm run lint &&
      npm run build
  )
}

verify_mobile_js() {
  (
    cd "$ROOT/apps/Mobile" &&
      node scripts/patch-react-native-gradle-plugin.js &&
      npx tsc --noEmit &&
      npm run test -- --runInBand &&
      npm run lint
  )
}

verify_android_debug() {
  if [ ! -x "$JAVA17_HOME/bin/java" ]; then
    printf "JDK 17 not found at %s\n" "$JAVA17_HOME"
    return 1
  fi

  (
    cd "$ROOT/apps/Mobile/android" &&
      export JAVA_HOME="$JAVA17_HOME" &&
      export PATH="$JAVA_HOME/bin:$PATH" &&
      ./gradlew assembleDebug --no-daemon
  )
}

verify_ios_debug() {
  if ! xcodebuild -version >/dev/null 2>&1; then
    return 2
  fi

  (
    cd "$ROOT/apps/Mobile/ios" &&
      if [ -d mobile.xcworkspace ]; then
        xcodebuild \
          -workspace mobile.xcworkspace \
          -scheme mobile \
          -configuration Debug \
          -sdk iphonesimulator \
          -destination 'generic/platform=iOS Simulator' \
          CODE_SIGNING_ALLOWED=NO \
          build
      else
        xcodebuild \
          -project mobile.xcodeproj \
          -scheme mobile \
          -configuration Debug \
          -sdk iphonesimulator \
          -destination 'generic/platform=iOS Simulator' \
          CODE_SIGNING_ALLOWED=NO \
          build
      fi
  )
}

step "Environment"
df -h "$ROOT"
if [ -x "$JAVA17_HOME/bin/java" ]; then
  "$JAVA17_HOME/bin/java" -version
else
  printf "JDK 17 missing: %s\n" "$JAVA17_HOME"
fi

run_step "CN-Web typecheck/lint/build" verify_web_app "apps/CN-Web"
run_step "INT-Web typecheck/lint/build" verify_web_app "apps/INT-Web"
run_step "Mobile JS typecheck/test/lint" verify_mobile_js
run_step "Mobile Android debug build" verify_android_debug

step "Mobile iOS debug build"
verify_ios_debug
ios_status=$?
if [ "$ios_status" -eq 0 ]; then
  PASSED+=("Mobile iOS debug build")
elif [ "$ios_status" -eq 2 ] && [ "${REQUIRE_IOS:-0}" != "1" ]; then
  printf "SKIP: xcodebuild needs a full Xcode install/selection. Set REQUIRE_IOS=1 to fail here.\n"
  SKIPPED+=("Mobile iOS debug build: full Xcode not selected")
else
  FAILED+=("Mobile iOS debug build")
fi

step "Summary"
printf "Passed: %s\n" "${#PASSED[@]}"
for item in "${PASSED[@]}"; do printf "  OK  %s\n" "$item"; done

printf "Skipped: %s\n" "${#SKIPPED[@]}"
for item in "${SKIPPED[@]}"; do printf "  SKIP %s\n" "$item"; done

printf "Failed: %s\n" "${#FAILED[@]}"
for item in "${FAILED[@]}"; do printf "  FAIL %s\n" "$item"; done

[ "${#FAILED[@]}" -eq 0 ]