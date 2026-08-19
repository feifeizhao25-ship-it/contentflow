#!/usr/bin/env python3
"""Create a redacted credential inventory for launch readiness.

The scanner is read-only and never writes plaintext secret values to stdout or
artifacts. It records file location, detected kind, and a short fingerprint so
operators can rotate or migrate secrets without exposing them in reports.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "artifacts" / "ops"

TEXT_EXTS = {
    ".env",
    ".example",
    ".ini",
    ".json",
    ".js",
    ".jsx",
    ".md",
    ".mjs",
    ".properties",
    ".py",
    ".sh",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
SKIP_PARTS = {
    ".git",
    ".gradle",
    ".next",
    ".venv",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "Pods",
}

ASSIGNMENT_RE = re.compile(
    r"(?i)\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASS|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|AUTH[_-]?TOKEN)[A-Z0-9_]*)\b"
    r"\s*[:=]\s*[\"']?([^\"'\s,;]+)"
)
PREFIX_PATTERNS = [
    ("openrouter_or_openai_style_key", re.compile(r"\bsk-or-v1-[A-Za-z0-9_-]{24,}\b")),
    ("sk_style_key", re.compile(r"\bsk-[A-Za-z0-9_-]{24,}\b")),
    ("aws_access_key_id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    (
        "fal_style_key",
        re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{24,}\b", re.I),
    ),
]


def is_text_candidate(path: Path) -> bool:
    if any(part in SKIP_PARTS for part in path.parts):
        return False
    if path.name.startswith(".env"):
        return True
    if path.suffix in TEXT_EXTS:
        return True
    return False


def looks_like_placeholder(value: str) -> bool:
    lowered = value.strip().strip("\"'").lower()
    if not lowered or len(lowered) < 8:
        return True
    placeholder_tokens = [
        "example",
        "placeholder",
        "replace",
        "dummy",
        "your_",
        "your-",
        "changeme",
        "test",
        "xxxx",
        "<",
    ]
    return any(token in lowered for token in placeholder_tokens)


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()[:12]


def classify_key(name: str) -> str:
    upper = name.upper()
    if "OPENROUTER" in upper:
        return "openrouter"
    if "DEEPSEEK" in upper:
        return "deepseek"
    if "FAL" in upper:
        return "fal"
    if "AWS" in upper:
        return "aws"
    if "VULTR" in upper:
        return "vultr"
    if "POSTIZ" in upper:
        return "postiz"
    if "PASSWORD" in upper or upper.endswith("PASS"):
        return "password"
    if "SECRET" in upper:
        return "secret"
    if "TOKEN" in upper:
        return "token"
    return "credential"


def iter_files() -> Iterable[Path]:
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_PARTS]
        for name in files:
            path = Path(base) / name
            if is_text_candidate(path) and path.stat().st_size <= 2_000_000:
                yield path


def scan_file(path: Path) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    text = path.read_text(errors="ignore")
    seen: set[tuple[int, str, str]] = set()

    for line_no, line in enumerate(text.splitlines(), 1):
        for match in ASSIGNMENT_RE.finditer(line):
            key_name, value = match.group(1), match.group(2)
            if looks_like_placeholder(value):
                continue
            item_key = (line_no, key_name, fingerprint(value))
            if item_key in seen:
                continue
            seen.add(item_key)
            findings.append(
                {
                    "file": str(path.relative_to(ROOT)),
                    "line": line_no,
                    "kind": classify_key(key_name),
                    "name": key_name,
                    "fingerprint": fingerprint(value),
                    "status": "plaintext_candidate",
                }
            )

        for kind, pattern in PREFIX_PATTERNS:
            for match in pattern.finditer(line):
                value = match.group(0)
                if looks_like_placeholder(value):
                    continue
                item_key = (line_no, kind, fingerprint(value))
                if item_key in seen:
                    continue
                seen.add(item_key)
                findings.append(
                    {
                        "file": str(path.relative_to(ROOT)),
                        "line": line_no,
                        "kind": kind,
                        "name": kind,
                        "fingerprint": fingerprint(value),
                        "status": "plaintext_candidate",
                    }
                )
    return findings


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    findings: list[dict[str, object]] = []
    for path in iter_files():
        findings.extend(scan_file(path))

    findings.sort(key=lambda item: (str(item["file"]), int(item["line"]), str(item["kind"])))
    grouped: dict[str, int] = {}
    for item in findings:
        grouped[str(item["kind"])] = grouped.get(str(item["kind"]), 0) + 1

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "policy": "redacted-only; no plaintext secret values are written",
        "total_plaintext_candidates": len(findings),
        "by_kind": grouped,
        "findings": findings,
        "required_action": [
            "Rotate any credential pasted into chat or found in plaintext.",
            "Move production secrets to AWS Secrets Manager, SSM, CI secrets, or encrypted local keychain.",
            "Keep primary and backup keys for OpenRouter and Fal before international launch.",
            "Keep DeepSeek scoped to the domestic product unless a shared backend explicitly needs it.",
        ],
    }

    json_path = OUT_DIR / "credential-inventory-redacted-2026-07-23.json"
    md_path = OUT_DIR / "credential-inventory-redacted-2026-07-23.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))

    lines = [
        "# Redacted Credential Inventory - 2026-07-23",
        "",
        "Plaintext secret values are intentionally omitted.",
        "",
        f"- Total plaintext candidates: {len(findings)}",
    ]
    for kind, count in sorted(grouped.items()):
        lines.append(f"- {kind}: {count}")
    lines.extend(["", "## Findings", ""])
    for item in findings[:200]:
        lines.append(
            f"- `{item['file']}:{item['line']}` `{item['kind']}` `{item['name']}` fingerprint `{item['fingerprint']}`"
        )
    if len(findings) > 200:
        lines.append(f"- Additional findings omitted from Markdown: {len(findings) - 200}; see JSON artifact.")
    lines.extend(["", "## Required Action", ""])
    for action in report["required_action"]:
        lines.append(f"- {action}")
    md_path.write_text("\n".join(lines) + "\n")

    print(json.dumps({"json": str(json_path), "markdown": str(md_path), "candidates": len(findings)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())