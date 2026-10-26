"""读取 03 配置总表导出的 YAML。文件里不得有密钥。"""

from __future__ import annotations

import ipaddress
import re
from pathlib import Path

import yaml

ICP_RE = re.compile(r"ICP备.+号")
USERID_RE = re.compile(r"^[A-Za-z0-9_\-@.]{1,64}$")
TPL_KEYS = (
    "WECOM_TPL_CONTENT",
    "WECOM_TPL_COMPLIANCE",
    "WECOM_TPL_PROMOTION",
    "WECOM_TPL_BUSINESS",
    "WECOM_TPL_SWITCH",
    "WECOM_TPL_INCIDENT",
)
KIND_TEMPLATE = {
    "P1": "WECOM_TPL_CONTENT",
    "P2": "WECOM_TPL_BUSINESS",
    "P3": "WECOM_TPL_COMPLIANCE",
    "P4": "WECOM_TPL_PROMOTION",
    "P5": "WECOM_TPL_BUSINESS",
    "P6": "WECOM_TPL_SWITCH",
    "P7": "WECOM_TPL_INCIDENT",
}
# 模板卡片只允许单人审批的节点。P2/P6/P7 以及见己 P1（加心理学审校）是会签。
SINGLE_APPROVER_KINDS = {"P1", "P3", "P4", "P5"}
JIANJI_GATES = ("legal_signoff", "age_gate", "psychology_review_signoff", "resign_consent")
STOP_WORDS = ("停止所有操作", "急停", "PAUSE")
TIER_B_PLATFORMS = ("xiaohongshu", "wechat_mp", "channels", "zhihu", "douyin", "bilibili", "aso_store_copy")
NEVER_AUTOMATE = ("xiaohongshu", "wechat_mp", "channels", "zhihu", "bilibili", "douyin")
BANNED_TOOLS = (
    "xiaohongshu-mcp",
    "XiaohongshuSkills",
    "social-auto-upload",
    "MediaCrawler",
)


def load_yaml(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError("config root must be a mapping")
    return data


def dig(cfg: dict, path: str):
    cur = cfg
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"on", "true", "1", "yes"}
    return False


def filled(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return len(value) > 0
    return True


def valid_userid(value) -> bool:
    return isinstance(value, str) and bool(USERID_RE.match(value.strip()))


def valid_ipv4(value) -> bool:
    try:
        return isinstance(value, str) and ipaddress.ip_address(value.strip()).version == 4
    except ValueError:
        return False


def valid_https(value) -> bool:
    return isinstance(value, str) and value.strip().startswith("https://") and " " not in value.strip()


def valid_icp(value) -> bool:
    return isinstance(value, str) and bool(ICP_RE.search(value))


def valid_agent_id(value) -> bool:
    return isinstance(value, (int, str)) and str(value).strip().isdigit() and int(str(value)) > 0


def template_id(cfg: dict, key: str) -> str:
    tpl = dig(cfg, "wecom.tpl") or {}
    if isinstance(tpl, dict):
        return str(tpl.get(key) or "").strip()
    return ""


def approvers_for(cfg: dict, kind: str, product: str) -> list[str]:
    people = cfg.get("people") or {}
    mapping = {
        "P1": [people.get("reviewer")],
        "P2": [people.get("founder"), people.get("legal")],
        "P3": [people.get("legal")],
        "P4": [people.get("owner")],
        "P5": [people.get("founder")],
        "P6": [people.get("owner"), people.get("dev")],
        "P7": [people.get("owner"), people.get("rollback")],
    }
    names = [str(item).strip() for item in mapping.get(kind, []) if str(item or "").strip()]
    if kind == "P1" and product == "jianji" and str(people.get("pro04") or "").strip():
        names.append(str(people["pro04"]).strip())
    # 去重并保持顺序
    seen = []
    for name in names:
        if name not in seen:
            seen.append(name)
    return seen


def jianji_open(cfg: dict) -> bool:
    gates = dig(cfg, "gates.jianji") or {}
    if not isinstance(gates, dict):
        return False
    return all(as_bool(gates.get(name)) for name in JIANJI_GATES)


def switch_value(cfg: dict, channel: str) -> bool:
    tier = cfg.get("tier_a") or {}
    aliases = {
        "website_seo": "website_seo",
        "fenfaxia_template_pages": "fenfaxia_template_pages",
        "baidu_push": "baidu_push",
        "in_app_cards": "in_app_cards",
        "push_subscribed": "push_subscribed",
        "miniprogram_subscribe_msg": "push_subscribed",
        "email_opt_in": "email_opt_in",
        "wecom_community_broadcast": "wecom_community",
        "wecom_community": "wecom_community",
    }
    key = aliases.get(channel, channel)
    return as_bool(tier.get(key))
