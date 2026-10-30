#!/usr/bin/env python3
"""Verify CN/INT language separation for web, mobile, and optional live pages.

The contract is intentionally simple:
- INT runtime defaults to English only and should not leak Chinese in source
  files outside non-runtime locale archives.
- Mobile INT English values should not contain Chinese.
- CN should visibly contain Chinese on the landing page when a live URL is given.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.error import URLError, HTTPError
from urllib.request import urlopen


CJK_RE = re.compile(r"[\u4e00-\u9fff]")
ROOT = Path(__file__).resolve().parents[1]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def scan_int_source() -> list[dict[str, object]]:
    # runtime/web-int is the production image build context.  The historical
    # apps/INT-Web tree is incomplete and must not be used as a release gate.
    base = ROOT / "runtime/web-int/src"
    allowed_parts = {
        ("i18n", "locales", "zh.json"),
        ("i18n", "locales", "ja.json"),
        ("i18n", "locales", "ko.json"),
    }
    findings: list[dict[str, object]] = []
    for path in base.rglob("*"):
      if not path.is_file() or path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".json", ".md"}:
          continue
      rel = path.relative_to(base)
      if tuple(rel.parts[-3:]) in allowed_parts:
          continue
      text = read_text(path)
      for line_no, line in enumerate(text.splitlines(), 1):
          if CJK_RE.search(line):
              findings.append({"file": str(path.relative_to(ROOT)), "line": line_no, "text": line.strip()[:160]})
    return findings


def check_int_locale_lock() -> list[str]:
    layout = ROOT / "runtime/web-int/src/app/layout.tsx"
    text = read_text(layout)
    issues: list[str] = []
    if not re.search(r"<html\s+lang=[\"']en(?:-[A-Za-z]+)?[\"']", text):
        issues.append("Production INT-Web root HTML language is not locked to English.")
    return issues


def check_mobile_en_values() -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for edition in ("android-global", "ios-global"):
        base = ROOT / edition / "lib"
        for path in base.rglob("*.dart"):
            for line_no, line in enumerate(read_text(path).splitlines(), 1):
                if CJK_RE.search(line):
                    findings.append({
                        "key": f"{path.relative_to(ROOT)}:{line_no}",
                        "value": line.strip()[:160],
                    })
    return findings


def check_cn_dart_visible_english() -> list[str]:
    """国内版 Flutter（android-cn / ios-cn）里不得出现会显示给用户的英文。

    规则与白名单见 scripts/verify_zh_ui_dart.py、scripts/zh_ui_allow.json。
    """
    import subprocess

    here = Path(__file__).resolve().parent
    proc = subprocess.run(
        [sys.executable, str(here / "verify_zh_ui_dart.py"), "--app", "android-cn", "--app", "ios-cn",
         "--allow", str(here / "zh_ui_allow.json")],
        capture_output=True, text=True, cwd=str(here.parent),
    )
    if proc.returncode == 0:
        return []
    return [line for line in (proc.stdout + proc.stderr).splitlines() if line.strip()]


def fetch(url: str) -> tuple[bool, str]:
    try:
        with urlopen(url, timeout=10) as resp:
            return True, resp.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        return False, str(exc)


def live_checks(cn_base: str | None, int_base: str | None) -> dict[str, object]:
    checks: dict[str, object] = {}
    if int_base:
        ok, body = fetch(int_base.rstrip("/") + "/")
        checks["int_landing_fetch_ok"] = ok
        checks["int_landing_has_cjk"] = bool(CJK_RE.search(body)) if ok else None
        if not ok:
            checks["int_landing_error"] = body
    if cn_base:
        ok, body = fetch(cn_base.rstrip("/") + "/")
        checks["cn_landing_fetch_ok"] = ok
        checks["cn_landing_has_cjk"] = bool(CJK_RE.search(body)) if ok else None
        if not ok:
            checks["cn_landing_error"] = body
    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cn-base", default=None, help="Optional live CN base URL, e.g. http://127.0.0.1:3100")
    parser.add_argument("--int-base", default=None, help="Optional live INT base URL, e.g. http://127.0.0.1:3101")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    args = parser.parse_args()

    result = {
        "int_source_cjk_findings": scan_int_source(),
        "int_locale_lock_issues": check_int_locale_lock(),
        "mobile_en_value_cjk_findings": check_mobile_en_values(),
        "cn_dart_visible_english": check_cn_dart_visible_english(),
        "live": live_checks(args.cn_base, args.int_base),
    }

    failures: list[str] = []
    if result["int_source_cjk_findings"]:
        failures.append("INT source contains CJK outside allowed locale archives.")
    if result["int_locale_lock_issues"]:
        failures.append("INT locale lock is not strict.")
    if result["mobile_en_value_cjk_findings"]:
        failures.append("Mobile English locale values contain CJK.")
    if result["cn_dart_visible_english"]:
        failures.append("CN Flutter UI contains user-visible English (see cn_dart_visible_english).")
    live = result["live"]
    if live.get("int_landing_has_cjk") is True:
        failures.append("INT landing HTML contains CJK.")
    if args.cn_base and live.get("cn_landing_has_cjk") is False:
        failures.append("CN landing HTML does not contain CJK.")

    result["passed"] = not failures
    result["failures"] = failures

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("Language Contract Verification")
        print(f"  INT source CJK findings: {len(result['int_source_cjk_findings'])}")
        print(f"  INT locale lock issues: {len(result['int_locale_lock_issues'])}")
        print(f"  Mobile EN value CJK findings: {len(result['mobile_en_value_cjk_findings'])}")
        print(f"  CN Flutter visible-English lines: {len(result['cn_dart_visible_english'])}")
        for line in result["cn_dart_visible_english"][:40]:
            print("   ", line)
        if live:
            print(f"  Live: {json.dumps(live, ensure_ascii=False)}")
        print("  Result:", "PASS" if result["passed"] else "FAIL")
        for failure in failures:
            print("   -", failure)

    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
