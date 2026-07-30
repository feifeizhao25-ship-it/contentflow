#!/usr/bin/env bash
# Verify the two web and four Flutter client surfaces with one command.
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
      npm ci &&
      npx tsc --noEmit &&
      npm run lint &&
      npm run build
  )
}

verify_flutter_app() {
  local app_dir="$1"
  (
    cd "$ROOT/$app_dir" &&
      flutter pub get &&
      flutter analyze --no-pub &&
      flutter test --no-pub
  )
}

verify_android_debug() {
  local app_dir="$1"
  if [ ! -x "$JAVA17_HOME/bin/java" ]; then
    printf "JDK 17 not found at %s\n" "$JAVA17_HOME"
    return 1
  fi

  (
    cd "$ROOT/$app_dir" &&
      export JAVA_HOME="$JAVA17_HOME" &&
      export PATH="$JAVA_HOME/bin:$PATH" &&
      flutter build apk --debug --no-pub
  )
}

verify_ios_debug() {
  local app_dir="$1"
  if ! xcodebuild -version >/dev/null 2>&1; then
    return 2
  fi

  (
    cd "$ROOT/$app_dir" &&
      flutter build ios --simulator --debug --no-pub
  )
}

step "Environment"
df -h "$ROOT"
if [ -x "$JAVA17_HOME/bin/java" ]; then
  "$JAVA17_HOME/bin/java" -version
else
  printf "JDK 17 missing: %s\n" "$JAVA17_HOME"
fi

run_step "CN-Web typecheck/lint/build" verify_web_app "runtime/web-cn"
run_step "INT-Web typecheck/lint/build" verify_web_app "runtime/web-int"
for app in android-cn android-global ios-cn ios-global; do
  run_step "$app analyze/test" verify_flutter_app "$app"
done
run_step "Android CN debug build" verify_android_debug "android-cn"
run_step "Android global debug build" verify_android_debug "android-global"

for app in ios-cn ios-global; do
  step "$app simulator build"
  verify_ios_debug "$app"
  ios_status=$?
  if [ "$ios_status" -eq 0 ]; then
    PASSED+=("$app simulator build")
  elif [ "$ios_status" -eq 2 ] && [ "${REQUIRE_IOS:-0}" != "1" ]; then
    printf "SKIP: xcodebuild needs a full Xcode install/selection. Set REQUIRE_IOS=1 to fail here.\n"
    SKIPPED+=("$app simulator build: full Xcode not selected")
  else
    FAILED+=("$app simulator build")
  fi
done

step "Summary"
printf "Passed: %s\n" "${#PASSED[@]}"
if [ "${#PASSED[@]}" -gt 0 ]; then
  for item in "${PASSED[@]}"; do printf "  OK  %s\n" "$item"; done
fi

printf "Skipped: %s\n" "${#SKIPPED[@]}"
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  for item in "${SKIPPED[@]}"; do printf "  SKIP %s\n" "$item"; done
fi

printf "Failed: %s\n" "${#FAILED[@]}"
if [ "${#FAILED[@]}" -gt 0 ]; then
  for item in "${FAILED[@]}"; do printf "  FAIL %s\n" "$item"; done
fi

[ "${#FAILED[@]}" -eq 0 ]
