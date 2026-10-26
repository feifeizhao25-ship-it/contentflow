"""开机自检。报告里只有变量名和有/缺/无效/待核实，没有值。"""

from __future__ import annotations

from airui_ops.config import (
    JIANJI_GATES,
    TPL_KEYS,
    approvers_for,
    as_bool,
    dig,
    filled,
    jianji_open,
    template_id,
    valid_agent_id,
    valid_https,
    valid_icp,
    valid_ipv4,
    valid_userid,
)
from airui_ops.killswitch import killed
from airui_ops.redact import scrub
from airui_ops.secrets import SECRET_SPECS

# 配置字段 → 不合格时关掉的模块
FIELD_CHECKS = [
    ("company.name", "公司全称", lambda v: filled(v), ["draft"]),
    ("company.icp_no", "ICP 备案号", valid_icp, ["approval", "package", "publish_tier_a"]),
    ("host.public_ipv4", "主机公网 IPv4", valid_ipv4, ["approval"]),
    ("people.owner", "本人 userid", valid_userid, ["approval"]),
    ("people.founder", "创始人 userid", valid_userid, ["approval"]),
    ("people.legal", "法务 userid", valid_userid, ["approval"]),
    ("people.reviewer", "审阅人 userid", valid_userid, ["approval"]),
    ("people.publisher", "发布执行人 userid", valid_userid, ["publish_tier_b"]),
    ("people.dev", "研发 userid", valid_userid, ["approval"]),
    ("people.rollback", "回滚权限人 userid", valid_userid, ["approval"]),
    ("wecom.corp_id", "企业 ID", lambda v: isinstance(v, str) and v.strip().startswith("ww"), ["approval"]),
    ("wecom.agent_id", "AgentId", valid_agent_id, ["approval"]),
    ("wecom.submitter_userid", "提交人 userid", valid_userid, ["approval"]),
    ("wecom.callback_url", "回调地址", valid_https, ["approval", "publish_tier_a", "publish_tier_b"]),
    ("shunshi.api_base", "顺时 API", valid_https, ["publish_shunshi"]),
    ("fenfaxia.api_base", "分发侠 API", valid_https, ["publish_fenfaxia"]),
    ("preview.domain", "发布包域名", filled, ["package"]),
    ("site.domains", "对外域名", filled, ["publish_tier_a"]),
    ("assets.root", "素材目录", filled, ["image", "video"]),
    ("content.pillars", "内容支柱", filled, ["draft"]),
    ("budget.ai_monthly_cny.openclaw", "OpenClaw 月预算", lambda v: isinstance(v, (int, float)) and v >= 0, ["draft", "image", "video"]),
    ("incident.oncall", "值班人", valid_userid, ["incident"]),
]


def run_preflight(config: dict, secret_notes: list[dict], usable: dict[str, str], kill_file, environ=None) -> dict:
    checks = []
    off: set[str] = set()

    for path, label, check, modules in FIELD_CHECKS:
        value = dig(config, path)
        ok = False
        try:
            ok = bool(check(value))
        except Exception:
            ok = False
        checks.append({"name": path, "label": label, "status": "ok" if ok else "missing", "detail": "有" if ok else "缺或格式无效"})
        if not ok:
            off.update(modules)

    for key in TPL_KEYS:
        ok = bool(template_id(config, key))
        checks.append({"name": key, "label": key, "status": "ok" if ok else "missing", "detail": "有" if ok else "缺"})
        if not ok:
            off.add("approval")

    controls = (config.get("wecom") or {}).get("controls") or {}
    if not isinstance(controls, dict) or not any(isinstance(v, dict) and any(v.values()) for v in controls.values()):
        checks.append({"name": "wecom.controls", "label": "模板控件 id", "status": "unverified", "detail": "待核实：未填控件 id 时 OA 提交会失败并按未批准处理"})
    else:
        checks.append({"name": "wecom.controls", "label": "模板控件 id", "status": "ok", "detail": "有"})

    submitter = str((config.get("wecom") or {}).get("submitter_userid") or "")
    for kind in ("P1", "P2", "P4", "P6", "P7"):
        approvers = approvers_for(config, kind, "shunshi")
        if submitter and submitter in approvers:
            checks.append({"name": f"approver.{kind}", "label": f"{kind} 审批人", "status": "invalid", "detail": "提交人不能在审批组里"})
            off.add("approval")

    secret_status = {}
    for note in secret_notes:
        name = note["name"]
        secret_status.setdefault(name, note["status"])
        checks.append({"name": name, "label": name, "status": note["status"], "detail": note["detail"]})

    def secret_ready(name: str) -> bool:
        return name in usable

    for name, module, optional in SECRET_SPECS:
        if optional:
            continue
        if not secret_ready(name):
            off.add(module)

    if not secret_ready("DEEPSEEK_API_KEY") and not secret_ready("DASHSCOPE_API_KEY"):
        off.update(["plan", "research", "draft"])
    elif not secret_ready("DEEPSEEK_API_KEY"):
        checks.append({"name": "draft.fallback", "label": "写稿", "status": "degraded", "detail": "缺 DEEPSEEK_API_KEY，规划可切千问；写稿改走方舟（若有 ARK_API_KEY）"})
    if not secret_ready("DASHSCOPE_API_KEY"):
        off.add("review")
        off.add("rag_embed")
    if not secret_ready("ARK_API_KEY"):
        checks.append({"name": "image.fallback", "label": "图片/视频", "status": "degraded", "detail": "缺 ARK_API_KEY：图片改用百炼或 HTML 模板，视频只出脚本"})
    if not secret_ready("WECOM_SECRET") or not secret_ready("WECOM_TOKEN") or not secret_ready("WECOM_AES_KEY"):
        off.update(["approval", "publish_tier_a", "publish_tier_b"])
    if not secret_ready("WECOM_WEBHOOK_KEY"):
        off.add("notify")
    if not secret_ready("PKG_PREVIEW_SIGNING_KEY"):
        off.add("package")
    if not secret_ready("BAIDU_PUSH_TOKEN"):
        off.add("baidu_push")
    if not secret_ready("OPENCLAW_SHUNSHI_ADMIN_TOKEN"):
        off.add("publish_shunshi")
    if not secret_ready("OPENCLAW_FENFAXIA_API_TOKEN"):
        off.add("publish_fenfaxia")

    gates = dig(config, "gates.jianji") or {}
    gate_report = []
    for name in JIANJI_GATES:
        flag = as_bool(gates.get(name)) if isinstance(gates, dict) else False
        gate_report.append({"name": name, "status": "ok" if flag else "closed"})
    jianji = "open" if jianji_open(config) else "closed"
    if jianji != "open":
        off.add("publish_jianji")

    window = str((config.get("tier_a") or {}).get("window") or "08:00-21:30")
    is_killed = killed(kill_file, environ)
    checks.append({"name": "kill_switch", "label": "急停", "status": "halted" if is_killed else "ok", "detail": "急停生效" if is_killed else "未急停"})
    checks.append({"name": "quiet_hours", "label": "自动发布窗口", "status": "ok", "detail": window})
    if as_bool(config.get("transition_mode")):
        checks.append({"name": "transition_mode", "label": "过渡模式", "status": "on", "detail": "只备 B 档，A 档不自动发布"})
        off.add("publish_tier_a")

    if "approval" in off:
        off.update(["publish_tier_a", "publish_tier_b"])

    modules = {
        "preflight": _mod("preflight", off),
        "plan": _mod("plan", off),
        "research": _mod("research", off),
        "draft": _mod("draft", off),
        "review": _mod("review", off),
        "image": "degraded" if "image.fallback" in {c["name"] for c in checks} and "image" not in off else _mod("image", off),
        "video": "off" if not secret_ready("ARK_API_KEY") else _mod("video", off),
        "approval": _mod("approval", off),
        "package": _mod("package", off),
        "publish_tier_a": _mod("publish_tier_a", off),
        "publish_tier_b": _mod("publish_tier_b", off),
        "baidu_push": _mod("baidu_push", off),
        "notify": _mod("notify", off),
        "publish_shunshi": _mod("publish_shunshi", off),
        "publish_fenfaxia": _mod("publish_fenfaxia", off),
        "publish_jianji": "blocked" if jianji != "open" else "on",
    }
    report = {
        "modules": modules,
        "checks": checks,
        "secrets": [{"name": n["name"], "status": n["status"]} for n in secret_notes],
        "jianji_gates": gate_report,
        "jianji": jianji,
        "killed": is_killed,
        "window": window,
        "transition_mode": as_bool(config.get("transition_mode")),
    }
    return report


def _mod(name: str, off: set[str]) -> str:
    return "off" if name in off else "on"


def render_report(report: dict, secrets: list[str]) -> str:
    lines = ["【就绪报告】"]
    labels = {
        "draft": "研究/写稿",
        "review": "评审/RAG",
        "image": "图片",
        "video": "视频",
        "approval": "审批通道",
        "notify": "群通知",
        "baidu_push": "百度推送",
        "publish_tier_a": "A 档发布",
        "package": "发布包页面",
        "publish_jianji": "见己",
    }
    for key, label in labels.items():
        state = report["modules"].get(key, "off")
        mark = {"on": "✔", "off": "✖", "degraded": "◐", "blocked": "C"}.get(state, "✖")
        lines.append(f"{mark} {label}：{state}")
    open_gates = sum(1 for item in report["jianji_gates"] if item["status"] == "ok")
    lines.append(f"见己闸门 {open_gates}/4")
    if report["killed"]:
        lines.append("急停生效：全部外发已停止")
    text = "\n".join(lines)
    return scrub(text, secrets)
