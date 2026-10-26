"""每天 07:40 的运行：自检、备稿、审批、只在条件满足时发 A 档。"""

from __future__ import annotations

from airui_ops.calendar_data import items_for
from airui_ops.content import compliance_check
from airui_ops.hub import Hub
from airui_ops.killswitch import killed


def run_daily(hub: Hub) -> dict:
    hub.reload()
    text = hub.preflight_text()
    hub.post_report()
    if killed(hub.kill_file, hub.environ):
        hub.audit.append({"action": "daily_halted", "reason": "kill_switch"})
        return {"halted": True, "report": text, "created": [], "published": []}
    day = hub.now().date()
    created = []
    published = []
    approval_on = hub.report["modules"].get("approval") == "on"
    for item in items_for(day):
        if item["product"] == "jianji":
            continue
        body = f"{item['theme']}\n\n这条是给 {item['platform']} 的草稿。请发布执行人补一句自己的看法。"
        ok, reason = compliance_check(item["product"], body)
        if not ok:
            hub.audit.append({"action": "discarded", "reason": reason, "product": item["product"]})
            continue
        account = ""
        for channel in hub.config.get("channels") or []:
            if channel.get("product") == item["product"] and channel.get("platform") == item["platform"]:
                account = str(channel.get("account_name") or "")
                break
        if item["tier"] == "B":
            if hub.report["modules"].get("package") != "on":
                hub.audit.append({"action": "package_skipped", "reason": "package_module_off"})
                continue
            package = hub.packages.create(item["product"], item["platform"], account, item["theme"], body, ["艾瑞见时"], [])
            created.append(package["id"])
            content = package["content"]
            if approval_on and not hub.report["transition_mode"]:
                hub.approval.submit("P1", item["product"], content, preview_url=package["url"])
            elif hub.report["transition_mode"]:
                hub.audit.append({"action": "transition_notify_only", "package": package["id"]})
        else:
            content = {
                "product": item["product"],
                "channel": item["channel"],
                "title": item["theme"],
                "body": body,
                "url": f"https://{(hub.config.get('preview') or {}).get('domain') or 'preview.invalid'}/{item['channel']}",
            }
            from airui_ops.content import apply_aigc
            content["body"] = apply_aigc(item["product"], content["body"])
            if approval_on and not hub.report["transition_mode"]:
                record = hub.approval.submit("P1", item["product"], content)
                if record.get("status") == "approved":
                    result = hub.publisher.publish(item["product"], "A", item["channel"], content, record, needs_p2=True)
                    published.append(result)
            else:
                hub.audit.append({"action": "tier_a_held", "channel": item["channel"], "reason": "no_approval_channel"})
    hub.audit.append({"action": "daily_done", "created": len(created)})
    return {"halted": False, "report": text, "created": created, "published": published}
