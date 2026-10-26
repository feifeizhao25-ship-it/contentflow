"""急停：环境变量、标志文件、急停词。任一成立即停止全部外发。"""

from __future__ import annotations

import os
from pathlib import Path

from airui_ops.config import STOP_WORDS


def env_killed(environ: dict | None = None) -> bool:
    env = os.environ if environ is None else environ
    raw = str(env.get("AIRUI_KILL_SWITCH") or "").strip()
    if not raw:
        return False
    if raw.lower() in {"0", "false", "off", "no"}:
        return False
    return True


def file_killed(path: Path | None) -> bool:
    return bool(path and path.exists())


def killed(path: Path | None, environ: dict | None = None) -> bool:
    return env_killed(environ) or file_killed(path)


def trip(path: Path, reason: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(reason + "\n", encoding="utf-8")


def contains_stop_word(text: str) -> str | None:
    raw = text or ""
    for word in STOP_WORDS:
        if word and word in raw:
            return word
    return None


def clear_file(path: Path | None) -> bool:
    """只清文件标志。环境变量急停必须由人在主机上撤掉。"""
    if path and path.exists():
        path.unlink()
        return True
    return False
