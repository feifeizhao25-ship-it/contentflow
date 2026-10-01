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
    "runtime/api/src/modules/billing/alipay.adapter.ts",
    (
        "RSA-SHA256",
        "FAST_INSTANT_TRADE_PAY",
        "https://openapi.alipay.com/gateway.do",
        "verifyAlipayNotify",
    ),
)
require(
    "runtime/api/src/modules/billing/billing.controller.ts",
    (
        "callbacks/alipay",
        "支付宝回调签名无效",
        "支付宝商户不匹配",
        "paidAmount: amount",
        "response.type('text/plain').send('success')",
    ),
)
require(
    "runtime/api/src/modules/billing/billing.service.ts",
    ("createAlipayPagePay", "createWeChatNativePay", "支付金额或币种与订单不一致"),
)
require(
    "runtime/api/src/modules/billing/wechat-pay.adapter.ts",
    (
        "WECHATPAY2-SHA256-RSA2048",
        "AEAD_AES_256_GCM",
        "verifyWeChatNotifySignature",
        "https://api.mch.weixin.qq.com",
    ),
)
require(
    "runtime/web-cn/src/app/(main)/studio/page.tsx",
    ("setBalance(null)", "系统不会用模拟进度或占位视频冒充结果"),
)
require(
    "runtime/web-cn/src/components/onboarding/FirstScriptGuide.tsx",
    (
        "/api/ai/generate-script",
        "contentflow:onboarding-script",
        "if (!response.ok)",
        "已由真实服务生成",
    ),
)
forbid(
    "runtime/web-cn/src/components/onboarding/FirstScriptGuide.tsx",
    ("mockTitles", "mockScript", "Math.random()", "模拟API调用", "viralScore"),
)
require(
    "runtime/web-cn/src/components/onboarding/FirstVideoGuide.tsx",
    (
        "/api/video/generate",
        "response.body.getReader()",
        "event.done && event.url",
        "generatedVideo.url",
        "失败不伪造",
    ),
)
require(
    "runtime/web-cn/src/components/checkin/CheckInModal.tsx",
    ("apiClient.get", "'/points/stats'", "'/points/logs'", "'/points/checkin'"),
)
forbid(
    "runtime/web-cn/src/components/checkin/CheckInModal.tsx",
    ("模拟API调用延迟", "checkIn()", "points-storage"),
)
require(
    "runtime/api/src/modules/points/points.service.ts",
    ("startOfChinaDay", "CHINA_STANDARD_TIME_OFFSET_MS", "longest_streak:"),
)
require(
    "runtime/web-cn/src/lib/referral-service.ts",
    ("verified: boolean", "navigator.share", "未发放任何奖励"),
)
forbid(
    "runtime/web-cn/src/lib/referral-service.ts",
    ("console.log(`[Share]", "message: '分享成功'", "reward: { points: SHARE_REWARDS"),
)
forbid(
    "runtime/web-cn/src/components/share/ShareModal.tsx",
    ("Math.random()", "模拟统计数据", "message.success('分享成功！')"),
)
forbid(
    "runtime/web-cn/src/components/membership/PremiumGate.tsx",
    ("模拟分享成功", "您已获得 3 天专业版体验", "?ref=${Date.now()}"),
)
require(
    "runtime/web-cn/src/app/(main)/traffic-sandwich/page.tsx",
    ("String(res?.content || '')", "router.push('/studio')", "完播率需发布后数据"),
)
forbid(
    "runtime/web-cn/src/app/(main)/traffic-sandwich/page.tsx",
    ("预期完播率", "92%", "15%", "Parse or simulate parsing for demo"),
)
require(
    "runtime/web-cn/src/lib/video-service.ts",
    ("/api/ai/generate-video", "if (!response.ok)", "if (!videoUrl)", "status: 'completed'"),
)
forbid(
    "runtime/web-cn/src/lib/video-service.ts",
    ("simulateVideoGeneration", "via.placeholder.com", "example.com/videos", "resolution: '1080p'"),
)
# 配音面板、TTS 客户端、音乐库曾经是「列着 OpenAI / Azure / ElevenLabs、声音列表和音乐库是写死的模拟数据」的
# 无人引用的代码（路由本身一律返回暂未开通）。已删除；接入境内供应商时重新写，不要把它们请回来。
for removed in (
    "runtime/web-cn/src/components/video/VoiceoverPanel.tsx",
    "runtime/web-cn/src/lib/tts-service.ts",
    "runtime/web-cn/src/lib/music-service.ts",
):
    if (ROOT / removed).exists():
        errors.append(f"{removed}: 境外供应商 / 模拟数据的遗留代码不得恢复")
forbid(
    "runtime/web-cn/src/components/onboarding/FirstVideoGuide.tsx",
    ("via.placeholder.com", "模拟视频生成进度", "高清画质 1080P", "setTimeout(resolve"),
)
# 注：此前这里还检查 .github/workflows/ci.yml（本仓库快照里没有 .github 目录，CI 配置在树外），
# 也要求视频路由「用 FAL_API_KEY 并先 requireAuth」。国内版 2026-09-21 的口径是境外视频 / TTS / 字幕
# 一律返回「暂未开通」，不接 fal.ai；那两条要求与口径相反，按口径改成下面的样子。

# 国内版的境外能力路由只能返回「暂未开通」，不得带任何境外供应商的密钥或主机。
for route in (
    "runtime/web-cn/src/app/api/ai/generate-video/route.ts",
    "runtime/web-cn/src/app/api/video/generate/route.ts",
):
    require(route, ("notAvailableInChina",))
    forbid(route, ("FAL_API_KEY", "fal.run", "fal.ai", "NEXT_PUBLIC_FAL", "NEXT_PUBLIC_OPENROUTER"))

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

# 国内版不连 Supabase（境外托管数据库）：这两个客户端文件已删除，不得回来。
for supabase_client in (
    "runtime/web-cn/src/lib/supabase.ts",
    "runtime/web-cn/src/lib/supabase-server.ts",
):
    if (ROOT / supabase_client).exists():
        errors.append(f"{supabase_client}: 国内版不得保留 Supabase 客户端")

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
