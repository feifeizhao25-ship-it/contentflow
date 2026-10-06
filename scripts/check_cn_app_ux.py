#!/usr/bin/env python3
"""国内 App（android-cn / ios-cn）的静态门禁。

云端 / 本检查环境没有 Flutter SDK，Dart 单测（test/error_text_test.dart）要在装了 Flutter 的 CI 上跑；
这里先在源码层守住三件事：
  1. 不把原始异常直接上屏（Text('加载失败: $e')、'$error'、e.toString()）；
  2. 「我的 / 设置」页有「隐私政策」「注销账号」入口；
  3. 注销调用后端已有的 POST /users/me/delete-account。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPS = ("android-cn", "ios-cn")
RAW_ERROR = re.compile(r"""Text\(\s*['"][^'"]*\$\{?(?:e|error|err)\b|e\.toString\(\)|error\.toString\(\)""")

errors: list[str] = []
for app in APPS:
    lib = ROOT / app / "lib"
    for dart in sorted(lib.rglob("*.dart")):
        for no, line in enumerate(dart.read_text(encoding="utf-8").splitlines(), 1):
            if line.strip().startswith("//"):
                continue
            if RAW_ERROR.search(line):
                errors.append(f"{dart.relative_to(ROOT)}:{no}: 原始异常直接上屏：{line.strip()[:80]}")
    account = (lib / "features/account/account_screen.dart").read_text(encoding="utf-8")
    for needed in ("'隐私政策'", "'注销账号'", "AppConfig.privacyUrl", "deleteAccount("):
        if needed not in account:
            errors.append(f"{app}: 我的页面缺少 {needed}")
    client = (lib / "data/api_client.dart").read_text(encoding="utf-8")
    if "'/users/me/delete-account'" not in client:
        errors.append(f"{app}: ApiClient 没有调用后端注销接口 /users/me/delete-account")
    if not (lib / "core/error_text.dart").is_file():
        errors.append(f"{app}: 缺少错误中文映射 lib/core/error_text.dart")

if errors:
    print("国内 App 门禁失败：")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)
print("国内 App 门禁通过：无原始异常上屏，有隐私政策与注销入口")
