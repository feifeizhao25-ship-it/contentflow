"""HTTP 传输。默认 urllib；测试注入替身。异常信息里的 URL 会去掉密钥参数。"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from airui_ops.redact import redact_url


class TransportError(Exception):
    pass


class ApiError(Exception):
    def __init__(self, errcode: int, errmsg: str):
        super().__init__(f"api {errcode}")
        self.errcode = errcode
        self.errmsg = errmsg


@dataclass
class HttpResponse:
    status: int
    body: bytes

    def json(self):
        if not self.body:
            return {}
        return json.loads(self.body.decode("utf-8"))

    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


class Transport(Protocol):
    def request(self, method: str, url: str, headers: dict | None = None, body: bytes | None = None, timeout: float = 10) -> HttpResponse:
        ...


class UrllibTransport:
    def request(self, method: str, url: str, headers: dict | None = None, body: bytes | None = None, timeout: float = 10) -> HttpResponse:
        req = Request(url, data=body, method=method, headers=headers or {})
        try:
            with urlopen(req, timeout=timeout) as resp:
                return HttpResponse(status=getattr(resp, "status", 200), body=resp.read())
        except HTTPError as exc:
            payload = exc.read() if exc.fp else b""
            return HttpResponse(status=exc.code, body=payload)
        except URLError as exc:
            raise TransportError(redact_url(url)) from exc
        except TimeoutError as exc:
            raise TransportError(redact_url(url)) from exc


OFFSHORE_MARKERS = (
    "openrouter.ai",
    "fal.run",
    "fal.ai",
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
)


def assert_domestic_url(url: str) -> None:
    lowered = url.lower()
    for marker in OFFSHORE_MARKERS:
        if marker in lowered:
            raise TransportError("offshore endpoint refused")
