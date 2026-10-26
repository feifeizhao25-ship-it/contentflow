"""审批状态机。超时、验签失败、企业微信不可用、哈希不一致，一律不算批准。"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta
from xml.etree import ElementTree

from airui_ops.config import KIND_TEMPLATE, SINGLE_APPROVER_KINDS, approvers_for, template_id
from airui_ops.content import content_sha256
from airui_ops.http_client import ApiError
from airui_ops.killswitch import clear_file, contains_stop_word, trip
from airui_ops.store import AuditLog, Store
from airui_ops.wecom_client import WeComClient, WeComUnavailable
from airui_ops.wecom_crypto import WeComCrypto, WeComCryptoError

WITHDRAW_RE = re.compile(r"撤\s*[:：]\s*(\d+)")
SLA_HOURS = {"P1": None, "P2": 72, "P3": 24 * 7, "P4": 24 * 7, "P5": 72, "P6": 48, "P7": 4}
SP_APPROVED = 2
SP_REJECTED = 3
SP_CANCELLED = {4, 6, 7}


def _xml_text(root: ElementTree.Element, path: str) -> str:
    node = root.find(path)
    return (node.text or "").strip() if node is not None and node.text else ""


class ApprovalService:
    def __init__(self, store: Store, audit: AuditLog, client: WeComClient | None, crypto: WeComCrypto | None, config: dict, now, kill_file):
        self.store = store
        self.audit = audit
        self.client = client
        self.crypto = crypto
        self.config = config
        self.now = now
        self.kill_file = kill_file
        self.wecom_ok = client is not None

    def mark_wecom_down(self, reason: str) -> None:
        self.wecom_ok = False
        self.audit.append({"action": "wecom_down", "reason": reason})

    def _deadline(self, kind: str, created: datetime) -> datetime:
        if kind == "P1":
            local = created.astimezone(created.tzinfo)
            return local.replace(hour=21, minute=0, second=0, microsecond=0)
        hours = SLA_HOURS.get(kind) or 72
        return created + timedelta(hours=hours)

    def submit(self, kind: str, product: str, content: dict, items: list[dict] | None = None, preview_url: str = "") -> dict:
        if contains_stop_word(json_dump(content)):
            trip(self.kill_file, "stop word in content")
            self.audit.append({"action": "kill", "reason": "stop word"})
            return {"status": "halted", "reason": "kill_switch"}
        approvers = approvers_for(self.config, kind, product)
        submitter = str((self.config.get("wecom") or {}).get("submitter_userid") or "").strip()
        if not approvers or not submitter or submitter in approvers:
            self.audit.append({"action": "approval_refused", "kind": kind, "reason": "approver_config"})
            return {"status": "not_submitted", "reason": "approver_config"}
        sha = content_sha256(content)
        created = self.now()
        record = {
            "id": "ap_" + uuid.uuid4().hex[:16],
            "kind": kind,
            "product": product,
            "content_sha256": sha,
            "content": content,
            "items": items or [],
            "status": "pending",
            "channel": "",
            "sp_no": "",
            "task_id": "",
            "deadline": self._deadline(kind, created).isoformat(),
            "created_at": created.isoformat(),
            "detail_checked": False,
            "comment": "",
            "withdrawn": [],
            "preview_url": preview_url,
        }
        tpl = template_id(self.config, KIND_TEMPLATE[kind])
        if self.client is None or not tpl:
            self.wecom_ok = False
            self.store.put("approval", record["id"], record)
            self.audit.append({"action": "approval_not_submitted", "id": record["id"], "reason": "wecom_unavailable"})
            return {**record, "status": "not_submitted", "reason": "wecom_unavailable"}
        summary = f"{kind} {product} {sha[:12]}"
        controls = ((self.config.get("wecom") or {}).get("controls") or {}).get(kind) or {}
        fields = [
            (str(controls.get("sha") or ""), sha),
            (str(controls.get("summary") or ""), summary),
            (str(controls.get("link") or ""), preview_url or "-"),
        ]
        try:
            sp_no = self.client.applyevent(submitter, tpl, summary, fields)
            record["channel"] = "oa"
            record["sp_no"] = sp_no
            record["status"] = "pending"
        except WeComUnavailable as exc:
            self.mark_wecom_down(str(exc))
            record["status"] = "not_submitted"
            record["reason"] = "wecom_unavailable"
        except ApiError:
            if kind in SINGLE_APPROVER_KINDS and len(approvers) == 1 and not (kind == "P1" and product == "jianji"):
                record["task_id"] = record["id"]
                record["channel"] = "template_card"
                try:
                    self.client.send_template_card(approvers[0], record["id"], f"{kind} 待审批", summary, preview_url or "https://example.invalid")
                    record["status"] = "pending"
                except (WeComUnavailable, ApiError) as exc:
                    self.mark_wecom_down(str(exc))
                    record["status"] = "not_submitted"
                    record["reason"] = "wecom_unavailable"
            else:
                record["status"] = "not_submitted"
                record["reason"] = "template_card_refused_multi_approver"
        self.store.put("approval", record["id"], record)
        self.audit.append({"action": "approval_submit", "id": record["id"], "kind": kind, "status": record["status"], "channel": record["channel"], "sha": sha})
        return record

    def get(self, approval_id: str) -> dict | None:
        return self.store.get("approval", approval_id)

    def handle_callback(self, signature: str, timestamp: str, nonce: str, xml_text: str) -> dict:
        if self.crypto is None:
            self.mark_wecom_down("crypto not configured")
            return {"ok": False, "reason": "wecom_unavailable"}
        try:
            plain = self.crypto.decrypt_xml(signature, timestamp, nonce, xml_text)
        except WeComCryptoError as exc:
            self.audit.append({"action": "callback_rejected", "reason": str(exc)})
            return {"ok": False, "reason": "bad_signature"}
        try:
            root = ElementTree.fromstring(plain)
        except ElementTree.ParseError:
            return {"ok": False, "reason": "bad_xml"}
        event = _xml_text(root, "Event")
        if event == "template_card_event":
            return self._on_card(root)
        if _xml_text(root, "MsgType") == "text" or event == "":
            content = _xml_text(root, "Content")
            word = contains_stop_word(content)
            if word:
                trip(self.kill_file, word)
                self.audit.append({"action": "kill", "reason": word})
                return {"ok": True, "reason": "killed"}
        if event == "sys_approval_change":
            return self._on_oa(root)
        return {"ok": True, "reason": "ignored"}

    def _on_card(self, root: ElementTree.Element) -> dict:
        task_id = _xml_text(root, "TaskId")
        key = _xml_text(root, "EventKey")
        user = _xml_text(root, "FromUserName")
        record = self.get(task_id)
        if not record or record.get("channel") != "template_card":
            self.audit.append({"action": "card_ignored", "task": task_id})
            return {"ok": False, "reason": "unknown_task"}
        approvers = approvers_for(self.config, record["kind"], record["product"])
        if len(approvers) != 1 or record["kind"] not in SINGLE_APPROVER_KINDS:
            record["status"] = "not_submitted"
            record["reason"] = "template_card_refused_multi_approver"
            self.store.put("approval", record["id"], record)
            return {"ok": False, "reason": "multi_approver"}
        if user != approvers[0]:
            self.audit.append({"action": "card_ignored", "task": task_id, "reason": "not_approver"})
            return {"ok": False, "reason": "not_approver"}
        if self._expired(record):
            record["status"] = "timeout"
            self.store.put("approval", record["id"], record)
            self.audit.append({"action": "approval_timeout", "id": record["id"]})
            return {"ok": True, "reason": "timeout"}
        record["status"] = "approved" if key == "approve" else "rejected"
        record["detail_checked"] = False
        record["channel_confirmed"] = "template_card"
        self.store.put("approval", record["id"], record)
        self.audit.append({"action": "approval_card", "id": record["id"], "status": record["status"]})
        return {"ok": True, "status": record["status"], "id": record["id"]}

    def _on_oa(self, root: ElementTree.Element) -> dict:
        info = root.find("ApprovalInfo")
        if info is None:
            return {"ok": False, "reason": "no_approval_info"}
        sp_no = _xml_text(info, "SpNo")
        speech = _xml_text(info, ".//Speech")
        word = contains_stop_word(speech)
        if word:
            trip(self.kill_file, word)
            self.audit.append({"action": "kill", "reason": word, "sp_no": sp_no})
            return {"ok": True, "reason": "killed"}
        record = self._by_sp_no(sp_no)
        if record is None:
            self.audit.append({"action": "callback_unknown_sp", "sp_no": sp_no})
            return {"ok": True, "reason": "unknown"}
        if self.client is None:
            self.mark_wecom_down("no client")
            return {"ok": False, "reason": "wecom_unavailable"}
        try:
            detail = self.client.getapprovaldetail(sp_no)
        except WeComUnavailable as exc:
            self.mark_wecom_down(str(exc))
            self.audit.append({"action": "detail_failed", "id": record["id"], "reason": "wecom_unavailable"})
            return {"ok": False, "reason": "wecom_unavailable"}
        return self._apply_detail(record, detail, speech)

    def _apply_detail(self, record: dict, detail: dict, speech: str = "") -> dict:
        if str(detail.get("sp_no") or "") not in ("", record.get("sp_no")):
            record["status"] = "invalidated"
            record["reason"] = "sp_mismatch"
            self.store.put("approval", record["id"], record)
            return {"ok": False, "reason": "sp_mismatch"}
        detail_text = json_dump(detail)
        if record["content_sha256"] not in detail_text and record["content_sha256"] not in (speech or ""):
            # 模板若没把哈希回传，仍以本地绑定为准；但回传了另一个哈希则作废。
            other = _foreign_sha(detail_text, record["content_sha256"])
            if other:
                record["status"] = "invalidated"
                record["reason"] = "sha_mismatch"
                self.store.put("approval", record["id"], record)
                self.audit.append({"action": "approval_invalidated", "id": record["id"], "reason": "sha_mismatch"})
                return {"ok": True, "reason": "sha_mismatch"}
        if self._expired(record):
            record["status"] = "timeout"
            self.store.put("approval", record["id"], record)
            self.audit.append({"action": "approval_timeout", "id": record["id"]})
            return {"ok": True, "reason": "timeout"}
        status = int(detail.get("sp_status") or 0)
        comment = speech or _collect_speech(detail)
        record["comment"] = comment
        record["withdrawn"] = [int(n) for n in WITHDRAW_RE.findall(comment)]
        record["detail_checked"] = True
        if status == SP_APPROVED:
            record["status"] = "approved"
        elif status == SP_REJECTED:
            record["status"] = "rejected"
        elif status in SP_CANCELLED:
            record["status"] = "rejected"
            record["reason"] = "cancelled"
        else:
            record["status"] = "pending"
        if record["kind"] == "P7" and record["status"] == "approved":
            clear_file(self.kill_file)
            self.audit.append({"action": "kill_file_cleared", "id": record["id"]})
        if record["kind"] == "P6" and record["status"] == "approved":
            self.store.put("switch", "approved", {"hash": record["content"].get("config_hash"), "at": self.now().isoformat(), "approval_id": record["id"]})
        self.store.put("approval", record["id"], record)
        self.audit.append({"action": "approval_update", "id": record["id"], "status": record["status"], "sha": record["content_sha256"]})
        return {"ok": True, "status": record["status"], "id": record["id"]}

    def reconcile(self) -> list[dict]:
        if self.client is None:
            self.mark_wecom_down("no client")
            return []
        updated = []
        now = self.now()
        start = int((now - timedelta(days=2)).timestamp())
        end = int(now.timestamp()) + 60
        try:
            sp_list = self.client.getapprovalinfo(start, end)
        except WeComUnavailable as exc:
            self.mark_wecom_down(str(exc))
            return []
        known = {item.get("sp_no"): item for item in self.store.list("approval") if item.get("sp_no")}
        for sp_no in sp_list:
            record = known.get(sp_no)
            if record is None or record.get("status") not in {"pending", "not_submitted"}:
                continue
            try:
                detail = self.client.getapprovaldetail(sp_no)
            except WeComUnavailable as exc:
                self.mark_wecom_down(str(exc))
                break
            self._apply_detail(record, detail)
            updated.append(self.get(record["id"]))
        for record in self.store.list("approval"):
            if record.get("status") == "pending" and self._expired(record):
                record["status"] = "timeout"
                self.store.put("approval", record["id"], record)
                self.audit.append({"action": "approval_timeout", "id": record["id"]})
                updated.append(record)
        return updated

    def _expired(self, record: dict) -> bool:
        deadline = datetime.fromisoformat(record["deadline"])
        return self.now() > deadline

    def _by_sp_no(self, sp_no: str) -> dict | None:
        for item in self.store.list("approval"):
            if item.get("sp_no") == sp_no:
                return item
        return None

    def invalidate_if_changed(self, approval_id: str, content: dict) -> dict | None:
        record = self.get(approval_id)
        if not record:
            return None
        if content_sha256(content) != record["content_sha256"]:
            record["status"] = "invalidated"
            record["reason"] = "sha_mismatch"
            self.store.put("approval", record["id"], record)
            self.audit.append({"action": "approval_invalidated", "id": approval_id, "reason": "sha_mismatch"})
        return self.get(approval_id)


def json_dump(obj) -> str:
    import json
    return json.dumps(obj, ensure_ascii=False, sort_keys=True)


def _collect_speech(detail: dict) -> str:
    chunks = []
    for record in detail.get("sp_record") or detail.get("SpRecord") or []:
        details = record.get("details") or []
        if isinstance(details, dict):
            details = [details]
        for item in details:
            speech = item.get("speech") or item.get("Speech") or ""
            if speech:
                chunks.append(str(speech))
    for comment in detail.get("comments") or []:
        text = comment.get("commentcontent") or ""
        if text:
            chunks.append(str(text))
    return "\n".join(chunks)


_SHA_RE = re.compile(r"\b[0-9a-f]{64}\b")


def _foreign_sha(text: str, expected: str) -> bool:
    found = _SHA_RE.findall(text or "")
    return any(item != expected for item in found)
