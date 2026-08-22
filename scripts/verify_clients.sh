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
      ensure_node_dependencies &&
      npx tsc --noEmit &&
      npm run build
  )
}

ensure_node_dependencies() {
  if [ ! -x node_modules/.bin/tsc ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm ci
  fi
}

verify_cn_web() {
  verify_web_app "runtime/web-cn" &&
    (cd "$ROOT/runtime/web-cn" && npm run check:contract)
}

verify_api() {
  (
    cd "$ROOT/runtime/api" &&
      ensure_node_dependencies &&
      npm run build &&
      npm run test -- --runInBand
  )
}

verify_flutter_edition() {
  local edition="$1"
  (
    cd "$ROOT/$edition" &&
      flutter pub get &&
      flutter analyze --no-fatal-infos --no-fatal-warnings &&
      flutter test
  )
}

build_flutter_release() {
  local edition="$1"
  case "$edition" in
    android-*) (cd "$ROOT/$edition" && flutter build appbundle --release) ;;
    ios-*) (cd "$ROOT/$edition" && flutter build ios --release --no-codesign) ;;
  esac
}

step "Environment"
df -h "$ROOT"
if [ -x "$JAVA17_HOME/bin/java" ]; then
  "$JAVA17_HOME/bin/java" -version
else
  printf "JDK 17 missing: %s\n" "$JAVA17_HOME"
fi

run_step "Production API build/test" verify_api
run_step "CN-Web typecheck/build/API-contract" verify_cn_web
run_step "INT-Web typecheck/build" verify_web_app "runtime/web-int"
run_step "CN/INT language contract" python3 "$ROOT/scripts/verify_language_contracts.py"
run_step "RAG source/freshness contract" python3 "$ROOT/scripts/validate_rag_freshness.py" --allow-empty

for edition in android-cn ios-cn android-global ios-global; do
  run_step "$edition analyze/test" verify_flutter_edition "$edition"
done

if [ "${REQUIRE_RELEASE_BUILDS:-0}" = "1" ]; then
  for edition in android-cn ios-cn android-global ios-global; do
    run_step "$edition release build" build_flutter_release "$edition"
  done
else
  skip_step "Four mobile release artifacts" "set REQUIRE_RELEASE_BUILDS=1 on release runners with Android SDK and Xcode"
fi

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
