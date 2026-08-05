#!/usr/bin/env python3
"""Fail CI when CN and Global production workloads share state or API routing."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "runtime" / "docker-compose.production.yml").read_text()
ENV_EXAMPLE = (ROOT / "runtime" / ".env.production.example").read_text()

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
FORBIDDEN_SHARED = (
    "API_INTERNAL_URL: http://api:4000",
    "DATABASE_URL: postgresql://contentflow:${POSTGRES_PASSWORD",
)


def main() -> int:
    failures = [f"missing compose contract: {token}" for token in REQUIRED_COMPOSE if token not in COMPOSE]
    failures += [f"missing environment contract: {token}" for token in REQUIRED_ENV if token not in ENV_EXAMPLE]
    failures += [f"shared production state is forbidden: {token}" for token in FORBIDDEN_SHARED if token in COMPOSE]
    if COMPOSE.count("networks: [cn-backend]") < 4:
        failures.append("CN database, cache, API and web must all stay on cn-backend")
    if COMPOSE.count("networks: [int-backend]") < 4:
        failures.append("Global database, cache, API and web must all stay on int-backend")
    if failures:
        print("Region isolation gate: FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("Region isolation gate: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
