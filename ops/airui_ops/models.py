"""OpenClaw 自用的国产模型网关。只打境内端点，带路由、回退、计量和月预算。"""

from __future__ import annotations

import json
from dataclasses import dataclass

from airui_ops.clock import deepseek_peak
from airui_ops.http_client import HttpResponse, Transport, TransportError, assert_domestic_url
from airui_ops.store import AuditLog, Store

# 官方模型 ID（2026-10-26 文档）。标 unverified 的单价或接入以控制台为准，可被配置覆盖。
DEEPSEEK_CHAT = "https://api.deepseek.com/chat/completions"
DASHSCOPE_CHAT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
ARK_CHAT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
ARK_IMAGE = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
ARK_VIDEO = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"
DASHSCOPE_IMAGE = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
DASHSCOPE_VIDEO = "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
DASHSCOPE_MULTIMODAL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
DASHSCOPE_EMBED = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
DASHSCOPE_RERANK = "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"
DASHSCOPE_TASKS = "https://dashscope.aliyuncs.com/api/v1/tasks/"

# 文档 12 的营销名 qwen-image；百炼限流页当前模型 ID 是 qwen-image-2.0。
QWEN_IMAGE_MODEL = "qwen-image-2.0"
WAN_IMAGE_MODEL = "wan2.5-t2i-preview"
WAN_VIDEO_MODEL = "wan2.5-t2v-preview"
SEEDREAM_MODEL = "doubao-seedream-5-0-flash-260915"
SEEDANCE_MODEL = "doubao-seedance-2-0-mini-260615"
DOUBAO_LITE = "doubao-seed-2-0-lite-260428"
DOUBAO_MINI = "doubao-seed-2-0-mini-260428"

# 基准价（元）。DeepSeek 两套页面不一致，按文档 12 基准，高峰再 ×2，待核实。
TEXT_PRICE = {
    "deepseek-flash": (1.5, 4.5),
    "deepseek-v4-pro": (4.5, 9.0),
    "qwen3.5-plus": (0.8, 4.8),
    "qwen-flash": (0.16, 1.55),
    DOUBAO_LITE: (0.6, 3.6),
    DOUBAO_MINI: (0.2, 2.0),
}
IMAGE_PRICE = {SEEDREAM_MODEL: 0.12, QWEN_IMAGE_MODEL: 0.25, WAN_IMAGE_MODEL: 0.2}
VIDEO_PRICE_PER_SEC = {SEEDANCE_MODEL: 0.5, WAN_VIDEO_MODEL: 0.6, "kling-v3": 0.6}
TTS_PER_10K = {"cosyvoice-v3.5-flash": 0.8, "cosyvoice-v3-plus": 2.0}

ESSENTIAL = {"review", "guard"}


@dataclass
class ModelResult:
    ok: bool
    route: str
    provider: str
    model: str
    text: str
    cost_cny: float
    fallback_used: bool
    reason: str = ""
    local_path: str = ""


class BudgetExceeded(Exception):
    pass


class ModelGateway:
    def __init__(self, secrets: dict[str, str], config: dict, transport: Transport, store: Store, audit: AuditLog, now):
        self.secrets = secrets
        self.config = config
        self.transport = transport
        self.store = store
        self.audit = audit
        self.now = now
        models = config.get("models") or {}
        self.ids = {
            "plan": models.get("plan") or "deepseek-v4-pro",
            "draft": models.get("draft") or "deepseek-flash",
            "review": models.get("review") or "qwen3.5-plus",
            "image": models.get("image") or SEEDREAM_MODEL,
            "video": models.get("video") or SEEDANCE_MODEL,
            "tts": models.get("tts") or "cosyvoice-v3.5-flash",
            "embedding": models.get("embedding") or "text-embedding-v4",
            "rerank": models.get("rerank") or "qwen3-rerank",
            "qwen_image": models.get("qwen_image") or QWEN_IMAGE_MODEL,
            "wan_image": models.get("wan_image") or WAN_IMAGE_MODEL,
            "wan_video": models.get("wan_video") or WAN_VIDEO_MODEL,
            "doubao_lite": models.get("doubao_lite") or DOUBAO_LITE,
            "guard_endpoint": (models.get("guard") or {}).get("endpoint") if isinstance(models.get("guard"), dict) else "",
            "guard_model": (models.get("guard") or {}).get("model") if isinstance(models.get("guard"), dict) else "",
            "kling_base": models.get("kling_base") or "",
        }

    def budget_cap(self) -> float:
        raw = ((self.config.get("budget") or {}).get("ai_monthly_cny") or {}).get("openclaw", 1500)
        return float(raw)

    def spent(self) -> float:
        month = self.now().astimezone().strftime("%Y-%m")
        row = self.store.get("budget", month) or {"cny": 0}
        return float(row.get("cny") or 0)

    def _add_cost(self, amount: float, route: str, model: str) -> None:
        month = self.now().astimezone().strftime("%Y-%m")
        current = self.spent() + max(0.0, amount)
        self.store.put("budget", month, {"cny": round(current, 6)})
        cap = self.budget_cap()
        level = "ok"
        if cap and current >= cap:
            level = "paused"
        elif cap and current >= cap * 0.8:
            level = "warn"
        self.audit.append({"action": "model_cost", "route": route, "model": model, "cny": round(amount, 6), "month_cny": round(current, 6), "level": level})

    def _blocked(self, route: str) -> bool:
        cap = self.budget_cap()
        if cap <= 0:
            return False
        if route in ESSENTIAL:
            return False
        return self.spent() >= cap

    def complete(self, route: str, prompt: str, max_tokens: int = 256) -> ModelResult:
        if self._blocked(route):
            self.audit.append({"action": "model_paused", "route": route, "reason": "budget"})
            return ModelResult(False, route, "", "", "", 0, False, "budget")
        chain = self._text_chain(route)
        last = "no provider"
        for index, spec in enumerate(chain):
            try:
                text, usage = self._chat(spec, prompt, max_tokens)
            except (TransportError, ApiStatus) as exc:
                last = str(exc)
                continue
            cost = self._text_cost(spec["model"], usage)
            self._add_cost(cost, route, spec["model"])
            return ModelResult(True, route, spec["provider"], spec["model"], text, cost, index > 0)
        self.audit.append({"action": "model_failed", "route": route, "reason": last})
        return ModelResult(False, route, "", "", "", 0, False, last)

    def _text_chain(self, route: str) -> list[dict]:
        deepseek = self.secrets.get("DEEPSEEK_API_KEY", "")
        dash = self.secrets.get("DASHSCOPE_API_KEY", "")
        ark = self.secrets.get("ARK_API_KEY", "")
        if route == "plan":
            chain = []
            if deepseek:
                chain.append({"provider": "deepseek", "model": self.ids["plan"], "key": deepseek, "url": DEEPSEEK_CHAT})
            if dash:
                chain.append({"provider": "dashscope", "model": "qwen3.5-plus", "key": dash, "url": DASHSCOPE_CHAT})
            return chain
        if route in {"draft", "research"}:
            chain = []
            if deepseek:
                chain.append({"provider": "deepseek", "model": self.ids["draft"], "key": deepseek, "url": DEEPSEEK_CHAT})
            if ark:
                chain.append({"provider": "ark", "model": self.ids["doubao_lite"], "key": ark, "url": ARK_CHAT})
            return chain
        if route == "review":
            if not dash:
                return []
            return [{"provider": "dashscope", "model": self.ids["review"], "key": dash, "url": DASHSCOPE_CHAT}]
        if route == "title":
            chain = []
            if ark:
                chain.append({"provider": "ark", "model": DOUBAO_MINI, "key": ark, "url": ARK_CHAT})
            if dash:
                chain.append({"provider": "dashscope", "model": "qwen-flash", "key": dash, "url": DASHSCOPE_CHAT})
            return chain
        return []

    def _chat(self, spec: dict, prompt: str, max_tokens: int) -> tuple[str, dict]:
        assert_domestic_url(spec["url"])
        body = {
            "model": spec["model"],
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.3,
        }
        if spec["provider"] == "deepseek":
            body["thinking"] = {"type": "disabled"}
        if spec["provider"] == "ark":
            body["thinking"] = {"type": "disabled"}
        if spec["model"].startswith("qwen3"):
            body["enable_thinking"] = False
        resp = self._call("POST", spec["url"], spec["key"], body)
        data = resp.json()
        text = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        if not str(text).strip():
            raise ApiStatus("empty")
        return str(text), data.get("usage") or {}

    def _call(self, method: str, url: str, key: str, payload: dict | None) -> HttpResponse:
        assert_domestic_url(url)
        resp = self.transport.request(
            method,
            url,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            body=None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=20,
        )
        if resp.status >= 400:
            raise ApiStatus(f"http {resp.status}")
        return resp

    def _text_cost(self, model: str, usage: dict) -> float:
        pin, pout = TEXT_PRICE.get(model, (9.0, 27.0))
        if model.startswith("deepseek") and deepseek_peak(self.now()):
            pin *= 2
            pout *= 2
        prompt = float(usage.get("prompt_tokens") or 0)
        completion = float(usage.get("completion_tokens") or 0)
        return (prompt * pin + completion * pout) / 1_000_000

    def image(self, prompt: str, dest_html: str) -> ModelResult:
        if self._blocked("image"):
            return ModelResult(False, "image", "", "", "", 0, False, "budget")
        ark = self.secrets.get("ARK_API_KEY", "")
        dash = self.secrets.get("DASHSCOPE_API_KEY", "")
        if ark:
            try:
                url = self._seedream(prompt, ark)
                cost = IMAGE_PRICE[SEEDREAM_MODEL]
                self._add_cost(cost, "image", self.ids["image"])
                return ModelResult(True, "image", "ark", self.ids["image"], url, cost, False)
            except (TransportError, ApiStatus):
                pass
        if dash:
            try:
                url = self._qwen_image(prompt, dash)
                cost = IMAGE_PRICE.get(self.ids["qwen_image"], 0.25)
                self._add_cost(cost, "image", self.ids["qwen_image"])
                return ModelResult(True, "image", "dashscope", self.ids["qwen_image"], url, cost, True)
            except (TransportError, ApiStatus):
                pass
        html = (
            "<!doctype html><meta charset=utf-8><title>模板卡片</title>"
            f"<article><p>AI 生成</p><p>{_escape(prompt)}</p></article>"
        )
        with open(dest_html, "w", encoding="utf-8") as handle:
            handle.write(html)
        self.audit.append({"action": "image_template", "path": dest_html})
        return ModelResult(True, "image", "html_template", "html_template", "", 0, True, local_path=dest_html)

    def _seedream(self, prompt: str, key: str) -> str:
        resp = self._call("POST", ARK_IMAGE, key, {"model": self.ids["image"], "prompt": prompt, "size": "2K", "response_format": "url", "watermark": False})
        data = resp.json()
        url = ((data.get("data") or [{}])[0]).get("url")
        if not url:
            raise ApiStatus("no image url")
        return str(url)

    def _qwen_image(self, prompt: str, key: str) -> str:
        resp = self._call(
            "POST",
            DASHSCOPE_MULTIMODAL,
            key,
            {"model": self.ids["qwen_image"], "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]}},
        )
        data = resp.json()
        # 同步接口形态以百炼文档为准；拿不到地址就交给 HTML 模板。
        url = (((data.get("output") or {}).get("choices") or [{}])[0].get("message") or {}).get("content")
        if isinstance(url, list):
            for part in url:
                if isinstance(part, dict) and part.get("image"):
                    return str(part["image"])
        if isinstance(url, str) and url.startswith("http"):
            return url
        raise ApiStatus("no image url")

    def video(self, prompt: str, seconds: int = 10) -> ModelResult:
        if self._blocked("video"):
            return ModelResult(False, "video", "", "", "", 0, False, "budget")
        seconds = max(4, min(15, seconds))
        ark = self.secrets.get("ARK_API_KEY", "")
        dash = self.secrets.get("DASHSCOPE_API_KEY", "")
        if ark:
            try:
                task = self._seedance(prompt, ark, seconds)
                cost = VIDEO_PRICE_PER_SEC[SEEDANCE_MODEL] * seconds
                self._add_cost(cost, "video", self.ids["video"])
                return ModelResult(True, "video", "ark", self.ids["video"], task, cost, False)
            except (TransportError, ApiStatus):
                pass
        kling_base = str(self.ids["kling_base"] or "")
        if kling_base and self.secrets.get("KLING_ACCESS_KEY") and self.secrets.get("KLING_SECRET_KEY"):
            try:
                assert_domestic_url(kling_base)
                resp = self._call("POST", kling_base.rstrip("/") + "/v1/videos/text2video", self.secrets["KLING_ACCESS_KEY"], {"model": "kling-v3", "prompt": prompt, "duration": seconds, "mode": "720p"})
                cost = VIDEO_PRICE_PER_SEC["kling-v3"] * seconds
                self._add_cost(cost, "video", "kling-v3")
                return ModelResult(True, "video", "kling", "kling-v3", resp.text()[:120], cost, True)
            except (TransportError, ApiStatus):
                pass
        if dash:
            try:
                resp = self._call(
                    "POST",
                    DASHSCOPE_VIDEO,
                    dash,
                    {"model": self.ids["wan_video"], "input": {"prompt": prompt}, "parameters": {"resolution": "720P", "duration": seconds}},
                )
                cost = VIDEO_PRICE_PER_SEC[WAN_VIDEO_MODEL] * seconds
                self._add_cost(cost, "video", self.ids["wan_video"])
                return ModelResult(True, "video", "dashscope", self.ids["wan_video"], resp.text()[:120], cost, True)
            except (TransportError, ApiStatus):
                pass
        self.audit.append({"action": "video_script_only", "reason": "providers_unavailable"})
        return ModelResult(False, "video", "", "", prompt, 0, True, "script_only")

    def _seedance(self, prompt: str, key: str, seconds: int) -> str:
        resp = self._call(
            "POST",
            ARK_VIDEO,
            key,
            {"model": self.ids["video"], "content": [{"type": "text", "text": prompt}], "resolution": "720p", "ratio": "9:16", "duration": seconds},
        )
        data = resp.json()
        task = str(data.get("id") or (data.get("data") or {}).get("id") or "")
        if not task:
            raise ApiStatus("no video task")
        return task

    def embed(self, text: str) -> ModelResult:
        key = self.secrets.get("DASHSCOPE_API_KEY", "")
        if not key:
            return ModelResult(False, "embed", "", "", "", 0, False, "no key")
        resp = self._call("POST", DASHSCOPE_EMBED, key, {"model": self.ids["embedding"], "input": text})
        data = resp.json()
        vector = ((data.get("data") or [{}])[0]).get("embedding") or []
        tokens = float((data.get("usage") or {}).get("total_tokens") or 0)
        cost = tokens * 0.5 / 1_000_000
        self._add_cost(cost, "embed", self.ids["embedding"])
        return ModelResult(True, "embed", "dashscope", self.ids["embedding"], str(len(vector)), cost, False)

    def rerank(self, query: str, documents: list[str]) -> ModelResult:
        key = self.secrets.get("DASHSCOPE_API_KEY", "")
        if not key:
            return ModelResult(False, "rerank", "", "", "", 0, False, "no key")
        resp = self._call(
            "POST",
            DASHSCOPE_RERANK,
            key,
            {"model": self.ids["rerank"], "input": {"query": query, "documents": documents}, "parameters": {"top_n": len(documents)}},
        )
        self._add_cost(0.0005, "rerank", self.ids["rerank"])
        return ModelResult(True, "rerank", "dashscope", self.ids["rerank"], resp.text()[:200], 0.0005, False)

    def guard(self, text: str) -> ModelResult:
        endpoint = self.ids["guard_endpoint"]
        model = self.ids["guard_model"]
        key = self.secrets.get("DASHSCOPE_API_KEY", "")
        if not endpoint or not model or not key:
            return ModelResult(False, "guard", "", "", "", 0, False, "待核实：未配置护栏端点")
        assert_domestic_url(endpoint)
        self._call("POST", endpoint, key, {"model": model, "input": text})
        self._add_cost(0.0015, "guard", model)
        return ModelResult(True, "guard", "dashscope", model, "checked", 0.0015, False)


class ApiStatus(Exception):
    pass


def _escape(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
