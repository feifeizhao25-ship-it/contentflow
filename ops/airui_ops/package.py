"""B 档一键发布包。签名链接 24 小时失效。页面不登录任何平台。"""

from __future__ import annotations

import hmac
import hashlib
import html
import json
import uuid
from datetime import timedelta

from airui_ops.content import AIGC_TEXT, SHUNSHI_DISCLAIMER, apply_aigc, content_sha256
from airui_ops.store import Store

PLATFORM_HINT = {
    "xiaohongshu": ("12:00–13:00、20:00–22:00", "发布页勾选「内容含 AI」。不要用自动发布工具。"),
    "wechat_mp": ("周日 20:00 / 周一 08:00", "文末保留 AI 文字标识。不要用 freepublish 自动发布。"),
    "channels": ("12:00、19:00–21:00", "发表页勾选 AI 声明，并保留片头或片尾标识。"),
    "zhihu": ("工作日晚间", "先改写成自己的话再发，文末保留标识。"),
    "douyin": ("12:00、18:00–21:00", "高级设置里声明 AI。"),
    "bilibili": ("周四晚间", "投稿页声明 AI。"),
}


def sign_package(key: str, package_id: str, exp: int) -> str:
    msg = f"{package_id}.{exp}".encode("utf-8")
    return hmac.new(key.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_package(key: str, package_id: str, exp: int, sig: str, now_ts: float) -> bool:
    if not key or not sig or now_ts > exp:
        return False
    expect = sign_package(key, package_id, exp)
    return hmac.compare_digest(expect, sig)


class PackageService:
    def __init__(self, store: Store, signing_key: str, preview_domain: str, now):
        self.store = store
        self.signing_key = signing_key
        self.preview_domain = preview_domain
        self.now = now

    def create(self, product: str, platform: str, account_name: str, title: str, body: str, tags: list[str], media: list[dict]) -> dict:
        labeled = apply_aigc(product, body)
        content = {
            "product": product,
            "platform": platform,
            "account_name": account_name,
            "title": title,
            "body": labeled,
            "tags": tags,
            "media": media,
        }
        package_id = "pkg_" + uuid.uuid4().hex[:16]
        exp = int((self.now() + timedelta(hours=24)).timestamp())
        sig = sign_package(self.signing_key, package_id, exp) if self.signing_key else ""
        record = {
            "id": package_id,
            "content": content,
            "content_sha256": content_sha256(content),
            "exp": exp,
            "published_url": "",
            "published_at": "",
        }
        self.store.put("package", package_id, record)
        return {**record, "url": self.url(package_id, exp, sig), "sig": sig}

    def url(self, package_id: str, exp: int, sig: str) -> str:
        host = self.preview_domain or "preview.invalid"
        return f"https://{host}/pkg/{package_id}?exp={exp}&sig={sig}"

    def get(self, package_id: str) -> dict | None:
        return self.store.get("package", package_id)

    def render(self, package_id: str, exp: int, sig: str) -> tuple[int, str]:
        if not verify_package(self.signing_key, package_id, exp, sig, self.now().timestamp()):
            return 403, "<!doctype html><meta charset=utf-8><p>链接已失效或不正确。</p>"
        record = self.get(package_id)
        if not record:
            return 404, "<!doctype html><meta charset=utf-8><p>发布包不存在。</p>"
        return 200, render_html(record, exp, sig)

    def mark_published(self, package_id: str, exp: int, sig: str, post_url: str) -> tuple[int, dict]:
        if not verify_package(self.signing_key, package_id, exp, sig, self.now().timestamp()):
            return 403, {"ok": False, "reason": "bad_signature"}
        record = self.get(package_id)
        if not record:
            return 404, {"ok": False, "reason": "missing"}
        url = (post_url or "").strip()
        if not (url.startswith("https://") or url.startswith("http://")) or len(url) > 500:
            return 400, {"ok": False, "reason": "bad_url"}
        record["published_url"] = url
        record["published_at"] = self.now().isoformat()
        self.store.put("package", package_id, record)
        self.store.put("metric", package_id, {"package_id": package_id, "url": url, "sha": record["content_sha256"], "at": record["published_at"]})
        return 200, {"ok": True, "package_id": package_id}


def render_html(record: dict, exp: int, sig: str) -> str:
    content = record["content"]
    product = content["product"]
    platform = content["platform"]
    when, hint = PLATFORM_HINT.get(platform, ("按平台建议时段", "在平台发布页勾选 AI 声明。"))
    tags = " ".join("#" + html.escape(tag.lstrip("#")) for tag in content.get("tags") or [])
    media_html = []
    for item in content.get("media") or []:
        url = html.escape(str(item.get("url") or ""))
        kind = item.get("kind")
        if kind == "video":
            media_html.append(f'<p><a href="{url}" download>下载视频</a></p>')
        else:
            media_html.append(f'<p><a href="{url}" download>保存图片</a></p>')
    label = html.escape(AIGC_TEXT.get(product, ""))
    extra = html.escape(SHUNSHI_DISCLAIMER) if product == "shunshi" else ""
    body = html.escape(content.get("body") or "")
    title = html.escape(content.get("title") or "")
    account = html.escape(content.get("account_name") or "")
    package_id = html.escape(record["id"])
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>发布包</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;margin:0;background:#f6f4ef;color:#1c1917}}
main{{max-width:32rem;margin:0 auto;padding:1rem 1rem 3rem}}
button,input{{font:inherit}}
.card{{background:#fff;border-radius:16px;padding:1rem;margin:0 0 0.75rem;box-shadow:0 1px 2px rgba(0,0,0,.04)}}
button{{border:0;background:#1c1917;color:#fff;border-radius:999px;padding:.55rem 1rem}}
textarea{{width:100%;min-height:8rem;border-radius:12px;border:1px solid #e7e5e4;padding:.6rem}}
.muted{{color:#57534e;font-size:.9rem}}
</style></head><body><main>
<p class="muted">只在本页复制。这里不会登录{html.escape(platform)}。</p>
<section class="card"><h1 style="font-size:1.25rem;margin:.2rem 0">{title}</h1>
<p class="muted">账号：{account}<br>建议时间：{html.escape(when)}</p>
<button type="button" id="copy-title">复制标题</button></section>
<section class="card"><h2 style="font-size:1rem">正文</h2>
<pre id="body" style="white-space:pre-wrap;font:inherit">{body}</pre>
<button type="button" id="copy-body">复制正文</button></section>
<section class="card"><h2 style="font-size:1rem">话题标签</h2><p id="tags">{tags}</p>
<button type="button" id="copy-tags">复制标签</button></section>
<section class="card"><h2 style="font-size:1rem">图片 / 视频</h2>{''.join(media_html) or '<p class="muted">无素材</p>'}</section>
<section class="card"><h2 style="font-size:1rem">AIGC 声明</h2><p>{label}</p><p>{extra}</p><p>{html.escape(hint)}</p>
<p>请补一句你自己的看法，再发布。</p></section>
<section class="card"><h2 style="font-size:1rem">已发布</h2>
<form method="post" action="/pkg/{package_id}/published?exp={exp}&sig={html.escape(sig)}">
<label class="muted">贴上发布后的链接</label>
<input name="url" required maxlength="500" style="width:100%;margin:.4rem 0;padding:.5rem;border-radius:10px;border:1px solid #e7e5e4" placeholder="https://">
<button type="submit">已发布</button></form></section>
<script>
function copy(id){{const t=document.getElementById(id).innerText;navigator.clipboard&&navigator.clipboard.writeText(t)}}
document.getElementById('copy-title').onclick=()=>navigator.clipboard.writeText({json.dumps(content.get('title') or '')});
document.getElementById('copy-body').onclick=()=>copy('body');
document.getElementById('copy-tags').onclick=()=>copy('tags');
</script>
</main></body></html>"""
