#!/usr/bin/env python3
"""Validate that tracked app manifests and production CI fail closed."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

for manifest in sorted(ROOT.rglob("package.json")):
    if "node_modules" in manifest.parts:
        continue
    try:
        json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"{manifest.relative_to(ROOT)}: invalid package manifest: {exc}")

ci_source = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
for forbidden in ("--passWithNoTests", "continue-on-error: true"):
    if forbidden in ci_source:
        errors.append(f".github/workflows/ci.yml: forbidden false-green option {forbidden}")

for relative in (
    "runtime/api/package.json",
    "runtime/web-cn/package.json",
    "runtime/web-int/package.json",
):
    manifest = json.loads((ROOT / relative).read_text(encoding="utf-8"))
    test_script = manifest.get("scripts", {}).get("test", "")
    if not test_script or "passWithNoTests" in test_script:
        errors.append(f"{relative}: production runtime needs a fail-closed test command")

if errors:
    raise SystemExit("CI/repository integrity gate failed:\n- " + "\n- ".join(errors))

print("CI/repository integrity gate passed: manifests valid and runtime tests fail closed")
