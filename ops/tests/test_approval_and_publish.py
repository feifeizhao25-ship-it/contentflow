import json
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from airui_ops.approval import ApprovalService
from airui_ops.content import apply_aigc, content_sha256
from airui_ops.http_client import TransportError
from airui_ops.killswitch import trip
from airui_ops.publish import Publisher, decide_publish, switch_hash
from airui_ops.store import AuditLog, Store
from airui_ops.wecom_client import WeComClient, notify_webhook
from airui_ops.wecom_crypto import WeComCrypto
from tests.conftest import TZ, FakeTransport, aes_key, ok_json, sample_config

TOKEN = "callback-token"
CORP = "ww1234567890abcd"


def _service(tmp_path: Path, clock, transport, cfg=None):
    cfg = cfg or sample_config()
    key = aes_key()
    crypto = WeComCrypto(TOKEN, key, CORP)
    client = WeComClient(CORP, "wecom-secret-value", "1000002", transport)
    store = Store(tmp_path / "state.db")
    audit = AuditLog(tmp_path / "audit.jsonl", secrets=["wecom-secret-value", "baidu-token-678901"])
    kill = tmp_path / "KILL"
    return ApprovalService(store, audit, client, crypto, cfg, clock, kill), crypto, store, audit, kill, cfg


def _encrypt_call(crypto: WeComCrypto, xml: str):
    blob = crypto.encrypt(xml)
    sig = crypto.signature("1409659813", "1372623149", blob)
    wrapper = f"<xml><Encrypt><![CDATA[{blob}]]></Encrypt></xml>"
    return sig, wrapper


def _wire(transport: FakeTransport, detail_status=2, sha="", fail_detail=False, apply_errcode=0):
    def handler(method, url, headers, body):
        if "gettoken" in url:
            return ok_json({"errcode": 0, "access_token": "mem-token", "expires_in": 7200})
        if fail_detail and "getapprovaldetail" in url:
            raise TransportError("down")
        if "applyevent" in url:
            if apply_errcode:
                return ok_json({"errcode": apply_errcode, "errmsg": "tpl"})
            return ok_json({"errcode": 0, "sp_no": "sp1"})
        if "getapprovaldetail" in url:
            return ok_json({"errcode": 0, "info": {"sp_no": "sp1", "sp_status": detail_status, "comments": [{"commentcontent": sha}]}})
        if "getapprovalinfo" in url:
            return ok_json({"errcode": 0, "sp_no_list": ["sp1"]})
        if "message/send" in url:
            return ok_json({"errcode": 0})
        if "webhook" in url:
            return ok_json({"errcode": 0})
        if "data.zz.baidu.com" in url:
            return ok_json({"success": 1, "remain": 9})
        if "/growth/publish/" in url:
            return ok_json({"id": "p1", "url": "https://www.example.cn/p", "stub": "in-app-card" in url})
        raise TransportError(url)

    transport.handler = handler


def _content():
    return {"product": "shunshi", "title": "立冬", "body": apply_aigc("shunshi", "天黑早了，把记录时间提前。")}


def test_approve_reject_timeout_sha_and_wecom_down(tmp_path, clock):
    transport = FakeTransport()
    svc, crypto, store, audit, kill, cfg = _service(tmp_path, clock, transport)
    content = _content()
    _wire(transport, sha=content_sha256(content))
    record = svc.submit("P1", "shunshi", content, preview_url="https://pkg.example.cn/pkg/1")
    assert record["status"] == "pending"
    assert record["channel"] == "oa"
    assert record["sp_no"] == "sp1"
    sig, wrapper = _encrypt_call(crypto, "<xml><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[sys_approval_change]]></Event><ApprovalInfo><SpNo>sp1</SpNo><Speech><![CDATA[]]></Speech></ApprovalInfo></xml>")
    result = svc.handle_callback(sig, "1409659813", "1372623149", wrapper)
    assert result["status"] == "approved"
    saved = svc.get(record["id"])
    assert saved["detail_checked"] is True

    # 驳回
    transport2 = FakeTransport()
    svc2, crypto2, *_ = _service(tmp_path / "rej", clock, transport2)
    content2 = _content()
    _wire(transport2, detail_status=3, sha=content_sha256(content2))
    rec2 = svc2.submit("P1", "shunshi", content2)
    sig, wrapper = _encrypt_call(crypto2, "<xml><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[sys_approval_change]]></Event><ApprovalInfo><SpNo>sp1</SpNo></ApprovalInfo></xml>")
    assert svc2.handle_callback(sig, "1409659813", "1372623149", wrapper)["status"] == "rejected"

    # 超时 = 未批准
    late = clock
    late.when = datetime(2026, 11, 2, 22, 0, tzinfo=TZ)
    transport3 = FakeTransport()
    svc3, crypto3, *_ = _service(tmp_path / "late", late, transport3)
    content3 = _content()
    _wire(transport3, sha=content_sha256(content3))
    rec3 = svc3.submit("P1", "shunshi", content3)
    sig, wrapper = _encrypt_call(crypto3, "<xml><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[sys_approval_change]]></Event><ApprovalInfo><SpNo>sp1</SpNo></ApprovalInfo></xml>")
    assert svc3.handle_callback(sig, "1409659813", "1372623149", wrapper)["reason"] == "timeout"
    assert svc3.get(rec3["id"])["status"] == "timeout"

    # 哈希不一致
    changed = dict(content)
    changed["title"] = "改了一个字"
    assert svc.invalidate_if_changed(record["id"], changed)["status"] == "invalidated"

    # 企业微信不可用：复核失败，不发布
    transport4 = FakeTransport()
    svc4, crypto4, *_rest = _service(tmp_path / "down", clock, transport4)
    clock.when = datetime(2026, 11, 2, 10, 0, tzinfo=TZ)
    content4 = _content()
    _wire(transport4, sha=content_sha256(content4), fail_detail=True)
    rec4 = svc4.submit("P1", "shunshi", content4)
    sig, wrapper = _encrypt_call(crypto4, "<xml><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[sys_approval_change]]></Event><ApprovalInfo><SpNo>sp1</SpNo></ApprovalInfo></xml>")
    assert svc4.handle_callback(sig, "1409659813", "1372623149", wrapper)["reason"] == "wecom_unavailable"
    assert svc4.get(rec4["id"])["status"] == "pending"
    assert svc4.wecom_ok is False


def test_reconcile_fills_missed_callback_and_webhook_is_not_approval(tmp_path, clock):
    transport = FakeTransport()
    svc, crypto, store, audit, kill, cfg = _service(tmp_path, clock, transport)
    content = _content()
    _wire(transport, sha=content_sha256(content))
    record = svc.submit("P1", "shunshi", content)
    assert notify_webhook(transport, "webhook-key", "只是通知") is True
    assert svc.get(record["id"])["status"] == "pending"
    updated = svc.reconcile()
    assert updated[0]["status"] == "approved"


def test_template_card_single_approver_only_and_stop_word(tmp_path, clock):
    transport = FakeTransport()
    svc, crypto, store, audit, kill, cfg = _service(tmp_path, clock, transport)
    _wire(transport, apply_errcode=301025)
    record = svc.submit("P2", "shunshi", _content())
    assert record["reason"] == "template_card_refused_multi_approver"
    record4 = svc.submit("P4", "shunshi", {"config_hash": "abc", "body": apply_aigc("shunshi", "晋升说明")})
    assert record4["channel"] == "template_card"
    xml = "<xml><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[template_card_event]]></Event><EventKey><![CDATA[approve]]></EventKey><TaskId><![CDATA[%s]]></TaskId><FromUserName><![CDATA[owner]]></FromUserName></xml>" % record4["id"]
    sig, wrapper = _encrypt_call(crypto, xml)
    assert svc.handle_callback(sig, "1409659813", "1372623149", wrapper)["status"] == "approved"
    bad = "<xml><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[请急停]]></Content></xml>"
    sig, wrapper = _encrypt_call(crypto, bad)
    assert svc.handle_callback(sig, "1409659813", "1372623149", wrapper)["reason"] == "killed"
    assert kill.exists()


def test_kill_switch_quiet_window_and_jianji_block(tmp_path, clock):
    content = _content()
    approval = {"status": "approved", "content_sha256": content_sha256(content), "channel": "template_card", "detail_checked": False, "withdrawn": [2]}
    base = dict(product="shunshi", tier="A", channel="website_seo", content=content, approval=approval, window="08:00-21:30", wecom_ok=True, gates_open=False, switch_on=True, needs_p2=False, p2_approved=False, transition_mode=False)
    night = datetime(2026, 11, 2, 22, 0, tzinfo=TZ)
    assert decide_publish(now=night, killed=False, **base).reason == "quiet_hours"
    assert decide_publish(now=datetime(2026, 11, 2, 8, 0, tzinfo=TZ), killed=False, **base).action == "allow"
    assert decide_publish(now=datetime(2026, 11, 2, 21, 30, tzinfo=TZ), killed=False, **base).action == "allow"
    assert decide_publish(now=datetime(2026, 11, 2, 21, 31, tzinfo=TZ), killed=False, **base).reason == "quiet_hours"
    assert decide_publish(now=clock(), killed=True, **base).reason == "kill_switch"
    assert decide_publish(now=clock(), killed=False, product="jianji", tier="A", **{k: v for k, v in base.items() if k not in {"product", "tier"}}).reason == "jianji_gates"
    assert decide_publish(now=clock(), killed=False, tier="B", channel="xiaohongshu", **{k: v for k, v in base.items() if k not in {"tier", "channel"}}).action == "manual"
    withdrawn = decide_publish(now=clock(), killed=False, item_index=2, **base)
    assert withdrawn.reason == "withdrawn"
    kept = decide_publish(now=clock(), killed=False, item_index=1, **base)
    assert kept.action == "allow"
    trip(tmp_path / "KILL", "PAUSE")
    assert (tmp_path / "KILL").read_text(encoding="utf-8").strip() == "PAUSE"


def test_publishers_mock_http_and_never_post_to_tier_b(tmp_path, clock):
    transport = FakeTransport()
    cfg = sample_config()
    store = Store(tmp_path / "state.db")
    audit = AuditLog(tmp_path / "audit.jsonl", secrets=["baidu-token-678901"])
    store.put("switch", "approved", {"hash": switch_hash(cfg)})
    secrets = {"BAIDU_PUSH_TOKEN": "baidu-token-678901", "OPENCLAW_SHUNSHI_ADMIN_TOKEN": "shunshi-token-789012"}
    _wire(transport)
    publisher = Publisher(cfg, secrets, transport, store, audit, clock, tmp_path / "KILL", True)
    content = _content()
    content["url"] = "https://www.example.cn/lidong"
    approval = {"status": "approved", "content_sha256": content_sha256(content), "channel": "oa", "detail_checked": True, "withdrawn": []}
    baidu = publisher.publish("shunshi", "A", "baidu_push", content, approval)
    assert baidu["published"] is True
    blob = json.dumps(baidu) + Path(tmp_path / "audit.jsonl").read_text(encoding="utf-8")
    assert "baidu-token-678901" not in blob
    assert any("data.zz.baidu.com" in call["url"] for call in transport.calls)

    card = {"product": "shunshi", "title": "卡片", "body": apply_aigc("shunshi", "站内卡片正文")}
    card_approval = {"status": "approved", "content_sha256": content_sha256(card), "channel": "oa", "detail_checked": True, "withdrawn": []}
    stub = publisher.publish("shunshi", "A", "in_app_cards", card, card_approval)
    assert stub["published"] is False
    assert stub["stub"] is True

    before = len(transport.calls)
    manual = publisher.publish("shunshi", "B", "xiaohongshu", content, approval)
    assert manual["action"] == "manual"
    assert len(transport.calls) == before
    assert not any("xiaohongshu" in call["url"] for call in transport.calls)

    # 开关未批准时即使 YAML 写了 on 也不发
    store.put("switch", "approved", {"hash": "stale"})
    blocked = publisher.publish("shunshi", "A", "baidu_push", content, approval)
    assert blocked["reason"] == "switch_off"
