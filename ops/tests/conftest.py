from __future__ import annotations

import base64
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import yaml

from airui_ops.http_client import HttpResponse, TransportError

TZ = ZoneInfo("Asia/Shanghai")
CANARY = "CANARY-SECRET-VALUE-9f3a2c"


class Clock:
    def __init__(self, when: datetime):
        self.when = when

    def __call__(self) -> datetime:
        return self.when


class FakeTransport:
    def __init__(self):
        self.calls = []
        self.handler = None

    def request(self, method, url, headers=None, body=None, timeout=10):
        self.calls.append({"method": method, "url": url, "headers": headers or {}, "body": body})
        if self.handler is None:
            raise TransportError("no handler")
        result = self.handler(method, url, headers or {}, body)
        if isinstance(result, Exception):
            raise result
        return result


def ok_json(payload: dict, status: int = 200) -> HttpResponse:
    import json
    return HttpResponse(status=status, body=json.dumps(payload).encode())


def aes_key() -> str:
    return base64.b64encode(os.urandom(32)).decode().rstrip("=")


def sample_config(**overrides) -> dict:
    cfg = {
        "company": {"name": "北京艾瑞见时科技有限公司", "icp_no": "京ICP备20260001号"},
        "host": {"public_ipv4": "203.0.113.10"},
        "timezone": "Asia/Shanghai",
        "transition_mode": False,
        "people": {
            "owner": "owner",
            "founder": "founder",
            "legal": "legal",
            "reviewer": "reviewer",
            "publisher": "publisher",
            "dev": "dev",
            "rollback": "rollback",
            "pro04": "pro04",
        },
        "wecom": {
            "corp_id": "ww1234567890abcd",
            "agent_id": 1000002,
            "submitter_userid": "openclaw-bot",
            "callback_url": "https://ops.example.cn/wecom/callback",
            "tpl": {
                "WECOM_TPL_CONTENT": "tpl-content",
                "WECOM_TPL_COMPLIANCE": "tpl-compliance",
                "WECOM_TPL_PROMOTION": "tpl-promotion",
                "WECOM_TPL_BUSINESS": "tpl-business",
                "WECOM_TPL_SWITCH": "tpl-switch",
                "WECOM_TPL_INCIDENT": "tpl-incident",
            },
            "controls": {kind: {"sha": f"{kind}-sha", "summary": f"{kind}-sum", "link": f"{kind}-link"} for kind in ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]},
        },
        "shunshi": {"api_base": "https://api.shunshi.example.cn"},
        "fenfaxia": {"api_base": "https://api.fenfa.example.cn"},
        "site": {"domains": ["www.example.cn"]},
        "preview": {"domain": "pkg.example.cn"},
        "channels": [{"product": "shunshi", "platform": "xiaohongshu", "account_name": "顺时节律", "tier": "B", "publisher": "publisher"}],
        "tier_a": {
            "website_seo": "on",
            "fenfaxia_template_pages": "off",
            "baidu_push": "on",
            "baidu_site": "https://www.example.cn",
            "in_app_cards": "on",
            "push_subscribed": "off",
            "email_opt_in": "off",
            "wecom_community": "off",
            "window": "08:00-21:30",
        },
        "content": {"pillars": {"shunshi": ["节气作息"]}},
        "assets": {"root": "/srv/airui-growth/assets"},
        "budget": {"ai_monthly_cny": {"openclaw": 1500}},
        "incident": {"oncall": "owner"},
        "gates": {"jianji": {"legal_signoff": False, "age_gate": False, "psychology_review_signoff": False, "resign_consent": False}},
        "models": {},
    }
    cfg.update(overrides)
    return cfg


def write_config(dirpath: Path, cfg: dict | None = None) -> Path:
    path = dirpath / "airui-growth.yaml"
    path.write_text(yaml.safe_dump(cfg or sample_config(), allow_unicode=True), encoding="utf-8")
    return path


def secret_lines(values: dict[str, str]) -> str:
    return "\n".join(f"{name}={value}" for name, value in values.items()) + "\n"


@pytest.fixture
def clock():
    return Clock(datetime(2026, 11, 2, 10, 0, tzinfo=TZ))
