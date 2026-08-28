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
required_services = {
    "postgres-cn", "redis-cn", "api-cn", "web-cn",
    "postgres-int", "redis-int", "api-int", "web-int", "gateway",
}
required_contracts = {
    "CN_POSTGRES_PASSWORD", "INT_POSTGRES_PASSWORD",
    "CN_REDIS_PASSWORD", "INT_REDIS_PASSWORD",
    "CN_JWT_SECRET", "INT_JWT_SECRET",
    "CN_JWT_REFRESH_SECRET", "INT_JWT_REFRESH_SECRET",
    "CN_PAYMENT_CALLBACK_SECRET", "INT_PAYMENT_CALLBACK_SECRET",
    "CN_CORS_ORIGIN", "INT_CORS_ORIGIN",
    "CN_PUBLISH_DISPATCH_WEBHOOK_URL", "INT_PUBLISH_DISPATCH_WEBHOOK_URL",
    "CN_PUBLISH_DISPATCH_WEBHOOK_SECRET", "INT_PUBLISH_DISPATCH_WEBHOOK_SECRET",
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
        "CN_POSTGRES_PASSWORD": "p" * 32,
        "INT_POSTGRES_PASSWORD": "q" * 32,
        "CN_REDIS_PASSWORD": "r" * 32,
        "INT_REDIS_PASSWORD": "s" * 32,
        "CN_JWT_SECRET": "j" * 32,
        "INT_JWT_SECRET": "i" * 32,
        "CN_JWT_REFRESH_SECRET": "k" * 32,
        "INT_JWT_REFRESH_SECRET": "l" * 32,
        "CN_PAYMENT_CALLBACK_SECRET": "c" * 32,
        "INT_PAYMENT_CALLBACK_SECRET": "d" * 32,
        "CN_CORS_ORIGIN": "https://cn.example.invalid",
        "INT_CORS_ORIGIN": "https://int.example.invalid",
        "CN_PUBLISH_DISPATCH_WEBHOOK_URL": "https://cn-automation.example.invalid/publish",
        "INT_PUBLISH_DISPATCH_WEBHOOK_URL": "https://int-automation.example.invalid/publish",
        "CN_PUBLISH_DISPATCH_WEBHOOK_SECRET": "w" * 32,
        "INT_PUBLISH_DISPATCH_WEBHOOK_SECRET": "x" * 32,
        "OPENROUTER_API_KEY": "or-test-placeholder",
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

for name in required_services - {"gateway"}:
    if services[name].get("ports"):
        raise SystemExit(
            f"Production Compose gate failed: {name} must not publish host ports"
        )

for name in ("api-cn", "api-int", "web-cn", "web-int"):
    if services[name].get("restart") != "unless-stopped":
        raise SystemExit(
            f"Production Compose gate failed: {name} lacks restart policy"
        )

if services["api-cn"]["environment"].get("MARKET_REGION") != "cn":
    raise SystemExit("Production Compose gate failed: api-cn market mismatch")
if services["api-int"]["environment"].get("MARKET_REGION") != "global":
    raise SystemExit("Production Compose gate failed: api-int market mismatch")
if services["api-cn"]["environment"].get("DATABASE_URL") == services["api-int"]["environment"].get("DATABASE_URL"):
    raise SystemExit("Production Compose gate failed: CN and Global share a database")

print(f"Production Compose gate passed: {len(services)} isolated services")
