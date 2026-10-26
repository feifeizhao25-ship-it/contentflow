"""内容哈希、AIGC 标识、合规闸。合规词表写在代码里，不能被配置关掉。"""

from __future__ import annotations

import hashlib
import json
import re

AIGC_TEXT = {
    "shunshi": "本内容由人工智能生成。",
    "fenfaxia": "【本内容由 AI 生成】",
    "jianji": "本内容由人工智能辅助生成，发布前须由真人确认。",
}
SHUNSHI_DISCLAIMER = "仅供作息安排参考，不是医疗诊断或治疗建议。"

# 命中即丢弃。配置可以追加，不能删除这些词。
BANNED = {
    "shunshi": ("诊断", "疗效", "治疗", "剂量", "可长期服用", "体质诊断"),
    "fenfaxia": ("全平台全自动发布", "过AI检测", "过 AI 检测", "去AI味", "去 AI 味", "洗稿", "降重"),
    "jianji": ("命理", "占卜", "星座", "预测", "心理咨询", "心理治疗"),
}
CJK_RUN = re.compile(r"[\u4e00-\u9fff]{12,}")


def content_sha256(payload) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def apply_aigc(product: str, body: str) -> str:
    label = AIGC_TEXT.get(product, AIGC_TEXT["fenfaxia"])
    text = body or ""
    if label not in text:
        text = text.rstrip() + "\n\n" + label
    if product == "shunshi" and SHUNSHI_DISCLAIMER not in text:
        text = text.rstrip() + "\n" + SHUNSHI_DISCLAIMER
    return text


def aigc_ok(product: str, body: str) -> bool:
    label = AIGC_TEXT.get(product, "")
    if not label or label not in (body or ""):
        return False
    if product == "shunshi" and SHUNSHI_DISCLAIMER not in body:
        return False
    return True


def compliance_check(product: str, body: str, sources: list[str] | None = None, extra_words: list[str] | None = None) -> tuple[bool, str]:
    text = body or ""
    words = list(BANNED.get(product, ()))
    words.extend(extra_words or [])
    folded = text.replace(" ", "")
    for word in words:
        if word and word.replace(" ", "") in folded:
            return False, f"命中禁用词：{word}"
    for source in sources or []:
        for run in CJK_RUN.findall(source or ""):
            if run[:12] in text:
                return False, "12字复制检查未通过"
    return True, ""
