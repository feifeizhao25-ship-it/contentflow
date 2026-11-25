#!/usr/bin/env python3
"""共5：错误码对照表的语言，以及 CI 是否真的跑响应语言测试。

国内句子不能是成句英文。国际句子不能有汉字。白名单在
runtime/api/src/common/response-language-allow.txt。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "runtime/api/src/common/error-catalog.ts"
ALLOW = ROOT / "runtime/api/src/common/response-language-allow.txt"
WORKFLOW = ROOT / ".github/workflows/ci.yml"
CJK = re.compile(r"[\u3400-\u9fff]")
ENGLISH_SENTENCE = re.compile(r"[A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){2,}")


def allowlist() -> tuple[list[str], list[str]]:
    text = ALLOW.read_text(encoding="utf-8")
    token_part, _, han_part = text.partition("# han-allowed")
    def lines(part: str) -> list[str]:
        return [line.strip() for line in part.splitlines() if line.strip() and not line.strip().startswith("#")]
    return lines(token_part), lines(han_part)


def strip_tokens(value: str, tokens: list[str]) -> str:
    for token in tokens:
        value = value.replace(token, "")
    return value


def main() -> int:
    problems: list[str] = []
    tokens, han = allowlist()
    text = CATALOG.read_text(encoding="utf-8")
    rows = re.findall(r"zh:\s*'([^']*)',\s*en:\s*(?:'([^']*)'|\"([^\"]*)\")", text)
    if len(rows) < 8:
        problems.append(f"对照表只解析到 {len(rows)} 句，文件格式可能变了")
    for zh, en_single, en_double in rows:
        en = en_single or en_double
        if not CJK.search(zh) or ENGLISH_SENTENCE.search(strip_tokens(zh, tokens)):
            problems.append(f"中文句子不合格：{zh}")
        cleaned = en
        for item in han:
            cleaned = cleaned.replace(item, "")
        if CJK.search(cleaned):
            problems.append(f"英文句子含汉字：{en}")
    workflow = WORKFLOW.read_text(encoding="utf-8")
    if "响应语言：国内无成句英文，国际无汉字" not in workflow:
        problems.append("CI 没有「响应语言」这一步")
    if "response-language.spec.ts" not in workflow:
        problems.append("CI 没有运行 response-language.spec.ts")
    if problems:
        print("\n".join(problems))
        return 1
    print(f"响应语言检查通过：{len(rows)} 句对照，CI 会跑测试")
    return 0


if __name__ == "__main__":
    sys.exit(main())
