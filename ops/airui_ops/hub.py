"""把配置、密钥、审批、发布和模型网关装在一起。产品只通过 HTTP 跟它说话。"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from airui_ops.approval import ApprovalService
from airui_ops.config import load_yaml
from airui_ops.http_client import Transport, UrllibTransport
from airui_ops.killswitch import killed
from airui_ops.models import ModelGateway
from airui_ops.package import PackageService
from airui_ops.preflight import render_report, run_preflight
from airui_ops.publish import Publisher
from airui_ops.secrets import load_secret_values
from airui_ops.store import AuditLog, Store
from airui_ops.wecom_client import WeComClient, notify_webhook
from airui_ops.wecom_crypto import WeComCrypto, WeComCryptoError

TZ = ZoneInfo("Asia/Shanghai")


class Hub:
    def __init__(self, config_path: Path, data_dir: Path, secrets_path: Path | None = None, transport: Transport | None = None, now=None, environ: dict | None = None):
        self.config_path = config_path
        self.data_dir = data_dir
        self.secrets_path = secrets_path
        self.transport = transport or UrllibTransport()
        self._now = now or (lambda: datetime.now(TZ))
        self.environ = environ
        self.store = None
        self.reload()

    def now(self) -> datetime:
        current = self._now()
        if current.tzinfo is None:
            return current.replace(tzinfo=TZ)
        return current

    def reload(self) -> None:
        self.config = load_yaml(self.config_path) if self.config_path.exists() else {}
        self.usable, self.secret_notes = load_secret_values(self.secrets_path, self.environ)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if self.store is not None:
            self.store.close()
        kill_name = str((self.config.get("kill_switch_file") or "")) or str(self.data_dir / "KILL")
        self.kill_file = Path(kill_name)
        self.store = Store(self.data_dir / "state.db")
        self.audit = AuditLog(self.data_dir / "audit.jsonl", secrets=list(self.usable.values()))
        self.report = run_preflight(self.config, self.secret_notes, self.usable, self.kill_file, self.environ)
        self.client = self._client()
        self.crypto = self._crypto()
        self.approval = ApprovalService(self.store, self.audit, self.client, self.crypto, self.config, self.now, self.kill_file)
        self.approval.wecom_ok = self.report["modules"].get("approval") == "on" and self.client is not None
        self.packages = PackageService(
            self.store,
            self.usable.get("PKG_PREVIEW_SIGNING_KEY", ""),
            str((self.config.get("preview") or {}).get("domain") or ""),
            self.now,
        )
        self.publisher = Publisher(
            self.config,
            self.usable,
            self.transport,
            self.store,
            self.audit,
            self.now,
            self.kill_file,
            self.approval.wecom_ok,
        )
        self.models = ModelGateway(self.usable, self.config, self.transport, self.store, self.audit, self.now)

    def _client(self) -> WeComClient | None:
        wecom = self.config.get("wecom") or {}
        secret = self.usable.get("WECOM_SECRET", "")
        if not secret or not wecom.get("corp_id") or not wecom.get("agent_id"):
            return None
        if self.report["modules"].get("approval") != "on":
            return None
        return WeComClient(str(wecom["corp_id"]), secret, str(wecom["agent_id"]), self.transport)

    def _crypto(self) -> WeComCrypto | None:
        token = self.usable.get("WECOM_TOKEN", "")
        aes = self.usable.get("WECOM_AES_KEY", "")
        corp = str((self.config.get("wecom") or {}).get("corp_id") or "")
        if not token or not aes or not corp:
            return None
        try:
            return WeComCrypto(token, aes, corp)
        except WeComCryptoError:
            return None

    def preflight_text(self) -> str:
        return render_report(self.report, list(self.usable.values()))

    def post_report(self) -> bool:
        key = self.usable.get("WECOM_WEBHOOK_KEY", "")
        if not key:
            return False
        ok = notify_webhook(self.transport, key, self.preflight_text())
        self.audit.append({"action": "preflight_notified", "ok": ok})
        return ok

    def status(self) -> dict:
        pending = [item for item in self.store.list("approval") if item.get("status") == "pending"]
        return {
            "killed": killed(self.kill_file, self.environ),
            "modules": self.report["modules"],
            "jianji": self.report["jianji"],
            "window": self.report["window"],
            "pending_approvals": len(pending),
            "budget_cny": self.models.spent(),
            "budget_cap_cny": self.models.budget_cap(),
            "transition_mode": self.report["transition_mode"],
        }
