#!/usr/bin/env python3
"""Fail CI when a production surface can report simulated or unverified work."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def text(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        errors.append(f"{path}: missing")
        return ""
    return target.read_text(encoding="utf-8")


def require(path: str, values: tuple[str, ...]) -> None:
    content = text(path)
    for value in values:
        if value not in content:
            errors.append(f"{path}: missing production invariant {value!r}")


def forbid(path: str, values: tuple[str, ...]) -> None:
    content = text(path)
    for value in values:
        if value in content:
            errors.append(f"{path}: forbidden production placeholder {value!r}")


for route, destination in {
    "ai-create": "/studio",
    "create": "/studio",
    "dashboard": "/studio",
    "overview": "/studio",
    "community": "/contents",
    "competitor": "/analytics",
    "growth": "/analytics",
    "achievements": "/analytics",
    "monetization": "/pricing",
    "points": "/pricing",
    "persona": "/studio",
    "video-studio": "/studio",
    "my-videos": "/studio",
}.items():
    path = f"runtime/web-cn/src/app/(main)/{route}/page.tsx"
    require(path, ("import { redirect } from 'next/navigation';", f"redirect('{destination}')"))

require(
    "runtime/api/src/modules/publish/publish.processor.ts",
    (
        "Idempotency-Key",
        "X-ContentFlow-Signature",
        "Publishing dispatcher must use HTTPS",
        "Dispatcher claimed publication without a remote post ID",
        "submitted_unconfirmed",
    ),
)
require(
    "runtime/api/src/modules/materials/materials.service.ts",
    ("signed object-storage upload", "throw new BadRequestException"),
)
require(
    "runtime/api/src/modules/team/team.service.ts",
    ("signed invitation delivery", "throw new BadRequestException"),
)
require(
    "runtime/web-cn/src/app/(main)/studio/page.tsx",
    ("setBalance(null)", "系统不会用模拟进度或占位视频冒充结果"),
)
for workflow in (".github/workflows/ci.yml",):
    require(workflow, ("--dart-define=API_BASE_URL=https://contentflow-ci.invalid/api/v1",))

for package in ("runtime/web-cn/package.json", "runtime/web-int/package.json"):
    forbid(package, ("@supabase/supabase-js", "@supabase/ssr", "@fal-ai/client"))

for stale in (
    "runtime/api/src/modules/publish/adapters/bilibili.adapter.ts",
    "runtime/web-cn/src/store/pointsStore.ts",
    "runtime/web-cn/src/lib/supabase.ts",
):
    if (ROOT / stale).exists():
        errors.append(f"{stale}: stale simulated or browser-direct implementation still exists")

if errors:
    print("Production truthfulness gate failed:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("Production truthfulness gate passed")
