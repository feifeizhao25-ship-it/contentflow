#!/usr/bin/env python3
"""Fail CI when mobile release builds contain unsafe production defaults."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def check(path: str, required: tuple[str, ...], forbidden: tuple[str, ...]) -> None:
    target = ROOT / path
    if not target.is_file():
        errors.append(f"{path}: missing")
        return
    content = target.read_text(encoding="utf-8")
    for text in required:
        if text not in content:
            errors.append(f"{path}: missing guard {text!r}")
    for text in forbidden:
        if text in content:
            errors.append(f"{path}: forbidden release value {text!r}")


for market in ("cn", "global"):
    check(
        f"android-{market}/android/app/build.gradle.kts",
        (
            "Release keystore is required",
            'System.getenv("ALLOW_DEBUG_RELEASE_SIGNING") == "true"',
        ),
        ("signingConfig = signingConfigs.getByName(\"debug\")",),
    )

for platform in ("android", "ios"):
    for market, config_file in (
        ("cn", "cn_config.dart"),
        ("global", "global_config.dart"),
    ):
        check(
            f"{platform}-{market}/lib/config/{config_file}",
            (
                "String.fromEnvironment('API_BASE_URL')",
                "API_BASE_URL must be an explicit HTTPS URL",
                "uri.scheme != 'https'",
            ),
            (
                "defaultValue:",
                "api.fenfa.cn",
                "api.fenfa.ai",
                "http://",
                "localhost",
                "127.0.0.1",
            ),
        )

if errors:
    print("Mobile release gate failed:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("Mobile release gate passed")
