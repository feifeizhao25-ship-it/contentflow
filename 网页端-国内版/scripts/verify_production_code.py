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
        ("for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'PUBLISH_DISPATCH_WEBHOOK_SECRET'])", True),
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
        ("redirect('/studio')", True),
        ("via.placeholder.com", False),
    ),
)
check(
    "runtime/web-cn/src/app/api/ai/merge-videos/route.ts",
    (
        ("VIDEO_WORKER_NOT_CONFIGURED", True),
        ("videoMerger.mergeVideos", False),
    ),
)
check(
    "runtime/web-cn/src/app/api/video/generate/route.ts",
    (
        ("VIDEO_WORKER_NOT_CONFIGURED", True),
        ("@/lib/video-merger-service", False),
    ),
)
check(
    "runtime/web-cn/src/lib/multi-segment-video-service.ts",
    (
        ("VIDEO_WORKER_NOT_CONFIGURED", True),
        ("Falling back to first segment only", False),
        ("./video-merger-service", False),
    ),
)
check(
    "runtime/web-cn/src/lib/payment-service.ts",
    (
        ("PAYMENT_BACKEND_NOT_CONFIGURED", True),
        ("success: true", False),
        ("txn_${Date.now()}", False),
        ("Activated", False),
    ),
)
check(
    "runtime/web-cn/src/hooks/usePermissions.ts",
    (
        ("apiClient.get<any>('/billing/subscription')", True),
        (".from('user_subscriptions')", False),
        ("used_quota: subscription.used_quota + amount", False),
    ),
)
check(
    "runtime/web-cn/src/app/(main)/pricing/page.tsx",
    (
        ("/api/v1/billing/plans?market=cn", True),
        ("buildFallbackPlans", True),
        ("价格信息加载失败，请稍后重试", True),
        ("支付前会再次确认实时价格", True),
        ("displayedPlans.map", True),
        ("const membershipPlans =", False),
        ("未展示缓存或虚构价格", False),
    ),
)
check(
    "runtime/api/src/modules/billing/billing.service.ts",
    (
        ("idempotency_key: idempotencyKey", True),
        ("CN_PLANS.find", True),
        ("this.assertProviderReady", True),
        ("this.prisma.$transaction", True),
        ("signatureValid", True),
        ("status: 'refund_pending'", True),
        ("status: 'refunded'", True),
        ("status: 'closed'", True),
    ),
)
check(
    "runtime/api/src/database/prisma/schema.prisma",
    (
        ("@@unique([tenant_id, idempotency_key])", True),
        ("model PaymentWebhookEvent", True),
        ("@@unique([provider, provider_event_id])", True),
    ),
)
check(
    "runtime/api/src/modules/ai/ai.service.ts",
    (
        ("qwen/qwen3-30b-a3b-instruct-2507", True),
        ("deepseek/deepseek-v3.2", True),
        ("data_collection: 'deny'", True),
        ("zdr: true", True),
        ("Math.min(4000", True),
        ("cost_usd", True),
        ("latency_ms", True),
        ("registerOpenRouterFailure", True),
        ("OpenRouter circuit is open", True),
        ("anthropic/claude-3.5-sonnet", False),
    ),
)
check(
    "runtime/web-cn/src/app/api/ai/generate-script/route.ts",
    (
        ("response_format", True),
        ("json_schema", True),
        ("require_parameters: true", True),
    ),
)
check(
    "runtime/docker-compose.production.yml",
    (
        ("OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}", True),
        ("OPENROUTER_MODEL_FAST", True),
        ("OPENROUTER_FALLBACK_MODELS", True),
    ),
)

if errors:
    print("Production code gate failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Production code gate passed")
