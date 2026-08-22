#!/usr/bin/env python3
"""Static gate for the ContentFlow runtime that is actually deployed."""

from pathlib import Path
import sys


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
errors: list[str] = []


def check(path: str, expectations: tuple[tuple[str, bool], ...]) -> None:
    target = REPOSITORY_ROOT / path
    if not target.is_file():
        errors.append(f"{path}: required production file is missing")
        return
    body = target.read_text(encoding="utf-8")
    for needle, should_exist in expectations:
        if (needle in body) != should_exist:
            state = "missing" if should_exist else "still present"
            errors.append(f"{path}: {needle!r} {state}")


check(
    "runtime/api/src/app.module.ts",
    (
        ("Missing required production environment variables", True),
        ("for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'])", True),
    ),
)
check(
    "runtime/api/src/modules/auth/strategies/jwt.strategy.ts",
    (("getOrThrow<string>('JWT_SECRET')", True),),
)
check(
    "runtime/api/src/cache/cache.module.ts",
    (("Production requires REDIS_HOST and forbids USE_MOCK_REDIS=true", True),),
)
check(
    "runtime/api/src/modules/publish/adapters/douyin.adapter.ts",
    (
        ("ADAPTER_NOT_INTEGRATED", True),
        ("NOT_IMPLEMENTED", True),
    ),
)
check(
    "runtime/api/src/main.ts",
    (
        ("allowedOrigins.length > 0 ? allowedOrigins : false", True),
        ("ENABLE_API_DOCS", True),
    ),
)
check(
    "runtime/web-cn/src/lib/supabase-server.ts",
    (
        ("process.env.NODE_ENV === 'development'", True),
        ("return null", True),
    ),
)
check(
    "runtime/web-cn/src/app/(main)/calendar/page.tsx",
    (
        ("redirect('/schedule?view=month')", True),
        ("MOCK_TASKS", False),
    ),
)
check(
    "runtime/web-cn/src/app/(main)/schedule/page.tsx",
    (
        ("MOCK_TASKS", False),
        ("via.placeholder.com", False),
    ),
)
check(
    "runtime/web-cn/src/app/(main)/ai-create/page.tsx",
    (
        ("const [materials, setMaterials] = useState<Material[]>([]);", True),
        ("via.placeholder.com", False),
    ),
)

if errors:
    print("Production code gate failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Production code gate passed")
