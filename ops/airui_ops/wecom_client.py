"""企业微信自建应用客户端。access_token 只留在内存。群机器人接口不在这里。"""

from __future__ import annotations

import json
import time
from typing import Callable

from airui_ops.http_client import ApiError, HttpResponse, Transport, TransportError
from airui_ops.redact import redact_url

API = "https://qyapi.weixin.qq.com/cgi-bin"


class WeComUnavailable(Exception):
    pass


class WeComClient:
    def __init__(self, corp_id: str, secret: str, agent_id: str, transport: Transport, now: Callable[[], float] | None = None):
        self.corp_id = corp_id
        self.secret = secret
        self.agent_id = str(agent_id)
        self.transport = transport
        self.now = now or time.time
        self._token = ""
        self._exp = 0.0

    def _get(self, path: str) -> dict:
        try:
            resp = self.transport.request("GET", f"{API}{path}", timeout=10)
        except TransportError as exc:
            raise WeComUnavailable(redact_url(str(exc))) from exc
        return self._ok(resp, unavailable=True)

    def _post(self, path: str, payload: dict, unavailable: bool = False) -> dict:
        token = self.access_token()
        url = f"{API}{path}?access_token={token}"
        try:
            resp = self.transport.request(
                "POST",
                url,
                headers={"Content-Type": "application/json"},
                body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                timeout=10,
            )
        except TransportError as exc:
            raise WeComUnavailable(redact_url(str(exc))) from exc
        return self._ok(resp, unavailable=unavailable)

    def _ok(self, resp: HttpResponse, unavailable: bool) -> dict:
        if resp.status >= 500 or resp.status == 0:
            raise WeComUnavailable(f"http {resp.status}")
        try:
            data = resp.json()
        except Exception as exc:
            raise WeComUnavailable("invalid json") from exc
        err = int(data.get("errcode") or 0)
        if err != 0:
            if unavailable or err in {40001, 40014, 42001, 41001}:
                raise WeComUnavailable(f"errcode {err}")
            raise ApiError(err, str(data.get("errmsg") or ""))
        return data

    def access_token(self) -> str:
        if self._token and self.now() < self._exp - 60:
            return self._token
        if not self.corp_id or not self.secret:
            raise WeComUnavailable("missing corp credentials")
        data = self._get(f"/gettoken?corpid={self.corp_id}&corpsecret={self.secret}")
        token = str(data.get("access_token") or "")
        if not token:
            raise WeComUnavailable("empty access_token")
        self._token = token
        self._exp = self.now() + int(data.get("expires_in") or 7200)
        return token

    def applyevent(self, creator: str, template_id: str, summary: str, fields: list[tuple[str, str]]) -> str:
        contents = []
        for control_id, text in fields:
            if not control_id:
                continue
            contents.append({"control": "Text", "id": control_id, "value": {"text": text[:500]}})
        if not contents:
            raise ApiError(400, "template control ids missing")
        data = self._post(
            "/oa/applyevent",
            {
                "creator_userid": creator,
                "template_id": template_id,
                "use_template_approver": 1,
                "apply_data": {"contents": contents},
                "summary_list": [{"summary_info": [{"text": summary[:60], "lang": "zh_CN"}]}],
            },
        )
        sp_no = str(data.get("sp_no") or "")
        if not sp_no:
            raise WeComUnavailable("empty sp_no")
        return sp_no

    def getapprovaldetail(self, sp_no: str) -> dict:
        data = self._post("/oa/getapprovaldetail", {"sp_no": sp_no}, unavailable=True)
        info = data.get("info") or {}
        if not info:
            raise WeComUnavailable("empty approval detail")
        return info

    def getapprovalinfo(self, start: int, end: int, template_id: str = "") -> list[str]:
        payload: dict = {"starttime": start, "endtime": end, "new_cursor": "", "size": 100}
        if template_id:
            payload["filters"] = [{"key": "template_id", "value": template_id}]
        data = self._post("/oa/getapprovalinfo", payload, unavailable=True)
        return [str(item) for item in (data.get("sp_no_list") or [])]

    def send_template_card(self, touser: str, task_id: str, title: str, description: str, url: str) -> None:
        """单人按钮卡片。不能用于会签，调用方必须先确认只有一位审批人。"""
        self._post(
            "/message/send",
            {
                "touser": touser,
                "msgtype": "template_card",
                "agentid": int(self.agent_id) if str(self.agent_id).isdigit() else self.agent_id,
                "template_card": {
                    "card_type": "button_interaction",
                    "task_id": task_id,
                    "main_title": {"title": title[:26]},
                    "sub_title_text": description[:100],
                    "button_list": [
                        {"text": "通过", "style": 1, "key": "approve", "type": 1, "url": url},
                        {"text": "驳回", "style": 3, "key": "reject"},
                    ],
                    "card_action": {"type": 1, "url": url},
                },
            },
        )


def notify_webhook(transport: Transport, webhook_key: str, markdown: str) -> bool:
    """群机器人只发通知。返回是否送达。调用方不得据此改审批状态。"""
    if not webhook_key:
        return False
    url = f"{API}/webhook/send?key={webhook_key}"
    try:
        resp = transport.request(
            "POST",
            url,
            headers={"Content-Type": "application/json"},
            body=json.dumps({"msgtype": "markdown", "markdown": {"content": markdown[:4000]}}, ensure_ascii=False).encode("utf-8"),
            timeout=10,
        )
    except TransportError:
        return False
    try:
        data = resp.json()
    except Exception:
        return False
    return int(data.get("errcode") or 0) == 0
