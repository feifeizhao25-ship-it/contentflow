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

# SDK 本身不是风险边界：Supabase 可用于真实身份认证，Fal 也可以只在
# Next.js 服务端路由运行。真正需要阻断的是把供应商密钥暴露到浏览器、绕过
# 服务端鉴权，或者未接入的平台凭空返回“发布成功”。
for route in (
    "runtime/web-cn/src/app/api/ai/generate-video/route.ts",
    "runtime/web-cn/src/app/api/video/generate/route.ts",
):
    require(route, ("requireAuth(request)", "process.env.FAL_API_KEY"))
    forbid(route, ("NEXT_PUBLIC_FAL", "NEXT_PUBLIC_OPENROUTER"))

for adapter in (
    "runtime/api/src/modules/publish/adapters/douyin.adapter.ts",
    "runtime/api/src/modules/publish/adapters/bilibili.adapter.ts",
):
    require(adapter, ("readonly isLive = false", "ADAPTER_NOT_INTEGRATED"))
    forbid(adapter, ("av_mock", "bv_mock", "Math.random()", "status: 'published'"))

for env_file in (
    "runtime/.env.production.example",
    "runtime/web-cn/.env.example",
):
    if (ROOT / env_file).is_file():
        forbid(env_file, ("NEXT_PUBLIC_FAL", "NEXT_PUBLIC_OPENROUTER"))

# 国内内容生成与发布必须共用固定顺序、带版本和来源的六道闸。
# 该静态门禁不替代动态规则库，但可防止生产代码退化回“命中后替换星号并继续发布”。
require(
    "runtime/api/src/common/domestic-content-compliance.ts",
    (
        "DOMESTIC_RULESET_VERSION",
        "DOMESTIC_GATE_ORDER",
        "illegal_content",
        "advertising_law",
        "regulated_industry",
        "minor_protection",
        "misinformation",
        "intellectual_property",
        "source:",
        "sourceUrl:",
        "sourceRetrievedAt:",
        "humanOverrideAllowed: false",
    ),
)
require(
    "runtime/api/src/modules/ai/compliance.service.ts",
    ("evaluateDomesticContent", "CONTENT_COMPLIANCE_BLOCKED", "ruleSetVersion"),
)
require(
    "runtime/api/src/modules/publish/publish.service.ts",
    ("MARKET_REGION", "evaluateDomesticContent", "CONTENT_COMPLIANCE_BLOCKED"),
)
forbid(
    "runtime/api/src/modules/ai/compliance.service.ts",
    (".replace(regex, '***')", ".replace(regex, \"***\")"),
)

if errors:
    print("Production truthfulness gate failed:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("Production truthfulness gate passed")
