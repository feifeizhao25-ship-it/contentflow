#!/usr/bin/env python3
"""登记一次合规规则资料的人工复核（写入 reviewed_by / reviewed_at）。

用法（复核人先打开资料里的 source_url，对照原文确认 content 仍然准确）：
  python3 scripts/review_rag_source.py --file cac-ai-content-labeling-2025.json \
      --reviewer "合规专员 张某" --confirm-original-checked

规则：
  - 必须写明复核人，必须加 --confirm-original-checked 声明已对照原文；
  - 只写 reviewed_by / reviewed_at，不改 retrieved_at、不改 content；
  - 原文已经变了就不要用本脚本：请更新 content 并把 retrieved_at 改为重新抓取的日期。
线上（RagPolicyService）与 CI（validate_rag_freshness.py）都按「有复核人的复核时间」重新计算时效。
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAG_DIR = Path(__file__).resolve().parents[1] / "runtime" / "api" / "data" / "rag_cache"
CHINA = timezone(timedelta(hours=8))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="登记合规规则资料的人工复核")
    parser.add_argument("--file", required=True, help="rag_cache 下的资料文件名")
    parser.add_argument("--reviewer", required=True, help="复核人（姓名或工号）")
    parser.add_argument("--confirm-original-checked", action="store_true", help="声明已打开 source_url 对照原文核对过 content")
    parser.add_argument("--dir", default=str(RAG_DIR), help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    reviewer = args.reviewer.strip()
    if not reviewer:
        print("复核人不能为空", file=sys.stderr)
        return 2
    if not args.confirm_original_checked:
        print("请先打开资料的 source_url 对照原文核对，确认无误后加 --confirm-original-checked 再运行。", file=sys.stderr)
        return 2
    path = Path(args.dir) / Path(args.file).name
    if not path.is_file():
        print(f"找不到资料文件：{path}", file=sys.stderr)
        return 2
    record = json.loads(path.read_text(encoding="utf-8"))
    print(f"资料：{record.get('source_name')}\n原文：{record.get('source_url')}\n抓取：{record.get('retrieved_at')}")
    record["reviewed_by"] = reviewer
    record["reviewed_at"] = datetime.now(CHINA).replace(microsecond=0).isoformat()
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已登记复核：{reviewer}，{record['reviewed_at']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
