#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""门禁：compose 里的 tmpfs 路径与"出网能力"必须自洽。

## 为什么要有这个文件

2026-09-21 复查 `runtime/docker-compose.production.yml`，两处问题都属于
"YAML 语法上完全合法、跑起来才炸"的类型，评审时很难一眼看出来。

### 一、tmpfs 写成了流式序列

    tmpfs: [/tmp:size=128m,mode=1777, /app/.next/cache:size=128m,mode=1777]

流式序列里**逗号是元素分隔符**，实际解析成四个元素：

    ["/tmp:size=128m", "mode=1777", "/app/.next/cache:size=128m", "mode=1777"]

第二、四个元素让 Docker 去把 tmpfs 挂到名为 `mode=1777` 的路径上——
不是绝对路径，容器创建直接失败。四个应用容器一个都起不来。

### 二、所有服务都只挂在 internal 网络上

`cn-backend` 与 `int-backend` 都是 `internal: true`，而每个服务
（**包括 gateway**）都只挂在这两个里面。internal 网络没有 NAT 出口：

  · gateway 连不上 Let's Encrypt → ACME 失败，站点拿不到证书
  · api-* 连不上模型供应商 → 生成请求全失败
  · api-cn 连不上 openapi.alipay.com / 微信支付 → 付款全线不通
  · PUBLISH_DISPATCH_WEBHOOK_URL 发不出去 → 分发派单静默失败

"外面进不来"靠的是不 publish 端口；`internal` 管的是"里面出不去"。
两件事被混在了一起。

## 规则

1. 每个 tmpfs 元素必须以 `/` 开头。
2. 服务若配置了指向公网的变量（https:// 地址、已知供应商的 API Key），
   则它挂的网络里至少要有一个不是 internal。
3. 反向代理 / 网关服务必须能出网（ACME 需要）。

## 用法

    python3 scripts/check_compose_egress.py
"""
from __future__ import annotations

import pathlib
import re
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("需要 PyYAML：pip install pyyaml")

REPO = pathlib.Path(__file__).resolve().parent.parent

GATEWAY_NAMES = {"gateway", "caddy", "nginx", "traefik", "proxy"}

# 出现这些变量名 ⇒ 该服务要访问公网
EGRESS_VAR = re.compile(
    r"(OPENROUTER|OPENAI|ANTHROPIC|GEMINI|DEEPSEEK|QWEN|DASHSCOPE|GLM|KIMI|DOUBAO|"
    r"SILICONFLOW|ALIPAY|WECHAT_PAY|STRIPE|AIRWALLEX|SENDGRID|SMTP|TWILIO|SENTRY|"
    r"WEBHOOK_URL|NOTIFY_URL)",
)
# 指向公网的地址（排除容器内部地址）
PUBLIC_URL = re.compile(r"https?://(?!127\.0\.0\.1|localhost|[a-z0-9-]+:\d+)", re.I)


def iter_env(svc: dict):
    env = svc.get("environment")
    if isinstance(env, dict):
        yield from ((str(k), str(v)) for k, v in env.items())
    elif isinstance(env, list):
        for item in env:
            k, _, v = str(item).partition("=")
            yield k, v


def service_networks(svc: dict) -> list[str]:
    nets = svc.get("networks")
    if isinstance(nets, dict):
        return list(nets.keys())
    if isinstance(nets, list):
        return [str(n) for n in nets]
    return []


def check_file(path: pathlib.Path) -> list[str]:
    rel = path.relative_to(REPO)
    problems: list[str] = []
    try:
        doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        return [f"{rel}: YAML 解析失败：{exc}"]

    networks = doc.get("networks") or {}

    def is_internal(name: str) -> bool:
        cfg = networks.get(name) or {}
        return bool(isinstance(cfg, dict) and cfg.get("internal"))

    for name, svc in (doc.get("services") or {}).items():
        if not isinstance(svc, dict):
            continue

        # ── 1. tmpfs 必须是绝对路径 ────────────────────────────────
        tmpfs = svc.get("tmpfs")
        entries = [tmpfs] if isinstance(tmpfs, str) else list(tmpfs or [])
        for entry in entries:
            if not str(entry).startswith("/"):
                problems.append(
                    f"{rel}: 服务 {name} 的 tmpfs 元素 {entry!r} 不是绝对路径。"
                    f"多半是把 tmpfs 写成了流式序列 [a,b]——里面的逗号会被当成"
                    f"元素分隔符，要改成块序列（每项一行、以 - 开头）。"
                )

        # ── 2 & 3. 出网能力 ───────────────────────────────────────
        nets = service_networks(svc)
        if not nets:
            continue
        has_egress = any(not is_internal(n) for n in nets)
        if has_egress:
            continue

        if name.lower() in GATEWAY_NAMES:
            problems.append(
                f"{rel}: 网关服务 {name} 只挂在 internal 网络 {nets} 上，无法出网。"
                f"ACME 证书签发需要访问 CA，会直接失败。"
            )
            continue

        reasons = []
        for key, value in iter_env(svc):
            if EGRESS_VAR.search(key):
                reasons.append(key)
            elif PUBLIC_URL.search(value):
                reasons.append(key)
        if reasons:
            uniq = sorted(set(reasons))[:6]
            problems.append(
                f"{rel}: 服务 {name} 只挂在 internal 网络 {nets} 上，却配置了需要"
                f"出网的变量 {uniq}。internal 网络没有 NAT 出口，这些调用会全部失败。"
                f"（挡住外部访问靠的是不 publish 端口，不是 internal。）"
            )

    return problems


def main() -> int:
    files = [
        p
        for p in REPO.rglob("docker-compose*.y*ml")
        if not any(part in {"node_modules", ".git"} for part in p.parts)
    ]
    if not files:
        print("没有找到 docker-compose 文件")
        return 0

    problems: list[str] = []
    for path in sorted(files):
        problems += check_file(path)

    if problems:
        print(f"✗ {len(problems)} 处问题：\n")
        for p in problems:
            print(f"  - {p}")
        return 1

    print(f"✓ {len(files)} 个 compose 文件：tmpfs 路径合法，需要出网的服务都能出网")
    return 0


if __name__ == "__main__":
    sys.exit(main())
