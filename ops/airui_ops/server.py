"""回调、发布包页面、状态。标准库 HTTP，方便在一台常开主机上跑。"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from airui_ops.hub import Hub


def make_handler(hub: Hub):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            return

        def _send(self, status: int, body: bytes, content_type: str):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                self._send(200, b"ok", "text/plain; charset=utf-8")
                return
            if parsed.path == "/status":
                payload = json.dumps(hub.status(), ensure_ascii=False).encode("utf-8")
                self._send(200, payload, "application/json; charset=utf-8")
                return
            if parsed.path == "/wecom/callback":
                qs = parse_qs(parsed.query)
                crypto = hub.crypto
                if crypto is None:
                    self._send(503, b"", "text/plain")
                    return
                try:
                    echo = crypto.verify_url(
                        _one(qs, "msg_signature"),
                        _one(qs, "timestamp"),
                        _one(qs, "nonce"),
                        _one(qs, "echostr"),
                    )
                except Exception:
                    self._send(403, b"", "text/plain")
                    return
                self._send(200, echo.encode("utf-8"), "text/plain; charset=utf-8")
                return
            if parsed.path.startswith("/pkg/"):
                package_id = parsed.path.split("/")[2]
                qs = parse_qs(parsed.query)
                try:
                    exp = int(_one(qs, "exp") or "0")
                except ValueError:
                    exp = 0
                status, page = hub.packages.render(package_id, exp, _one(qs, "sig"))
                self._send(status, page.encode("utf-8"), "text/html; charset=utf-8")
                return
            self._send(404, b"not found", "text/plain")

        def do_POST(self):
            parsed = urlparse(self.path)
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            if parsed.path == "/wecom/callback":
                qs = parse_qs(parsed.query)
                result = hub.approval.handle_callback(_one(qs, "msg_signature"), _one(qs, "timestamp"), _one(qs, "nonce"), raw.decode("utf-8", errors="replace"))
                code = 200 if result.get("ok") else 403
                self._send(code, b"success" if result.get("ok") else b"", "text/plain")
                return
            if parsed.path.startswith("/pkg/") and parsed.path.endswith("/published"):
                package_id = parsed.path.split("/")[2]
                qs = parse_qs(parsed.query)
                form = parse_qs(raw.decode("utf-8", errors="replace"))
                try:
                    exp = int(_one(qs, "exp") or "0")
                except ValueError:
                    exp = 0
                status, payload = hub.packages.mark_published(package_id, exp, _one(qs, "sig"), _one(form, "url"))
                if status == 200:
                    hub.audit.append({"action": "package_published", "package_id": package_id})
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self._send(status, body, "application/json; charset=utf-8")
                return
            self._send(404, b"", "text/plain")

    return Handler


def _one(qs: dict, key: str) -> str:
    values = qs.get(key) or [""]
    return values[0]


def serve(hub: Hub, host: str = "127.0.0.1", port: int = 8080) -> None:
    httpd = ThreadingHTTPServer((host, port), make_handler(hub))
    httpd.serve_forever()
