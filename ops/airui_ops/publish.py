"""A 档只在批准、窗口、闸门、开关都满足时发布。B 档永不自动。见己闸门未过则全部拦住。"""

from __future__ import annotations

import json
from dataclasses import dataclass

from airui_ops.clock import in_window
from airui_ops.config import NEVER_AUTOMATE, as_bool, jianji_open, switch_value
from airui_ops.content import aigc_ok, content_sha256
from airui_ops.http_client import Transport, TransportError, assert_domestic_url
from airui_ops.store import AuditLog, Store

# 产品侧尚未实现的下发接口。请求体会带 stub=true，成功响应也必须带 stub 才记为「接口未落地」。
STUB_CHANNELS = {"in_app_cards", "push_subscribed", "miniprogram_subscribe_msg", "email_opt_in", "wecom_community_broadcast"}
CHANNEL_PATH = {
    "website_seo": "/growth/publish/website",
    "fenfaxia_template_pages": "/growth/publish/template-page",
    "in_app_cards": "/growth/publish/in-app-card",
    "push_subscribed": "/growth/publish/push",
    "miniprogram_subscribe_msg": "/growth/publish/subscribe-message",
    "email_opt_in": "/growth/publish/email",
    "wecom_community_broadcast": "/growth/publish/wecom-community",
}


@dataclass
class PublishDecision:
    action: str  # allow | manual | block
    reason: str


def decide_publish(
    *,
    product: str,
    tier: str,
    channel: str,
    content: dict,
    approval: dict | None,
    now,
    window: str,
    killed: bool,
    wecom_ok: bool,
    gates_open: bool,
    switch_on: bool,
    needs_p2: bool,
    p2_approved: bool,
    transition_mode: bool,
    item_index: int | None = None,
) -> PublishDecision:
    if killed:
        return PublishDecision("block", "kill_switch")
    if product == "jianji" and not gates_open:
        return PublishDecision("block", "jianji_gates")
    if tier == "C" or product == "jianji":
        return PublishDecision("block", "tier_c")
    if not aigc_ok(product, str(content.get("body") or "")):
        return PublishDecision("block", "aigc_missing")
    if not wecom_ok and not transition_mode:
        return PublishDecision("block", "wecom_unavailable")
    if channel in NEVER_AUTOMATE or tier == "B":
        if transition_mode and tier == "B":
            return PublishDecision("manual", "transition_manual")
        if not _approval_ok(approval, content):
            return PublishDecision("block", "not_approved")
        return PublishDecision("manual", "tier_b_manual")
    if transition_mode:
        return PublishDecision("block", "transition_blocks_tier_a")
    if not in_window(now, window):
        return PublishDecision("block", "quiet_hours")
    if not switch_on:
        return PublishDecision("block", "switch_off")
    if needs_p2 and not p2_approved:
        return PublishDecision("block", "channel_p2_required")
    if not _approval_ok(approval, content):
        return PublishDecision("block", _approval_reason(approval, content))
    if approval and _item_withdrawn(approval, item_index):
        return PublishDecision("block", "withdrawn")
    return PublishDecision("allow", "approved")


def _approval_ok(approval: dict | None, content: dict) -> bool:
    if not approval or approval.get("status") != "approved":
        return False
    if approval.get("content_sha256") != content_sha256(content):
        return False
    if approval.get("channel") == "oa" and not approval.get("detail_checked"):
        return False
    return True


def _approval_reason(approval: dict | None, content: dict) -> str:
    if not approval:
        return "not_approved"
    if approval.get("status") == "timeout":
        return "timeout"
    if approval.get("status") == "rejected":
        return "rejected"
    if approval.get("status") == "invalidated" or (approval.get("content_sha256") and approval.get("content_sha256") != content_sha256(content)):
        return "sha_mismatch"
    if approval.get("status") != "approved":
        return "not_approved"
    if approval.get("channel") == "oa" and not approval.get("detail_checked"):
        return "detail_not_checked"
    return "not_approved"


def _item_withdrawn(approval: dict, item_index: int | None) -> bool:
    if item_index is None:
        return False
    return int(item_index) in set(int(n) for n in (approval.get("withdrawn") or []))


def switch_hash(config: dict) -> str:
    payload = {"tier_a": config.get("tier_a") or {}, "transition_mode": bool(config.get("transition_mode"))}
    return content_sha256(payload)


def effective_switch(config: dict, approved_hash: str | None, channel: str) -> bool:
    """未批准的开关保持默认关闭。配置哈希不一致时不采用新值。"""
    if not approved_hash or approved_hash != switch_hash(config):
        return False
    return switch_value(config, channel)


class Publisher:
    def __init__(self, config: dict, secrets: dict, transport: Transport, store: Store, audit: AuditLog, now, kill_file, wecom_ok: bool):
        self.config = config
        self.secrets = secrets
        self.transport = transport
        self.store = store
        self.audit = audit
        self.now = now
        self.kill_file = kill_file
        self.wecom_ok = wecom_ok

    def _killed(self) -> bool:
        from airui_ops.killswitch import killed
        return killed(self.kill_file)

    def publish(self, product: str, tier: str, channel: str, content: dict, approval: dict | None, needs_p2: bool = False, p2: dict | None = None, item_index: int | None = None) -> dict:
        approved_hash = (self.store.get("switch", "approved") or {}).get("hash")
        decision = decide_publish(
            product=product,
            tier=tier,
            channel=channel,
            content=content,
            approval=approval,
            now=self.now(),
            window=str((self.config.get("tier_a") or {}).get("window") or "08:00-21:30"),
            killed=self._killed(),
            wecom_ok=self.wecom_ok,
            gates_open=jianji_open(self.config),
            switch_on=effective_switch(self.config, approved_hash, channel) if tier == "A" else False,
            needs_p2=needs_p2,
            p2_approved=bool(p2) and _approval_ok(p2, p2.get("content") or {}),
            transition_mode=as_bool(self.config.get("transition_mode")),
            item_index=item_index,
        )
        if decision.action != "allow":
            self.audit.append({"action": "publish_skipped", "product": product, "channel": channel, "reason": decision.reason, "sha": content_sha256(content)})
            return {"published": False, "action": decision.action, "reason": decision.reason}
        result = self._deliver(product, channel, content)
        self.audit.append({"action": "publish", "product": product, "channel": channel, "result": result.get("status"), "sha": content_sha256(content)})
        return result

    def _deliver(self, product: str, channel: str, content: dict) -> dict:
        if channel == "baidu_push":
            return self._baidu(content)
        path = CHANNEL_PATH.get(channel)
        if not path:
            return {"published": False, "status": "unknown_channel", "reason": channel}
        base = (self.config.get(product) or {}).get("api_base") or ""
        token_name = "OPENCLAW_SHUNSHI_ADMIN_TOKEN" if product == "shunshi" else "OPENCLAW_FENFAXIA_API_TOKEN"
        token = self.secrets.get(token_name, "")
        if not base or not token:
            return {"published": False, "status": "not_configured", "reason": token_name}
        url = base.rstrip("/") + path
        assert_domestic_url(url)
        stub = channel in STUB_CHANNELS
        body = {"content": content, "stub": stub, "note": "产品端点未落地" if stub else ""}
        try:
            resp = self.transport.request(
                "POST",
                url,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}", "X-Airui-Contract": "stub" if stub else "live"},
                body=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                timeout=15,
            )
        except TransportError:
            return {"published": False, "status": "transport_error"}
        if resp.status >= 400:
            return {"published": False, "status": f"http_{resp.status}", "stub": stub}
        try:
            data = resp.json()
        except Exception:
            data = {}
        if stub:
            # 明确标记：对端若未实现，不能把 HTTP 200 当成已经发到用户。
            return {"published": False, "status": "stub_accepted" if data.get("stub") else "stub_unconfirmed", "stub": True, "contract": path}
        if channel == "wecom_community_broadcast":
            return {"published": False, "status": "needs_owner_confirm", "stub": True}
        return {"published": True, "status": "published", "remote": {k: data.get(k) for k in ("id", "url") if k in data}}

    def _baidu(self, content: dict) -> dict:
        token = self.secrets.get("BAIDU_PUSH_TOKEN", "")
        site = str((self.config.get("tier_a") or {}).get("baidu_site") or "")
        page = str(content.get("url") or "")
        if not token or not site or not page:
            return {"published": False, "status": "not_configured"}
        endpoint = f"http://data.zz.baidu.com/urls?site={site}&token={token}"
        try:
            resp = self.transport.request(
                "POST",
                endpoint,
                headers={"Content-Type": "text/plain"},
                body=page.encode("utf-8"),
                timeout=15,
            )
        except TransportError:
            return {"published": False, "status": "transport_error"}
        if resp.status >= 400:
            return {"published": False, "status": f"http_{resp.status}"}
        try:
            data = resp.json()
        except Exception:
            return {"published": False, "status": "bad_response"}
        ok = int(data.get("success") or 0) >= 1
        return {"published": ok, "status": "pushed" if ok else "rejected", "remain": data.get("remain")}
