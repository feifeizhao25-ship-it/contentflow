#!/usr/bin/env python3
"""Fail CI when CN and Global production workloads share state or API routing."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "runtime" / "docker-compose.production.yml").read_text()
GLOBAL_COMPOSE = (ROOT / "runtime" / "docker-compose.global.yml").read_text()
ENV_EXAMPLE = (ROOT / "runtime" / ".env.production.example").read_text()
GLOBAL_ENV_EXAMPLE = (ROOT / "runtime" / ".env.global.example").read_text()
GLOBAL_EDGE_ROUTE = (ROOT / "runtime" / "Caddyfile.global.example").read_text()

REQUIRED_COMPOSE = (
    "postgres-cn:", "postgres-int:", "redis-cn:", "redis-int:",
    "api-cn:", "api-int:", "MARKET_REGION: cn", "MARKET_REGION: global",
    "API_INTERNAL_URL: http://api-cn:4000", "API_INTERNAL_URL: http://api-int:4000",
    "networks: [cn-backend]", "networks: [int-backend]",
    "CN_POSTGRES_PASSWORD", "INT_POSTGRES_PASSWORD",
    "CN_REDIS_PASSWORD", "INT_REDIS_PASSWORD",
    "CN_JWT_SECRET", "INT_JWT_SECRET",
)
REQUIRED_ENV = (
    "CN_POSTGRES_PASSWORD=", "INT_POSTGRES_PASSWORD=",
    "CN_REDIS_PASSWORD=", "INT_REDIS_PASSWORD=",
    "CN_JWT_SECRET=", "INT_JWT_SECRET=",
    "CN_CORS_ORIGIN=", "INT_CORS_ORIGIN=",
)
API_MODULE_SOURCE = (ROOT / "runtime" / "api" / "src" / "app.module.ts").read_text()
FORBIDDEN_SHARED = (
    "API_INTERNAL_URL: http://api:4000",
    "DATABASE_URL: postgresql://contentflow:${POSTGRES_PASSWORD",
)


def main() -> int:
    failures = [f"missing compose contract: {token}" for token in REQUIRED_COMPOSE if token not in COMPOSE]
    failures += [f"missing environment contract: {token}" for token in REQUIRED_ENV if token not in ENV_EXAMPLE]
    failures += [f"shared production state is forbidden: {token}" for token in FORBIDDEN_SHARED if token in COMPOSE]
    if "...marketModulesFor(process.env.MARKET_REGION)" not in API_MODULE_SOURCE:
        failures.append("API modules are not selected by MARKET_REGION")
    if "region === 'global' ? [] : DOMESTIC_ONLY_MODULES" not in API_MODULE_SOURCE:
        failures.append("Global API does not fail closed against domestic-only modules")
    if COMPOSE.count("networks: [cn-backend]") < 4:
        failures.append("CN database, cache, API and web must all stay on cn-backend")
    if COMPOSE.count("networks: [int-backend]") < 4:
        failures.append("Global database, cache, API and web must all stay on int-backend")
    global_required = (
        "name: contentflow-global", "MARKET_REGION: global",
        "internal: true", "external: true", "IMAGE_TAG:?",
        "CORS_ORIGIN:?", "OPENROUTER_SITE_URL:?", 'ENABLE_API_DOCS: "false"',
        "http://127.0.0.1:4000/api/v1/health/ready",
    )
    failures += [
        f"missing isolated global production contract: {token}"
        for token in global_required if token not in GLOBAL_COMPOSE
    ]
    if "MARKET_REGION: cn" in GLOBAL_COMPOSE or "web-cn" in GLOBAL_COMPOSE:
        failures.append("Global-only production stack must not include domestic workloads")
    if GLOBAL_COMPOSE.count("networks: [backend, edge]") != 2:
        failures.append("Global API and web must join the edge network without publishing host ports")
    if "ports:" in GLOBAL_COMPOSE:
        failures.append("Global-only production stack must not publish host ports")
    if "contentflow.tianji-astrology.com" not in GLOBAL_ENV_EXAMPLE:
        failures.append("Global production environment does not name the approved HTTPS origin")
    edge_required = (
        "contentflow.tianji-astrology.com",
        "@contentflow_api path /api/*",
        "reverse_proxy @contentflow_api contentflow-global-api:4000",
        "reverse_proxy contentflow-global-web:3000",
    )
    failures += [
        f"missing ContentFlow edge routing contract: {token}"
        for token in edge_required if token not in GLOBAL_EDGE_ROUTE
    ]
    expected_readiness = "http://127.0.0.1:4000/api/v1/health/ready"
    if COMPOSE.count(expected_readiness) != 2:
        failures.append("CN and Global API health checks must use the prefixed readiness route")
    if "http://127.0.0.1:4000/health/ready" in COMPOSE + GLOBAL_COMPOSE:
        failures.append("Unprefixed readiness route is invalid for the API controller")
    if failures:
        print("Region isolation gate: FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("Region isolation gate: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
