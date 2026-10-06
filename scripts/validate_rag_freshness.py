#!/usr/bin/env python3
"""Fail-closed freshness and provenance gate for ContentFlow RAG data."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAG_CACHE_DIRS = (
    PROJECT_ROOT / "runtime" / "api" / "data" / "rag_cache",
    PROJECT_ROOT / "services" / "ai-service" / "data" / "rag_cache",
    PROJECT_ROOT / "data" / "rag_cache",
)
METADATA_FILES = (
    PROJECT_ROOT / "services" / "ai-service" / "data" / "rag_metadata.json",
    PROJECT_ROOT / "data" / "rag_metadata.json",
)
DEFAULT_MAX_AGE_DAYS = 30
REMIND_DAYS = 5
warnings: list[str] = []
REQUIRED_FIELDS = {"source_url", "source_name", "published_at", "retrieved_at", "jurisdiction", "source_tier"}
ALLOWED_TIERS = {"S", "A", "B", "C", "D"}


def parse_time(value: object) -> datetime | None:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)


def load_metadata() -> dict[str, dict]:
    merged: dict[str, dict] = {}
    for path in METADATA_FILES:
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = payload.get("sources", payload) if isinstance(payload, dict) else payload
        if isinstance(records, list):
            for record in records:
                if isinstance(record, dict) and record.get("file"):
                    merged[str(record["file"])] = record
        elif isinstance(records, dict):
            merged.update({str(k): v for k, v in records.items() if isinstance(v, dict)})
    return merged


def validate(max_age_days: int, allow_empty: bool) -> list[str]:
    now = datetime.now(timezone.utc)
    metadata = load_metadata()
    files = sorted({path for directory in RAG_CACHE_DIRS if directory.is_dir() for path in directory.glob("*.json")})
    errors: list[str] = []
    approved_source_count = 0
    if not files:
        return [] if allow_empty else ["没有发现RAG缓存；生产发布必须提供经过审核的知识来源"]

    for path in files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.relative_to(PROJECT_ROOT)}: JSON无效（{exc}）")
            continue
        # Quarantined research is deliberately unavailable to production RAG.
        # It may use an aggregate schema while connector/reviewer evidence is
        # still incomplete, so it must neither count as an approved source nor
        # make the approved-source release gate fail.
        if isinstance(payload, dict) and str(payload.get("status", "")).startswith("quarantined"):
            continue
        approved_source_count += 1
        record = {**(metadata.get(path.name) or {}), **(payload if isinstance(payload, dict) else {})}
        missing = sorted(field for field in REQUIRED_FIELDS if not record.get(field))
        if missing:
            errors.append(f"{path.name}: 缺少来源字段 {', '.join(missing)}")
        url = str(record.get("source_url") or "")
        parsed_url = urlparse(url)
        if parsed_url.scheme != "https" or not parsed_url.netloc:
            errors.append(f"{path.name}: source_url必须是有效HTTPS地址")
        if record.get("source_tier") not in ALLOWED_TIERS:
            errors.append(f"{path.name}: source_tier必须为S/A/B/C/D")
        retrieved = parse_time(record.get("retrieved_at") or record.get("timestamp"))
        reviewer = str(record.get("reviewed_by") or "").strip()
        reviewed = parse_time(record.get("reviewed_at"))
        if record.get("reviewed_at") and not reviewer:
            errors.append(f"{path.name}: 填了 reviewed_at 却没有 reviewed_by——复核必须写明复核人，不能只改日期")
        if reviewed is not None and reviewed > now:
            errors.append(f"{path.name}: reviewed_at 位于未来")
        if retrieved is None:
            errors.append(f"{path.name}: retrieved_at格式无效")
        else:
            # 最近一次核对：有复核人且复核日期合理时取复核日期，否则取抓取日期（与线上 RagPolicyService 一致）
            checked = reviewed if (reviewer and reviewed is not None and retrieved <= reviewed <= now) else retrieved
            age_days = (now - checked).total_seconds() / 86400
            if age_days > max_age_days:
                how = "人工复核" if checked is reviewed else "抓取"
                errors.append(f"{path.name}: 已超过{max_age_days}天未更新（上次{how}：{(checked + timedelta(hours=8)).date().isoformat()}（北京时间），已 {int(age_days)} 天）")
            elif age_days > max_age_days - REMIND_DAYS:
                warnings.append(f"{path.name}: 还有 {max_age_days - int(age_days)} 天到期，请安排人工复核")
        published = parse_time(record.get("published_at"))
        if published and published > now:
            errors.append(f"{path.name}: published_at位于未来")
        if record.get("review_status") not in {"approved", "verified"}:
            errors.append(f"{path.name}: review_status必须为approved或verified")
    if approved_source_count == 0 and not allow_empty:
        errors.append("没有可供生产RAG使用的approved/verified来源")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS)
    parser.add_argument("--allow-empty", action="store_true", help="仅供没有RAG能力的本地开发环境")
    args = parser.parse_args()
    errors = validate(args.max_age_days, args.allow_empty)
    in_ci = os.environ.get("GITHUB_ACTIONS") == "true"
    for warning in warnings:
        print(f"::warning::{warning}" if in_ci else f"提醒：{warning}")
    if errors:
        print(f"RAG来源及时效门禁失败：{len(errors)}项")
        for error in errors:
            print(f"- {error}")
            if in_ci:
                print(f"::error::合规规则资料需要人工复核：{error}")
        print(FAILURE_EXPLANATION.format(max_age_days=args.max_age_days))
        return 1
    print("RAG来源及时效门禁通过")
    return 0


FAILURE_EXPLANATION = """
这是什么意思？
  分发侠给 AI 生成提供的「合规规则资料」（网信办标识办法、抖音 / B 站平台规范等，
  在 runtime/api/data/rag_cache/）超过 {max_age_days} 天没有人对照原文核对过。
  平台规则可能已经变了，所以线上已自动停止引用这些资料，界面会提示「合规规则资料需要人工复核」。

该怎么处理？
  1. 由负责合规的同事打开每条资料的 source_url，对照原文确认摘要（content）仍然准确；
  2. 原文没变：运行
       python3 scripts/review_rag_source.py --file <文件名> --reviewer "<复核人>" --confirm-original-checked
     会写入 reviewed_by / reviewed_at（复核人、复核时间），时效从复核时间重新计算；
  3. 原文变了：更新 content，并把 retrieved_at 改成重新抓取的日期，再提交审核。

不要做什么？
  不要只把 retrieved_at 改成今天来让检查通过——那等于声称核对过原文。
  没有复核人的 reviewed_at 也会被本检查拒绝。
"""


if __name__ == "__main__":
    sys.exit(main())
