#!/usr/bin/env python3
"""Render and validate the Docker Compose stack used for production."""

import json
import os
from pathlib import Path
import subprocess
import shutil
import sys


ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ROOT / "runtime" / "docker-compose.production.yml"
required_services = {"postgres", "redis", "api", "web-cn", "web-int", "gateway"}
required_contracts = {
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "CORS_ORIGIN",
    "CN_DOMAIN",
    "INT_DOMAIN",
    "TLS_EMAIL",
}

raw = COMPOSE.read_text(encoding="utf-8")
missing_contracts = sorted(
    key for key in required_contracts if ("${" + key + ":?") not in raw
)
if missing_contracts:
    raise SystemExit(
        "Production Compose gate failed: missing required contracts: "
        + ", ".join(missing_contracts)
    )

environment = os.environ.copy()
environment.update(
    {
        "IMAGE_TAG": "0123456789abcdef0123456789abcdef01234567",
        "POSTGRES_PASSWORD": "p" * 32,
        "REDIS_PASSWORD": "r" * 32,
        "JWT_SECRET": "j" * 32,
        "JWT_REFRESH_SECRET": "k" * 32,
        "CORS_ORIGIN": "https://cn.example.invalid",
        "CN_DOMAIN": "cn.example.invalid",
        "INT_DOMAIN": "int.example.invalid",
        "TLS_EMAIL": "ops@example.invalid",
    }
)
compose_command = (
    ["docker-compose"]
    if shutil.which("docker-compose")
    else ["docker", "compose"]
)
result = subprocess.run(
    compose_command + ["-f", str(COMPOSE), "config", "--format", "json"],
    cwd=ROOT,
    env=environment,
    text=True,
    capture_output=True,
    check=False,
)
if result.returncode:
    print(result.stderr, file=sys.stderr)
    raise SystemExit("Production Compose gate failed: configuration did not render")

document = json.loads(result.stdout)
services = document.get("services", {})
missing_services = sorted(required_services - services.keys())
if missing_services:
    raise SystemExit(
        "Production Compose gate failed: missing services: "
        + ", ".join(missing_services)
    )

for name in ("postgres", "redis", "api", "web-cn", "web-int"):
    if services[name].get("ports"):
        raise SystemExit(
            f"Production Compose gate failed: {name} must not publish host ports"
        )

for name in ("api", "web-cn", "web-int"):
    if services[name].get("restart") != "unless-stopped":
        raise SystemExit(
            f"Production Compose gate failed: {name} lacks restart policy"
        )

print(f"Production Compose gate passed: {len(services)} services")
