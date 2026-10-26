"""密钥只按变量名检查。权限不对时不读文件内容。任何返回值都不该被打印。"""

from __future__ import annotations

import os
import stat
from hashlib import sha256
from pathlib import Path

from airui_ops.wecom_crypto import WeComCrypto, WeComCryptoError

# (变量名, 依赖它的模块, 是否可选)
SECRET_SPECS = [
    ("WECOM_SECRET", "approval", False),
    ("WECOM_TOKEN", "approval", False),
    ("WECOM_AES_KEY", "approval", False),
    ("WECOM_WEBHOOK_KEY", "notify", False),
    ("DEEPSEEK_API_KEY", "draft", False),
    ("DASHSCOPE_API_KEY", "review", False),
    ("ARK_API_KEY", "image", False),
    ("KLING_ACCESS_KEY", "video", True),
    ("KLING_SECRET_KEY", "video", True),
    ("BAIDU_PUSH_TOKEN", "baidu_push", False),
    ("GROWTHBOOK_CLIENT_KEY", "experiments", True),
    ("UMAMI_API_TOKEN", "metrics", True),
    ("OPENCLAW_SHUNSHI_ADMIN_TOKEN", "publish_shunshi", False),
    ("OPENCLAW_FENFAXIA_API_TOKEN", "publish_fenfaxia", False),
    ("OPENCLAW_GITHUB_TOKEN", "gates_remote", True),
    ("PKG_PREVIEW_SIGNING_KEY", "package", False),
    ("WECHAT_MP_APPSECRET_SHUNSHI", "metrics_mp", True),
    ("WECHAT_MP_APPSECRET_FENFAXIA", "metrics_mp", True),
    ("DOUYIN_CLIENT_KEY", "metrics_douyin", True),
    ("DOUYIN_CLIENT_SECRET", "metrics_douyin", True),
]
FORBIDDEN_NAMES = {"FAL_KEY", "FAL_API_KEY", "OPENROUTER_API_KEY"}
SECRET_NAMES = [item[0] for item in SECRET_SPECS]


def _format_ok(name: str, value: str) -> tuple[bool, str]:
    if any(ch.isspace() for ch in value):
        return False, "含空白"
    if name == "WECOM_TOKEN":
        return (1 <= len(value) <= 32), "长度须为 1–32"
    if name == "WECOM_AES_KEY":
        if len(value) != 43:
            return False, "长度须为 43"
        try:
            crypto = WeComCrypto("preflight-token-placeholder", value, "receive-id")
            sample = "airui-preflight"
            if crypto.decrypt(crypto.encrypt(sample)) != sample:
                return False, "加解密往返失败"
        except WeComCryptoError:
            return False, "不是合法的 EncodingAESKey"
        return True, "加解密往返通过"
    if name == "PKG_PREVIEW_SIGNING_KEY":
        return len(value) >= 32, "长度须不少于 32"
    if name == "BAIDU_PUSH_TOKEN":
        # 百度普通收录没有试运行接口，联调前只做格式检查。
        return len(value) >= 8, "待核实：只做格式检查"
    if name.endswith("_KEY") or name.endswith("_TOKEN") or name.endswith("_SECRET") or "SECRET" in name:
        return len(value) >= 8, "长度不足"
    return len(value) >= 8, "长度不足"


def file_mode_ok(path: Path) -> tuple[bool, str]:
    mode = path.stat().st_mode
    perms = stat.S_IMODE(mode)
    if perms != 0o600:
        return False, "secrets 文件权限不是 600，已按缺失处理"
    if path.stat().st_uid != os.getuid():
        return False, "secrets 文件属主不是运行账户，已按缺失处理"
    return True, "权限 600"


def parse_secret_file(path: Path) -> dict[str, str]:
    """只在权限已通过后调用。不把行内容放进异常。"""
    found: dict[str, str] = {}
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"secrets 文件第 {lineno} 行格式无效")
        name, value = line.split("=", 1)
        name = name.strip()
        if not name or any(ch.isspace() for ch in value):
            raise ValueError(f"secrets 文件第 {lineno} 行格式无效")
        found[name] = value
    return found


def load_secret_values(path: Path | None, environ: dict | None = None) -> tuple[dict[str, str], list[dict]]:
    """返回 (可用值, 检查项)。检查项只有名字和状态，没有值。"""
    env = dict(os.environ if environ is None else environ)
    notes: list[dict] = []
    file_values: dict[str, str] = {}
    if path is not None:
        if not path.exists():
            notes.append({"name": str(path), "status": "missing", "detail": "secrets 文件不存在"})
        else:
            ok, detail = file_mode_ok(path)
            if not ok:
                notes.append({"name": path.name, "status": "invalid", "detail": detail})
                # 权限不对：不读取内容，环境变量里的同名密钥也不采用（避免把一份权限错误的副本当已配置）。
                env = {k: v for k, v in env.items() if k not in SECRET_NAMES and k not in FORBIDDEN_NAMES and "FAL" not in k and "OPENROUTER" not in k}
            else:
                file_values = parse_secret_file(path)
    merged = dict(env)
    merged.update(file_values)

    forbidden_present = []
    for name, value in list(merged.items()):
        upper = name.upper()
        if upper in FORBIDDEN_NAMES or upper.startswith("FAL_") or "OPENROUTER" in upper:
            if str(value or "").strip():
                forbidden_present.append(name)
    for name in forbidden_present:
        notes.append({"name": name, "status": "ignored_forbidden", "detail": "境外密钥，已忽略"})
        merged.pop(name, None)

    usable: dict[str, str] = {}
    present: dict[str, str] = {}
    for name, _module, optional in SECRET_SPECS:
        value = str(merged.get(name) or "")
        if not value:
            status = "optional_missing" if optional else "missing"
            notes.append({"name": name, "status": status, "detail": "未设置" if not optional else "可选，未设置"})
            continue
        ok, detail = _format_ok(name, value)
        if not ok:
            notes.append({"name": name, "status": "invalid", "detail": detail})
            continue
        present[name] = value
        notes.append({"name": name, "status": "present", "detail": "格式通过" if name != "BAIDU_PUSH_TOKEN" else "格式通过（待核实，未做真实推送）"})

    hashes: dict[str, list[str]] = {}
    for name, value in present.items():
        digest = sha256(value.encode("utf-8")).hexdigest()
        hashes.setdefault(digest, []).append(name)
    shared = {name for names in hashes.values() if len(names) > 1 for name in names}
    for name in shared:
        notes.append({"name": name, "status": "shared", "detail": "与另一密钥的值相同，按缺失处理"})
    for name, value in present.items():
        if name not in shared:
            usable[name] = value
    return usable, notes
