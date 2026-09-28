"""
A failed WhatsApp send must leave a full traceback in the logs.

send_whatsapp and send_whatsapp_template swallow every exception on purpose —
a notification must never break the caller's main operation. The price of
that contract is that the log line is the ONLY trace of the failure, so it has
to carry exc_info: "send failed: <message>" alone does not say where Twilio
broke.

Usage:
    pytest tests/test_notification_logging.py -v
"""
import logging
import sys
import types

import pytest


@pytest.fixture()
def failing_twilio(monkeypatch):
    """Twilio configured, but every messages.create() raises."""
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_test")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    monkeypatch.delenv("TWILIO_STATUS_CALLBACK_URL", raising=False)

    import shizuverse.utils.notifications as n
    monkeypatch.setattr(n, "_TEMPLATE_SIDS", {"shizu_test_fr": "HX_test"})

    class FakeMessages:
        def create(self, **kwargs):
            raise RuntimeError("twilio exploded")

    class FakeClient:
        def __init__(self, *a, **k):
            self.messages = FakeMessages()

    fake = types.ModuleType("twilio.rest")
    fake.Client = FakeClient
    monkeypatch.setitem(sys.modules, "twilio.rest", fake)
    return n


def _failure_record(caplog):
    records = [r for r in caplog.records
               if r.levelno == logging.ERROR and "send failed" in r.getMessage()]
    assert len(records) == 1, [r.getMessage() for r in caplog.records]
    return records[0]


def test_free_form_failure_logs_traceback(failing_twilio, caplog):
    with caplog.at_level(logging.ERROR, logger="shizuverse.utils.notifications"):
        assert failing_twilio.send_whatsapp("+2250700000000", "hello") is False
    record = _failure_record(caplog)
    assert record.exc_info is not None
    assert record.exc_info[0] is RuntimeError


def test_template_failure_logs_traceback(failing_twilio, caplog):
    with caplog.at_level(logging.ERROR, logger="shizuverse.utils.notifications"):
        sent = failing_twilio.send_whatsapp_template(
            "+2250700000000", "shizu_test_fr", {"1": "Awa"})
    assert sent is False
    record = _failure_record(caplog)
    assert record.exc_info is not None
    assert record.exc_info[0] is RuntimeError
