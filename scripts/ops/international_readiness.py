#!/usr/bin/env python3
"""ContentFlow international launch readiness preflight.

The script is intentionally read-only. It reports whether the local operator
environment is ready to build, deploy, and stage Postiz drafts without printing
secret values.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "ops"
HAN_RE = re.compile(r"[\u4e00-\u9fff]")
TEXT_EXTS = {".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx", ".css", ".html"}
SKIP_PARTS = {"node_modules", ".next", "coverage", "test-results", "playwright-report"}

REQUIRED_ENVS = [
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_API_KEY_BACKUP",
    "OPENROUTER_API_KEY",
    "OPENROUTER_API_KEY_BACKUP",
    "FAL_API_KEY",
    "FAL_API_KEY_BACKUP",
    "POSTIZ_BASE_URL",
    "POSTIZ_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "VULTR_API_KEY",
]

COMMANDS = ["aws", "openclaw", "docker", "gh", "vultr", "vultr-cli"]

INT_VISIBLE_SCAN_ROOTS = [
    ROOT / "apps" / "INT-Web" / "src" / "app",
    ROOT / "apps" / "INT-Web" / "src" / "components",
    ROOT / "apps" / "INT-Web" / "src" / "store",
]


def command_path(name: str) -> str | None:
    return shutil.which(name)


def run_masked(cmd: list[str], timeout: int = 12) -> dict[str, Any]:
    try:
        proc = subprocess.run(
            cmd,
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        output = (proc.stdout + proc.stderr).strip()
        output = re.sub(r"\b\d{12}\b", "<aws-account-id>", output)
        output = re.sub(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", "<ip>", output)
        return {"ok": proc.returncode == 0, "code": proc.returncode, "output": output[:4000]}
    except Exception as exc:  # pragma: no cover - defensive CLI report
        return {"ok": False, "code": None, "output": str(exc)}


def scan_han(paths: list[Path]) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    for base in paths:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if any(part in SKIP_PARTS for part in path.parts):
                continue
            if not path.is_file() or path.suffix not in TEXT_EXTS:
                continue
            hits = []
            for line_no, line in enumerate(path.read_text(errors="ignore").splitlines(), 1):
                if HAN_RE.search(line):
                    hits.append({"line": line_no, "text": line.strip()[:160]})
            if hits:
                findings.append(
                    {
                        "file": str(path.relative_to(ROOT)),
                        "count": len(hits),
                        "sample": hits[:3],
                    }
                )
    return {
        "files": len(findings),
        "hits": sum(item["count"] for item in findings),
        "findings": findings[:80],
    }


def tcp_probe(host: str, port: int, timeout: float = 3.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def main() -> int:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    env_presence = {name: bool(os.getenv(name)) for name in REQUIRED_ENVS}
    primary_backup = {
        "deepseek": {
            "primary": env_presence["DEEPSEEK_API_KEY"],
            "backup": env_presence["DEEPSEEK_API_KEY_BACKUP"],
        },
        "openrouter": {
            "primary": env_presence["OPENROUTER_API_KEY"],
            "backup": env_presence["OPENROUTER_API_KEY_BACKUP"],
        },
        "fal": {
            "primary": env_presence["FAL_API_KEY"],
            "backup": env_presence["FAL_API_KEY_BACKUP"],
        },
    }

    commands = {name: command_path(name) for name in COMMANDS}
    visible_cjk = scan_han(INT_VISIBLE_SCAN_ROOTS)

    aws_identity = run_masked(["aws", "sts", "get-caller-identity", "--output", "json"], timeout=10)
    openclaw_health = run_masked(["openclaw", "health"], timeout=15)

    postiz_hosts = ["postiz.tianji-astrology.com", "postiz.aurenix-ai.com"]
    postiz_dns = {
        host: {
            "tcp_443": tcp_probe(host, 443),
            "tcp_80": tcp_probe(host, 80),
        }
        for host in postiz_hosts
    }

    blockers = []
    if visible_cjk["hits"]:
        blockers.append("INT-Web visible source contains CJK characters.")
    for provider, status in primary_backup.items():
        if not status["primary"] or not status["backup"]:
            blockers.append(f"{provider} primary/backup environment variables are incomplete.")
    if not env_presence["POSTIZ_BASE_URL"] or not env_presence["POSTIZ_API_KEY"]:
        blockers.append("Postiz API environment variables are missing in the current shell.")
    if not env_presence["VULTR_API_KEY"] and not commands.get("vultr") and not commands.get("vultr-cli"):
        blockers.append("Vultr API/CLI access is not available locally.")
    if not aws_identity["ok"]:
        blockers.append("AWS CLI identity check failed.")
    if not openclaw_health["ok"]:
        blockers.append("OpenClaw health check failed.")

    report = {
        "generated_at": now,
        "scope": "ContentFlow international + EnergyIQ international operations readiness",
        "env_presence": env_presence,
        "primary_backup": primary_backup,
        "commands": commands,
        "int_visible_cjk": visible_cjk,
        "aws_identity_masked": aws_identity,
        "openclaw_health_masked": openclaw_health,
        "postiz_dns_tcp": postiz_dns,
        "blockers": blockers,
        "decision": "go_for_local_build_and_draft_queue" if not visible_cjk["hits"] else "fix_language_before_launch",
    }

    out = ARTIFACT_DIR / "international-readiness-2026-07-23.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps({"artifact": str(out), "blockers": blockers}, indent=2, ensure_ascii=False))
    return 1 if blockers else 0


if __name__ == "__main__":
    raise SystemExit(main())