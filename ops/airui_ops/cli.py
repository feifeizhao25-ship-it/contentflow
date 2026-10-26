"""OpenClaw 调用的入口：ops preflight / ops run daily / ops status。"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from airui_ops.daily import run_daily
from airui_ops.hub import Hub
from airui_ops.redact import scrub


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ops")
    parser.add_argument("--config", default=os.environ.get("AIRUI_CONFIG", "/etc/airui-growth/airui-growth.yaml"))
    parser.add_argument("--secrets", default=os.environ.get("AIRUI_SECRETS_FILE", ""))
    parser.add_argument("--data", default=os.environ.get("AIRUI_DATA_DIR", "/var/lib/airui-growth"))
    sub = parser.add_subparsers(dest="cmd", required=True)

    pre = sub.add_parser("preflight")
    pre.add_argument("--report", choices=["text", "wecom", "json"], default="text")

    run = sub.add_parser("run")
    run.add_argument("job", choices=["daily"])

    sub.add_parser("status")
    sub.add_parser("reconcile")
    srv = sub.add_parser("serve")
    srv.add_argument("--host", default="127.0.0.1")
    srv.add_argument("--port", type=int, default=8080)

    args = parser.parse_args(argv)
    config = Path(args.config)
    if not config.exists():
        sys.stderr.write("配置文件不存在\n")
        return 2
    secrets = Path(args.secrets) if args.secrets else None
    try:
        hub = Hub(config, Path(args.data), secrets)
    except Exception as exc:
        sys.stderr.write(scrub(f"启动失败：{exc.__class__.__name__}\n", []))
        return 2

    if args.cmd == "preflight":
        if args.report == "json":
            sys.stdout.write(json.dumps({"modules": hub.report["modules"], "jianji": hub.report["jianji"], "killed": hub.report["killed"]}, ensure_ascii=False) + "\n")
        else:
            sys.stdout.write(hub.preflight_text() + "\n")
            if args.report == "wecom":
                hub.post_report()
        return 0
    if args.cmd == "status":
        sys.stdout.write(json.dumps(hub.status(), ensure_ascii=False) + "\n")
        return 0
    if args.cmd == "reconcile":
        updated = hub.approval.reconcile()
        sys.stdout.write(json.dumps({"updated": len(updated), "wecom_ok": hub.approval.wecom_ok}, ensure_ascii=False) + "\n")
        return 0
    if args.cmd == "run":
        result = run_daily(hub)
        sys.stdout.write(result["report"] + "\n")
        sys.stdout.write(json.dumps({"halted": result["halted"], "created": len(result["created"])}, ensure_ascii=False) + "\n")
        return 0
    if args.cmd == "serve":
        from airui_ops.server import serve
        serve(hub, args.host, args.port)
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
