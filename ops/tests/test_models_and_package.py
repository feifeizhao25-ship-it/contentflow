import json
from datetime import datetime, timedelta
from pathlib import Path

from airui_ops.http_client import TransportError, assert_domestic_url
from airui_ops.models import ARK_CHAT, DASHSCOPE_CHAT, DEEPSEEK_CHAT, ModelGateway, SEEDANCE_MODEL, SEEDREAM_MODEL
from airui_ops.package import PackageService
from airui_ops.store import AuditLog, Store
from tests.conftest import TZ, FakeTransport, aes_key, ok_json, secret_lines, write_config


def test_routes_fallback_budget_and_refuses_offshore(tmp_path, clock):
    transport = FakeTransport()
    calls = {"n": 0}

    def handler(method, url, headers, body):
        calls["n"] += 1
        if "images/generations" in url:
            return ok_json({"data": [{"url": "https://ark.cn-beijing.volces.com/out.png"}]})
        if "contents/generations" in url:
            return ok_json({"id": "task-1"})
        if "deepseek" in url and calls["n"] == 1:
            return ok_json({}, status=503)
        if "ark.cn-beijing" in url and "chat/completions" in url:
            return ok_json({"choices": [{"message": {"content": "备用稿"}}], "usage": {"prompt_tokens": 10, "completion_tokens": 4}})
        if "dashscope.aliyuncs.com" in url and b"qwen3.5-plus" in (body or b""):
            return ok_json({"choices": [{"message": {"content": "评审通过"}}], "usage": {"prompt_tokens": 8, "completion_tokens": 2}})
        raise TransportError(url)

    transport.handler = handler
    store = Store(tmp_path / "state.db")
    audit = AuditLog(tmp_path / "audit.jsonl")
    secrets = {"DEEPSEEK_API_KEY": "deepseek-key-345678", "DASHSCOPE_API_KEY": "dashscope-key-456789", "ARK_API_KEY": "ark-key-56789012"}
    gw = ModelGateway(secrets, {"budget": {"ai_monthly_cny": {"openclaw": 1500}}, "models": {}}, transport, store, audit, clock)
    draft = gw.complete("draft", "写一段")
    assert draft.ok and draft.fallback_used and draft.provider == "ark"
    assert draft.model == "doubao-seed-2-0-lite-260428"
    review = gw.complete("review", "审一稿")
    assert review.ok and review.provider == "dashscope" and review.model == "qwen3.5-plus"
    image = gw.image("节气卡", str(tmp_path / "card.html"))
    assert image.model == SEEDREAM_MODEL
    video = gw.video("竖屏 10 秒", 10)
    assert video.model == SEEDANCE_MODEL
    # 预算封顶后非必要生成停止，评审仍可走
    gw.store.put("budget", clock().strftime("%Y-%m"), {"cny": 1500})
    paused = gw.complete("draft", "再写")
    assert paused.reason == "budget"
    assert gw.complete("review", "仍要审").ok
    try:
        assert_domestic_url("https://fal.run/x")
        assert False
    except TransportError:
        assert True
    try:
        assert_domestic_url("https://openrouter.ai/api")
        assert False
    except TransportError:
        assert True
    blob = Path(tmp_path / "audit.jsonl").read_text(encoding="utf-8")
    assert "deepseek-key" not in blob
    assert "fal.run" not in blob
    assert DEEPSEEK_CHAT.startswith("https://api.deepseek.com")
    assert DASHSCOPE_CHAT.startswith("https://dashscope.aliyuncs.com")
    assert ARK_CHAT.startswith("https://ark.cn-beijing.volces.com")


def test_image_falls_back_to_html_template_without_keys(tmp_path, clock):
    store = Store(tmp_path / "state.db")
    audit = AuditLog(tmp_path / "audit.jsonl")
    gw = ModelGateway({}, {"budget": {"ai_monthly_cny": {"openclaw": 1500}}}, FakeTransport(), store, audit, clock)
    dest = tmp_path / "card.html"
    result = gw.image("封面文字", str(dest))
    assert result.provider == "html_template"
    assert "封面文字" in dest.read_text(encoding="utf-8")
    assert gw.guard("文本").reason.startswith("待核实")


def test_daily_run_does_not_automate_tier_b(tmp_path, clock):
    import os
    from airui_ops.daily import run_daily
    from airui_ops.hub import Hub
    from tests.conftest import secret_lines, write_config

    values = {
        "WECOM_SECRET": "wecom-secret-value-1",
        "WECOM_TOKEN": "tok-123456",
        "WECOM_AES_KEY": aes_key(),
        "WECOM_WEBHOOK_KEY": "webhook-key-234567",
        "DEEPSEEK_API_KEY": "deepseek-key-345678",
        "DASHSCOPE_API_KEY": "dashscope-key-456789",
        "ARK_API_KEY": "ark-key-56789012",
        "BAIDU_PUSH_TOKEN": "baidu-token-678901",
        "OPENCLAW_SHUNSHI_ADMIN_TOKEN": "shunshi-token-789012",
        "OPENCLAW_FENFAXIA_API_TOKEN": "fenfa-token-890123",
        "PKG_PREVIEW_SIGNING_KEY": "p" * 40,
    }
    secret_path = tmp_path / "secrets.env"
    secret_path.write_text(secret_lines(values), encoding="utf-8")
    os.chmod(secret_path, 0o600)
    transport = FakeTransport()
    hub = Hub(write_config(tmp_path), tmp_path / "data", secret_path, transport, clock, {})
    result = run_daily(hub)
    assert result["halted"] is False
    assert result["created"]
    assert result["published"] == []
    joined = " ".join(call["url"] for call in transport.calls)
    for banned in ("xiaohongshu", "douyin.com", "bilibili.com", "zhihu.com", "fal.run", "openrouter.ai"):
        assert banned not in joined


def test_signed_package_expires_and_records_url(tmp_path, clock):
    store = Store(tmp_path / "state.db")
    svc = PackageService(store, "p" * 40, "pkg.example.cn", clock)
    record = svc.create("fenfaxia", "xiaohongshu", "分发侠", "标题", "正文", ["规则"], [{"kind": "image", "url": "https://cdn.example.cn/a.png"}])
    exp, sig = record["exp"], record["sig"]
    status, page = svc.render(record["id"], exp, sig)
    assert status == 200
    assert "复制正文" in page
    assert "【本内容由 AI 生成】" in page
    assert "分发侠" in page
    code, payload = svc.mark_published(record["id"], exp, sig, "https://www.xiaohongshu.com/explore/1")
    assert code == 200 and payload["ok"]
    saved = store.get("metric", record["id"])
    assert saved["url"].startswith("https://")
    clock.when = datetime.fromtimestamp(exp, TZ) + timedelta(seconds=5)
    assert svc.render(record["id"], exp, sig)[0] == 403
    assert svc.mark_published(record["id"], exp, "0" * 64, "https://example.cn")[0] == 403
