from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")


def parse_hhmm(value: str) -> tuple[int, int]:
    hour, minute = value.strip().split(":")
    return int(hour), int(minute)


def in_window(now: datetime, window: str, tz=SHANGHAI) -> bool:
    """08:00–21:30 含两端整分。窗口外不自动发布。"""
    local = now.astimezone(tz)
    start_s, end_s = [part.strip() for part in window.split("-")]
    sh, sm = parse_hhmm(start_s)
    eh, em = parse_hhmm(end_s)
    minutes = local.hour * 60 + local.minute
    return sh * 60 + sm <= minutes <= eh * 60 + em


def deepseek_peak(now: datetime, tz=SHANGHAI) -> bool:
    """工作日 09:00–12:00、14:00–18:00。法定节假日豁免待核实，这里不减。"""
    local = now.astimezone(tz)
    if local.weekday() >= 5:
        return False
    minutes = local.hour * 60 + local.minute
    return (9 * 60 <= minutes < 12 * 60) or (14 * 60 <= minutes < 18 * 60)
