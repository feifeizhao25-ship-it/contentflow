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
    "OPENROUTER_API_KEY",
    "OPENROUTER_API_KEY_BACKUP",
    "FAL_API_KEY",
    "FAL_API_KEY_BACKUP",
]
LIVE_ONLY_ENVS = ["POSTIZ_BASE_URL", "POSTIZ_API_KEY"]

COMMANDS = ["aws", "openclaw", "docker", "gh", "vultr", "vultr-cli"]

INT_VISIBLE_SCAN_ROOTS = [
    ROOT / "runtime" / "web-int" / "app",
    ROOT / "runtime" / "web-int" / "components",
    ROOT / "runtime" / "web-int" / "lib",
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

    live = os.getenv("CONTENTFLOW_LIVE_PREFLIGHT") == "1"
    env_names = REQUIRED_ENVS + LIVE_ONLY_ENVS
    env_presence = {name: bool(os.getenv(name)) for name in env_names}

    commands = {name: command_path(name) for name in COMMANDS}
    visible_cjk = scan_han(INT_VISIBLE_SCAN_ROOTS)

    not_checked = {"ok": None, "code": None, "output": "not checked in static mode"}
    aws_identity = (
        run_masked(["aws", "sts", "get-caller-identity", "--output", "json"], timeout=10)
        if live
        else not_checked
    )
    openclaw_health = (
        run_masked(["openclaw", "health"], timeout=15) if live else not_checked
    )

    postiz_hosts = []
    postiz_base = os.getenv("POSTIZ_BASE_URL", "")
    if live and postiz_base:
        from urllib.parse import urlparse
        host = urlparse(postiz_base).hostname
        if host:
            postiz_hosts.append(host)
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
    if live:
        for name in REQUIRED_ENVS + LIVE_ONLY_ENVS:
            if not env_presence[name]:
                blockers.append(f"{name} is missing in the current shell.")
        if not aws_identity["ok"]:
            blockers.append("AWS CLI identity check failed.")
        if not openclaw_health["ok"]:
            blockers.append("OpenClaw health check failed.")

    report = {
        "generated_at": now,
        "scope": "ContentFlow Global operations readiness",
        "mode": "live" if live else "static",
        "env_presence": env_presence,
        "commands": commands,
        "int_visible_cjk": visible_cjk,
        "aws_identity_masked": aws_identity,
        "openclaw_health_masked": openclaw_health,
        "postiz_dns_tcp": postiz_dns,
        "blockers": blockers,
        "decision": "ready" if not blockers else "blocked",
    }

    out = ARTIFACT_DIR / "international-readiness.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps({"artifact": str(out), "blockers": blockers}, indent=2, ensure_ascii=False))
    return 1 if blockers else 0


if __name__ == "__main__":
    raise SystemExit(main())
