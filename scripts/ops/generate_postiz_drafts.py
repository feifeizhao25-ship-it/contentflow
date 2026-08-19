#!/usr/bin/env python3
"""Generate review-only Postiz draft payloads for the international launch.

This script never calls the Postiz API. It writes JSON and CSV files that an
operator or OpenClaw workflow can inspect, enrich with real integration IDs,
and submit as `type: "draft"` after approval.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "artifacts" / "ops" / "postiz-drafts-2026-07-23"


CHANNELS = {
    "x": {"settings": {"__type": "x", "made_with_ai": True, "paid_partnership": False}},
    "linkedin": {"settings": {"__type": "linkedin"}},
    "instagram": {"settings": {"__type": "instagram", "post_type": "post"}},
    "tiktok": {
        "settings": {
            "__type": "tiktok",
            "privacy_level": "PUBLIC_TO_EVERYONE",
            "duet": False,
            "stitch": False,
            "comment": True,
            "autoAddMusic": False,
            "brand_content_toggle": False,
            "brand_organic_toggle": True,
            "content_posting_method": "DIRECT_POST",
        }
    },
    "youtube": {"settings": {"__type": "youtube", "title": "Draft", "type": "short"}},
}


def draft(product: str, channel: str, day_offset: int, content: str, title: str | None = None) -> dict:
    publish_at = datetime.now(timezone.utc) + timedelta(days=day_offset, hours=3)
    settings = dict(CHANNELS[channel]["settings"])
    if channel == "youtube" and title:
        settings["title"] = title[:100]
    return {
        "product": product,
        "channel": channel,
        "review_status": "needs_human_review",
        "postiz_payload": {
            "type": "draft",
            "date": publish_at.isoformat().replace("+00:00", "Z"),
            "shortLink": False,
            "tags": [{"value": product}, {"value": "openclaw"}, {"value": "launch"}],
            "posts": [
                {
                    "integration": {"id": f"REPLACE_WITH_{channel.upper()}_INTEGRATION_ID"},
                    "value": [{"content": content, "image": []}],
                    "settings": settings,
                }
            ],
        },
    }


CONTENTFLOW_DRAFTS = [
    (
        "x",
        "Most social teams do not need more drafts. They need a safer operating system: one idea, platform-native adaptations, review gates, scheduled publishing, and feedback that teaches the next batch. ContentFlow is being built around that loop. #AIContentOps",
        "ContentFlow operating loop",
    ),
    (
        "linkedin",
        "Content operations are moving from ad-hoc creation to governed systems.\n\nThe teams that win in 2026 will separate five jobs:\n1. Source evidence\n2. Preserve brand voice\n3. Adapt per platform\n4. Review before publishing\n5. Learn from performance data\n\nContentFlow is designed as that operating layer for global teams.",
        "Content operations are becoming governed systems",
    ),
    (
        "instagram",
        "Carousel concept: The 5-layer AI content ops stack.\n\n1. Research\n2. Voice profile\n3. Platform adaptation\n4. Human review\n5. Performance learning\n\nSave this before your next weekly content planning session.",
        "The 5-layer AI content ops stack",
    ),
    (
        "tiktok",
        "Hook: Your content calendar is not the bottleneck. Your feedback loop is.\n\nShow: raw idea -> TikTok hook -> LinkedIn post -> review queue -> analytics insight.\n\nCTA: Follow for practical AI content ops workflows.",
        "Your content calendar is not the bottleneck",
    ),
]

ENERGYIQ_DRAFTS = [
    (
        "linkedin",
        "Energy intelligence should separate facts from analysis.\n\nA useful market brief needs:\n- source date\n- region\n- project type\n- confidence level\n- policy dependency\n- what changed since the last brief\n\nEnergyIQ is designed for teams that need readable, cited, decision-ready energy context.",
        "Energy intelligence should separate facts from analysis",
    ),
    (
        "x",
        "Clean energy content fails when it sounds certain about uncertain systems. Better pattern: cite the source, name the assumption, explain the operating implication, and mark what needs weekly refresh. That is the editorial contract EnergyIQ is built around.",
        "EnergyIQ editorial contract",
    ),
    (
        "youtube",
        "Short script: Three questions before trusting an energy forecast. 1) What is the source date? 2) Which region and grid constraint does it assume? 3) Which claim is fact versus analysis? EnergyIQ turns that checklist into a briefing workflow.",
        "Three questions before trusting an energy forecast",
    ),
    (
        "instagram",
        "Carousel concept: Fact vs Analysis in energy market briefs.\n\nFact: sourced, dated, directly observed.\nAnalysis: implication, scenario, or recommendation.\n\nIf your report mixes them, your team cannot audit decisions later.",
        "Fact vs Analysis in energy market briefs",
    ),
]


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    drafts = []
    for idx, (channel, content, title) in enumerate(CONTENTFLOW_DRAFTS, 1):
        item = draft("ContentFlow", channel, idx, content, title)
        drafts.append(item)
    for idx, (channel, content, title) in enumerate(ENERGYIQ_DRAFTS, 1):
        item = draft("EnergyIQ", channel, idx + 1, content, title)
        drafts.append(item)

    json_path = OUT_DIR / "postiz-draft-payloads.json"
    csv_path = OUT_DIR / "postiz-draft-review-queue.csv"
    json_path.write_text(json.dumps(drafts, indent=2, ensure_ascii=False))

    with csv_path.open("w", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["product", "channel", "review_status", "date", "content"],
        )
        writer.writeheader()
        for item in drafts:
            payload = item["postiz_payload"]
            rows.append(
                {
                    "product": item["product"],
                    "channel": item["channel"],
                    "review_status": item["review_status"],
                    "date": payload["date"],
                    "content": payload["posts"][0]["value"][0]["content"],
                }
            )
        writer.writerows(rows)

    print(json.dumps({"json": str(json_path), "csv": str(csv_path), "drafts": len(drafts)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())