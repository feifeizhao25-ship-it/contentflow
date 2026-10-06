#!/usr/bin/env python3
"""validate_rag_freshness.py 与 review_rag_source.py 的回归测试（只用标准库）。

  python3 scripts/test_rag_review_flow.py
"""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


gate = load("validate_rag_freshness")
review = load("review_rag_source")
failures = 0


def check(name, fn):
    global failures
    try:
        fn()
        print(f"  PASS {name}")
    except AssertionError as exc:
        failures += 1
        print(f"  FAIL {name}: {exc}")


def assert_(cond, msg="条件不成立"):
    if not cond:
        raise AssertionError(msg)


NOW = datetime.now(timezone.utc)
BASE = {
    "id": "a", "source_url": "https://www.cac.gov.cn/policy", "source_name": "官方资料",
    "published_at": "2025-03-14T00:00:00+08:00", "jurisdiction": "CN", "source_tier": "S",
    "review_status": "verified", "platforms": ["all"], "topics": ["all"], "content": "摘要",
}


def run_gate(record: dict) -> list[str]:
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "a.json").write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
        gate.RAG_CACHE_DIRS = (Path(tmp),)
        gate.METADATA_FILES = ()
        gate.warnings.clear()
        return gate.validate(30, False)


def iso(days_ago: float) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat()


print("RAG review flow tests")
check("抓取 44 天、未复核 → 失败", lambda: assert_(any("已超过30天未更新" in e for e in run_gate({**BASE, "retrieved_at": iso(44), "reviewed_by": None, "reviewed_at": None}))))
check("抓取 44 天、3 天前有复核人复核 → 通过", lambda: assert_(run_gate({**BASE, "retrieved_at": iso(44), "reviewed_by": "张某", "reviewed_at": iso(3)}) == []))
check("只改复核日期、不写复核人 → 失败，并说明必须写复核人", lambda: assert_(any("reviewed_by" in e for e in run_gate({**BASE, "retrieved_at": iso(44), "reviewed_by": "", "reviewed_at": iso(1)}))))
check("复核日期在未来 → 失败", lambda: assert_(any("未来" in e for e in run_gate({**BASE, "retrieved_at": iso(10), "reviewed_by": "张某", "reviewed_at": iso(-3)}))))
check("距到期 ≤ 5 天 → 通过但给提醒", lambda: (assert_(run_gate({**BASE, "retrieved_at": iso(27), "reviewed_by": None, "reviewed_at": None}) == []), assert_(any("到期" in w for w in gate.warnings))))


def failure_explanation_is_chinese():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "a.json").write_text(json.dumps({**BASE, "retrieved_at": iso(44)}, ensure_ascii=False), encoding="utf-8")
        gate.RAG_CACHE_DIRS = (Path(tmp),)
        out = io.StringIO()
        sys.argv = ["validate_rag_freshness.py"]
        with redirect_stdout(out):
            rc = gate.main()
        text = out.getvalue()
        assert rc == 1, rc
        for phrase in ("这是什么意思", "该怎么处理", "review_rag_source.py", "不要只把 retrieved_at 改成今天"):
            assert phrase in text, f"缺少说明：{phrase}"


check("失败时给出中文说明（是什么、怎么处理、不要做什么）", failure_explanation_is_chinese)


def review_script_requires_confirmation_and_reviewer():
    with tempfile.TemporaryDirectory() as tmp:
        Path(tmp, "a.json").write_text(json.dumps({**BASE, "retrieved_at": iso(44), "reviewed_by": None, "reviewed_at": None}), encoding="utf-8")
        with redirect_stdout(io.StringIO()):
            assert review.main(["--file", "a.json", "--reviewer", "张某", "--dir", tmp]) == 2
            assert review.main(["--file", "a.json", "--reviewer", "  ", "--confirm-original-checked", "--dir", tmp]) == 2
            assert review.main(["--file", "a.json", "--reviewer", "张某", "--confirm-original-checked", "--dir", tmp]) == 0
        record = json.loads(Path(tmp, "a.json").read_text(encoding="utf-8"))
        assert record["reviewed_by"] == "张某"
        assert record["retrieved_at"] == iso(44) or record["retrieved_at"].startswith(iso(44)[:10]), "不得改动 retrieved_at"
        assert record["reviewed_at"]


check("复核脚本：必须声明已对照原文、必须写复核人；只写复核字段，不改抓取日期", review_script_requires_confirmation_and_reviewer)


if failures:
    print(f"{failures} 项失败")
    sys.exit(1)
print("All RAG review flow tests passed")
