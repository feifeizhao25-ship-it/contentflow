"""本地状态。审计日志只追加，不提供改写接口。"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

from airui_ops.redact import scrub


class AuditLog:
    def __init__(self, path: Path, secrets: list[str] | None = None):
        self.path = path
        self.secrets = secrets or []
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.touch()

    def append(self, event: dict) -> None:
        safe = json.loads(scrub(json.dumps(event, ensure_ascii=False, default=str), self.secrets))
        line = json.dumps(safe, ensure_ascii=False, separators=(",", ":"))
        line = scrub(line, self.secrets)
        fd = os.open(self.path, os.O_APPEND | os.O_WRONLY)
        try:
            os.write(fd, (line + "\n").encode("utf-8"))
        finally:
            os.close(fd)

    def read(self) -> list[dict]:
        if not self.path.exists():
            return []
        rows = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
        return rows


class Store:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (kind, id))"
        )
        self._conn.commit()

    def put(self, kind: str, item_id: str, body: dict) -> None:
        self._conn.execute(
            "INSERT INTO records(kind, id, body) VALUES(?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET body = excluded.body",
            (kind, item_id, json.dumps(body, ensure_ascii=False)),
        )
        self._conn.commit()

    def get(self, kind: str, item_id: str) -> dict | None:
        row = self._conn.execute("SELECT body FROM records WHERE kind = ? AND id = ?", (kind, item_id)).fetchone()
        return json.loads(row[0]) if row else None

    def list(self, kind: str) -> list[dict]:
        rows = self._conn.execute("SELECT body FROM records WHERE kind = ? ORDER BY id", (kind,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def close(self) -> None:
        self._conn.close()
