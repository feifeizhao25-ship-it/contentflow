#!/usr/bin/env python3
"""Fail-closed freshness and provenance gate for ContentFlow RAG data."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
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
    if not files:
        return [] if allow_empty else ["没有发现RAG缓存；生产发布必须提供经过审核的知识来源"]

    for path in files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.relative_to(PROJECT_ROOT)}: JSON无效（{exc}）")
            continue
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
        if retrieved is None:
            errors.append(f"{path.name}: retrieved_at格式无效")
        elif (now - retrieved).total_seconds() > max_age_days * 86400:
            errors.append(f"{path.name}: 已超过{max_age_days}天未更新")
        published = parse_time(record.get("published_at"))
        if published and published > now:
            errors.append(f"{path.name}: published_at位于未来")
        if record.get("review_status") not in {"approved", "verified"}:
            errors.append(f"{path.name}: review_status必须为approved或verified")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS)
    parser.add_argument("--allow-empty", action="store_true", help="仅供没有RAG能力的本地开发环境")
    args = parser.parse_args()
    errors = validate(args.max_age_days, args.allow_empty)
    if errors:
        print(f"RAG来源及时效门禁失败：{len(errors)}项")
        for error in errors:
            print(f"- {error}")
        return 1
    print("RAG来源及时效门禁通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
