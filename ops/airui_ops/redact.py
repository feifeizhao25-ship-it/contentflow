"""日志与报告脱敏。只接受调用方传入的值列表，不读取任何 .env。"""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_QUERY_KEYS = {"corpsecret", "secret", "access_token", "token", "key", "api_key", "authorization"}


def scrub(text: str, secrets: list[str] | None) -> str:
    out = text or ""
    for value in sorted({v for v in (secrets or []) if isinstance(v, str) and len(v) >= 6}, key=len, reverse=True):
        out = out.replace(value, "[redacted]")
    return out


def redact_url(url: str) -> str:
    parts = urlsplit(url)
    query = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key.lower() in _QUERY_KEYS or "secret" in key.lower() or "token" in key.lower() or key.lower().endswith("key"):
            query.append((key, "[redacted]"))
        else:
            query.append((key, value))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
