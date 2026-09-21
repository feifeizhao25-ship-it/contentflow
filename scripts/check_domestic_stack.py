#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""门禁：国内栈只接境内模型与境内数据服务。

## 为什么要有这个文件

2026-09-21 定的口径：**国内版只接国内的模型和数据库。**
这条口径如果只写在文档里，下一个人加一行环境变量就破了，而且不会报错。

当时的实际状态：

  · `api-cn` 与 `web-cn` 都注入了 `OPENROUTER_API_KEY`；
    `AIService` 的判断是 `if (this.openRouterApiKey)` —— 只要有这把 key
    就走 openrouter.ai，**代码里没有任何一处知道"这是国内栈"**。
  · `web-cn/src/lib/supabase-server.ts` 在 production 下没有 Supabase 配置
    就直接 throw，而 `getTenantId()` 从 Supabase 的 `profiles` 表读租户。
  · `web-cn/src/app/api/ai/tts/` 下同时存在 azure / elevenlabs / openai
    三个境外 TTS 路由。

配置层已经改了，代码层也加了 `market-routing.ts` 的边界。
这个门禁是第三道：**让回归变成一次 CI 失败，而不是一次数据出境。**

## 规则

1. compose 里被判定为"国内服务"的，不得出现境外供应商的环境变量名，
   也不得在变量值里出现境外主机名。
2. 名字标明是国内的 `.env*.example` 同样适用。
3. `--source-roots` 指定的国内前端/后端源码目录里，不得 import 境外
   供应商 SDK，也不得出现境外主机名。

"国内服务"的判定：服务名以 `-cn` 结尾，或环境里有
`MARKET_REGION/MARKET/NEXT_PUBLIC_APP_EDITION` 且值为 cn，
或者文件名里带 `.cn.` / `cn.` 前缀。

## 例外

确有理由的例外写进 `scripts/domestic_stack_allowlist.json`：

    {"allow": [{"where": "runtime/docker-compose.production.yml::api-cn",
                "what": "SENTRY_DSN",
                "why": "自建 Sentry，域名在境内"}]}

**必须写 why。** 没有理由的例外等于没有门禁。

## 用法

    python3 scripts/check_domestic_stack.py
    python3 scripts/check_domestic_stack.py --source-roots runtime/web-cn/src
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("需要 PyYAML：pip install pyyaml")

REPO = pathlib.Path(__file__).resolve().parent.parent
ALLOWLIST = REPO / "scripts" / "domestic_stack_allowlist.json"

SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "vendor-refs", "__pycache__"}

# ── 境外供应商 ────────────────────────────────────────────────────────
# 变量名前缀 → 说明。命中即视为把国内栈接到了境外服务。
OFFSHORE_VAR_PREFIXES: dict[str, str] = {
    "OPENROUTER": "OpenRouter（境外模型聚合路由）",
    "OPENAI": "OpenAI",
    "ANTHROPIC": "Anthropic",
    "GEMINI": "Google Gemini",
    "MISTRAL": "Mistral",
    "COHERE": "Cohere",
    "GROQ": "Groq",
    "TOGETHER_": "Together AI",
    "PERPLEXITY": "Perplexity",
    "XAI_": "xAI",
    "FAL_": "fal.ai（境外推理）",
    "ELEVENLABS": "ElevenLabs（境外 TTS）",
    "AZURE_SPEECH": "Azure 语音（境外）",
    "SUPABASE": "Supabase（境外托管数据库 / BaaS）",
    "FIREBASE": "Firebase",
    "PLANETSCALE": "PlanetScale",
    "NEON_": "Neon",
    "UPSTASH": "Upstash",
    "MONGODB_ATLAS": "MongoDB Atlas",
    "VERCEL_BLOB": "Vercel Blob",
    "STRIPE": "Stripe（境外收单）",
    "AIRWALLEX": "Airwallex（境外收单）",
    "SENDGRID": "SendGrid",
    "TWILIO": "Twilio",
}

# 值或源码里出现这些主机名，同样算接到了境外
OFFSHORE_HOSTS = [
    "openrouter.ai", "api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com",
    "api.mistral.ai", "api.cohere.ai", "api.groq.com", "api.together.xyz", "api.x.ai",
    "fal.run", "api.elevenlabs.io", "cognitiveservices.azure.com",
    "supabase.co", "supabase.in", "firebaseio.com", "googleapis.com",
    "api.stripe.com", "api.airwallex.com", "api.sendgrid.com", "api.twilio.com",
    "amazonaws.com", "planetscale.com", "neon.tech", "upstash.io",
]

# 源码里 import 这些包，同样算
OFFSHORE_MODULES = [
    "@supabase/supabase-js", "@supabase/ssr", "@supabase/auth-helpers",
    "openai", "@anthropic-ai/sdk", "@google/generative-ai", "@google-cloud/",
    "firebase", "firebase-admin", "stripe", "@stripe/",
    "elevenlabs", "@azure/cognitiveservices", "microsoft-cognitiveservices-speech-sdk",
    "@aws-sdk/", "aws-sdk", "@fal-ai/",
]

IMPORT_RE = re.compile(r"""(?:from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]""")
CN_MARKET_KEYS = {"MARKET_REGION", "MARKET", "NEXT_PUBLIC_APP_EDITION", "APP_EDITION"}
CN_MARKET_VALUES = {"cn", "china", "zh-cn", "domestic"}


def load_allowlist() -> set[tuple[str, str]]:
    if not ALLOWLIST.exists():
        return set()
    data = json.loads(ALLOWLIST.read_text(encoding="utf-8"))
    out = set()
    for item in data.get("allow", []):
        if not str(item.get("why", "")).strip():
            raise SystemExit(f"例外缺少 why：{item}。没有理由的例外等于没有门禁。")
        out.add((str(item["where"]), str(item["what"])))
    return out


def offshore_var(name: str) -> str | None:
    upper = name.upper()
    for prefix, label in OFFSHORE_VAR_PREFIXES.items():
        if upper.startswith(prefix):
            return label
    return None


def offshore_host(value: str) -> str | None:
    lowered = value.lower()
    for host in OFFSHORE_HOSTS:
        if host in lowered:
            return host
    return None


def env_pairs(svc: dict) -> list[tuple[str, str]]:
    env = svc.get("environment")
    if isinstance(env, dict):
        return [(str(k), str(v)) for k, v in env.items()]
    if isinstance(env, list):
        out = []
        for item in env:
            k, _, v = str(item).partition("=")
            out.append((k, v))
        return out
    return []


def is_domestic_service(name: str, pairs: list[tuple[str, str]], file_is_cn: bool) -> bool:
    if name.endswith("-cn") or name.endswith("_cn"):
        return True
    for key, value in pairs:
        if key.upper() in CN_MARKET_KEYS and value.strip().strip("'\"").lower() in CN_MARKET_VALUES:
            return True
    # 整个文件就是国内栈时，没有 -int/-global 后缀的服务都算
    if file_is_cn and not (name.endswith("-int") or name.endswith("-global")):
        return True
    return False


def check_compose(path: pathlib.Path, allow: set[tuple[str, str]]) -> list[str]:
    rel = str(path.relative_to(REPO))
    problems: list[str] = []
    try:
        doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        return [f"{rel}: YAML 解析失败：{exc}"]

    name = path.name.lower()
    file_is_cn = ".cn." in name or name.startswith("cn.") or "-cn." in name

    for svc_name, svc in (doc.get("services") or {}).items():
        if not isinstance(svc, dict):
            continue
        pairs = env_pairs(svc)
        if not is_domestic_service(svc_name, pairs, file_is_cn):
            continue
        where = f"{rel}::{svc_name}"
        for key, value in pairs:
            if (where, key) in allow:
                continue
            label = offshore_var(key)
            if label:
                problems.append(f"{where}: 国内服务注入了 {key}（{label}）")
                continue
            host = offshore_host(value)
            if host:
                problems.append(f"{where}: 国内服务的 {key} 指向境外主机 {host}")
    return problems


def check_env_example(path: pathlib.Path, allow: set[tuple[str, str]]) -> list[str]:
    name = path.name.lower()
    if not (".cn" in name or "cn." in name or "domestic" in name):
        return []
    rel = str(path.relative_to(REPO))
    problems: list[str] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        if (rel, key) in allow:
            continue
        label = offshore_var(key)
        if label:
            problems.append(f"{rel}:{lineno}: 国内样例里有 {key}（{label}）")
            continue
        host = offshore_host(value)
        if host:
            problems.append(f"{rel}:{lineno}: 国内样例的 {key} 指向境外主机 {host}")
    return problems


def check_source_root(root: pathlib.Path, allow: set[tuple[str, str]]) -> list[str]:
    problems: list[str] = []
    if not root.is_dir():
        return [f"{root}: 指定的源码目录不存在"]
    for path in sorted(root.rglob("*")):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".py"}:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        rel = str(path.relative_to(REPO))
        text = path.read_text(encoding="utf-8", errors="replace")
        seen: set[str] = set()
        for spec in IMPORT_RE.findall(text):
            for module in OFFSHORE_MODULES:
                if (spec == module or spec.startswith(module)) and module not in seen:
                    if (rel, module) in allow:
                        continue
                    seen.add(module)
                    problems.append(f"{rel}: 国内源码 import 了境外服务 SDK `{spec}`")
        for host in OFFSHORE_HOSTS:
            if host in text and (rel, host) not in allow:
                problems.append(f"{rel}: 国内源码里出现境外主机 {host}")
                break
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--source-roots",
        nargs="*",
        default=[],
        help="国内版源码目录（相对仓库根），例如 runtime/web-cn/src",
    )
    args = ap.parse_args()

    allow = load_allowlist()
    problems: list[str] = []
    scanned = 0

    for path in sorted(REPO.rglob("docker-compose*.y*ml")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        scanned += 1
        problems += check_compose(path, allow)

    for pattern in (".env*.example", "env*.example"):
        for path in sorted(REPO.rglob(pattern)):
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            scanned += 1
            problems += check_env_example(path, allow)

    for root_name in args.source_roots:
        problems += check_source_root(REPO / root_name, allow)

    if problems:
        print(f"✗ 国内栈接到了境外服务，{len(problems)} 处：\n")
        for p in problems:
            print(f"  - {p}")
        print(
            "\n口径：国内版只接国内的模型和数据库。"
            "\n确有理由的例外写进 scripts/domestic_stack_allowlist.json（必须写 why）。"
        )
        return 1

    print(f"✓ 扫描 {scanned} 个配置文件与 {len(args.source_roots)} 个源码目录：国内栈未接境外服务")
    return 0


if __name__ == "__main__":
    sys.exit(main())
