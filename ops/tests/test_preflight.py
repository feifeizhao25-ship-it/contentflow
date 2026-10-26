import json
import os
from pathlib import Path

from airui_ops.preflight import render_report, run_preflight
from airui_ops.secrets import load_secret_values
from tests.conftest import CANARY, aes_key, sample_config, secret_lines


def _values():
    return {
        "WECOM_SECRET": "wecom-secret-value-1",
        "WECOM_TOKEN": "tok-123456",
        "WECOM_AES_KEY": aes_key(),
        "WECOM_WEBHOOK_KEY": "webhook-key-234567",
        "DEEPSEEK_API_KEY": "deepseek-key-345678",
        "DASHSCOPE_API_KEY": "dashscope-key-456789",
        "ARK_API_KEY": "ark-key-56789012",
        "BAIDU_PUSH_TOKEN": "baidu-token-678901",
        "OPENCLAW_SHUNSHI_ADMIN_TOKEN": "shunshi-token-789012",
        "OPENCLAW_FENFAXIA_API_TOKEN": "fenfa-token-890123",
        "PKG_PREVIEW_SIGNING_KEY": "p" * 40,
    }


def test_missing_secret_is_named_and_value_never_appears(tmp_path: Path):
    path = tmp_path / "secrets.env"
    values = _values()
    values["DEEPSEEK_API_KEY"] = CANARY
    path.write_text(secret_lines(values), encoding="utf-8")
    os.chmod(path, 0o644)
    usable, notes = load_secret_values(path, {})
    report = run_preflight(sample_config(), notes, usable, tmp_path / "KILL", {})
    blob = json.dumps(report, ensure_ascii=False) + render_report(report, list(usable.values()))
    assert CANARY not in blob
    assert "DEEPSEEK_API_KEY" in blob
    assert any(item["name"] == "secrets.env" or item["detail"].find("600") >= 0 for item in notes)
    assert "DEEPSEEK_API_KEY" not in usable


def test_present_secrets_and_shared_value_are_not_printed(tmp_path: Path):
    path = tmp_path / "secrets.env"
    values = _values()
    values["DEEPSEEK_API_KEY"] = CANARY
    values["DASHSCOPE_API_KEY"] = CANARY
    path.write_text(secret_lines(values), encoding="utf-8")
    os.chmod(path, 0o600)
    usable, notes = load_secret_values(path, {})
    report = run_preflight(sample_config(), notes, usable, tmp_path / "KILL", {})
    blob = json.dumps({"report": report, "notes": notes}, ensure_ascii=False)
    assert CANARY not in blob
    assert "DEEPSEEK_API_KEY" not in usable
    assert "DASHSCOPE_API_KEY" not in usable
    assert any(item["status"] == "shared" and item["name"] == "DEEPSEEK_API_KEY" for item in notes)
    assert report["modules"]["review"] == "off"


def test_forbidden_offshore_keys_are_ignored(tmp_path: Path):
    path = tmp_path / "secrets.env"
    values = _values()
    values["FAL_KEY"] = CANARY
    values["OPENROUTER_API_KEY"] = "openrouter-should-ignore"
    path.write_text(secret_lines(values), encoding="utf-8")
    os.chmod(path, 0o600)
    usable, notes = load_secret_values(path, {})
    blob = json.dumps(notes, ensure_ascii=False)
    assert CANARY not in blob
    assert "FAL_KEY" not in usable
    assert "OPENROUTER_API_KEY" not in usable
    assert any(item["status"] == "ignored_forbidden" and item["name"] == "FAL_KEY" for item in notes)


def test_missing_field_disables_only_that_module(tmp_path: Path):
    path = tmp_path / "secrets.env"
    path.write_text(secret_lines(_values()), encoding="utf-8")
    os.chmod(path, 0o600)
    usable, notes = load_secret_values(path, {})
    cfg = sample_config()
    cfg["budget"]["ai_monthly_cny"]["openclaw"] = 1500
    del cfg["shunshi"]
    report = run_preflight(cfg, notes, usable, tmp_path / "KILL", {})
    assert report["modules"]["publish_shunshi"] == "off"
    assert report["modules"]["draft"] == "on"
    assert report["jianji"] == "closed"
    assert report["modules"]["publish_jianji"] == "blocked"
