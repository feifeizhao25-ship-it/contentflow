#!/usr/bin/env python3
"""Fail-closed validation for the production revenue/operations contract."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "ops" / "revenue-operations.json"
REQUIRED_EVENTS = {
    "landing_viewed", "content_generated", "content_published",
    "checkout_started", "payment_succeeded", "subscription_renewed",
    "subscription_cancelled",
}
REQUIRED_GATES = {
    "production_build", "language_isolation", "security_scan", "billing_live_mode",
    "payment_webhook", "analytics_ingestion", "privacy_and_terms",
    "platform_policy_check", "backup_restore", "rollback", "slo_monitoring",
}


def main() -> int:
    data = json.loads(CONFIG.read_text())
    errors: list[str] = []
    target = data.get("annual_revenue_target")
    modeled = sum(
        row["customers"] * row["annual_revenue_per_customer"]
        for row in data.get("revenue_model", [])
    )
    if target != 100_000_000:
        errors.append("annual_revenue_target must be USD 100,000,000")
    if modeled < target:
        errors.append(f"revenue model totals only USD {modeled:,}")
    missing_events = REQUIRED_EVENTS - set(data.get("funnel_events", []))
    missing_gates = REQUIRED_GATES - set(data.get("release_gates", []))
    if missing_events:
        errors.append(f"missing funnel events: {sorted(missing_events)}")
    if missing_gates:
        errors.append(f"missing release gates: {sorted(missing_gates)}")
    hours = data.get("automation", {}).get("maximum_recurring_human_hours_per_week", 999)
    if hours > 20:
        errors.append("recurring human operations exceed 20 hours/week")
    print(json.dumps({"target": target, "modeled": modeled, "errors": errors}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
