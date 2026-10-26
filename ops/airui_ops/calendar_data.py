"""2026-11-02 至 11-29 的四周排期。见己不在表里。日历从审批通道可用那天起执行，之前只存草稿。"""

from __future__ import annotations

from datetime import date, timedelta

# 周一到周日的平台。与文档 05 四周表一致。
SHUNSHI = [
    ["xiaohongshu"],
    ["channels"],
    ["xiaohongshu"],
    ["zhihu"],
    ["douyin", "xiaohongshu"],
    ["channels"],
    ["wechat_mp", "douyin"],
]
FENFAXIA = [
    ["wechat_mp"],
    ["xiaohongshu"],
    ["zhihu"],
    ["channels", "bilibili"],
    ["xiaohongshu"],
    ["douyin"],
    [],
]
TIER_A = [
    [("fenfaxia", "fenfaxia_template_pages"), ("fenfaxia", "baidu_push")],
    [("shunshi", "website_seo"), ("shunshi", "baidu_push")],
    [("shunshi", "baidu_push"), ("shunshi", "wecom_community_broadcast")],
    [("fenfaxia", "fenfaxia_template_pages"), ("fenfaxia", "baidu_push"), ("fenfaxia", "wecom_community_broadcast")],
    [("shunshi", "website_seo"), ("shunshi", "baidu_push")],
    [("shunshi", "baidu_push"), ("shunshi", "wecom_community_broadcast")],
    [("shunshi", "baidu_push")],
]
THEMES = [
    ("立冬作息准备：天黑早了怎么调整记录", "AIGC 标识新规：发布前必查 5 件事"),
    ("冬季晨起与午休：用记录看自己的节律", "双十一内容日历：一稿多平台怎么适配"),
    ("小雪 · 一周作息复盘模板", "小红书/公众号新规下的人机协作发布流程"),
    ("月度节律复盘：四周记录怎么看", "月末数据复盘 + 模板页上新"),
]
START = date(2026, 11, 2)


def items_for(day: date) -> list[dict]:
    if day < START or day > date(2026, 11, 29):
        return []
    offset = (day - START).days
    week = offset // 7
    weekday = offset % 7
    shun_theme, fen_theme = THEMES[week]
    rows = []
    for platform in SHUNSHI[weekday]:
        rows.append({"date": day.isoformat(), "product": "shunshi", "platform": platform, "tier": "B", "theme": shun_theme, "channel": platform})
    for platform in FENFAXIA[weekday]:
        rows.append({"date": day.isoformat(), "product": "fenfaxia", "platform": platform, "tier": "B", "theme": fen_theme, "channel": platform})
    for product, channel in TIER_A[weekday]:
        theme = shun_theme if product == "shunshi" else fen_theme
        rows.append({"date": day.isoformat(), "product": product, "platform": channel, "tier": "A", "theme": theme, "channel": channel})
    return rows


def upcoming(start: date, days: int = 7) -> list[dict]:
    rows = []
    for i in range(days):
        rows.extend(items_for(start + timedelta(days=i)))
    return rows
