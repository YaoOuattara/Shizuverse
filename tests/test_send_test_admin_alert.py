"""
scripts/send_test_admin_alert.py — the Render Shell check of the admin alert.

Preview sends nothing; --send goes through the real notify_admin_new_booking
with a fake booking (non-integer id, so it never attaches to a real booking)
and a « [TEST] » subject prefix. The exit code says whether every configured
recipient was reached.

Usage:
    pytest tests/test_send_test_admin_alert.py -v
"""
import importlib.util
import pathlib

import pytest

import shizuverse.utils.admin_alerts as alerts

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "send_test_admin_alert.py"


@pytest.fixture()
def script():
    spec = importlib.util.spec_from_file_location("send_test_admin_alert", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_preview_sends_nothing(script, monkeypatch, capsys):
    def must_not_send(*a, **k):
        raise AssertionError("preview must not send")
    monkeypatch.setattr(alerts, "notify_admin_new_booking", must_not_send)
    assert script.main([]) == 0
    out = capsys.readouterr().out
    assert "APERÇU" in out and "SHZ-" in out and "-TEST" in out


def test_send_uses_a_fake_booking_and_a_test_prefix(script, monkeypatch):
    seen = {}

    def fake_notify(booking, *, subject_prefix=""):
        seen.update(id=booking.id, prefix=subject_prefix)
        return {"whatsapp": {"+2250700000010": "sent"}, "email": {"coo@shizu.test": "sent"}}

    monkeypatch.setattr(alerts, "notify_admin_new_booking", fake_notify)
    assert script.main(["--send"]) == 0
    assert seen == {"id": "TEST", "prefix": "[TEST] "}


@pytest.mark.parametrize("result", [
    {"whatsapp": {"+2250700000010": "pending"}, "email": {"coo@shizu.test": "sent"}},
    {"whatsapp": {}, "email": {"coo@shizu.test": "failed"}},
    {"whatsapp": {}, "email": {}},
])
def test_exit_code_is_1_unless_every_recipient_is_reached(script, monkeypatch, result):
    monkeypatch.setattr(alerts, "notify_admin_new_booking", lambda b, **k: result)
    assert script.main(["--send"]) == 1
