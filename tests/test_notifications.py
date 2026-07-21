"""
Tests for the WhatsApp *template* send path (LOT 3).

Runs entirely offline: a fake twilio.rest.Client is injected so we can assert
exactly what would hit Twilio — and, crucially, that nothing is sent when a
guard trips (unregistered template, empty/None variable).

Usage:
    pytest tests/test_notifications.py -v
"""
import sys
import json
import types

import pytest

from shizuverse.utils import notifications as notif


class _FakeMessages:
    def __init__(self, sink):
        self._sink = sink

    def create(self, **kwargs):
        self._sink.append(kwargs)
        return types.SimpleNamespace(sid="SM_fake")


class _FakeClient:
    # Set by the fixture before any client is constructed.
    sink = None

    def __init__(self, *args, **kwargs):
        self.messages = _FakeMessages(_FakeClient.sink)


@pytest.fixture
def twilio_sink(monkeypatch):
    """Enable Twilio with a fake Client; return the list of create() kwargs.
    An empty list after a call proves nothing was sent."""
    sink = []
    _FakeClient.sink = sink

    fake_rest = types.ModuleType("twilio.rest")
    fake_rest.Client = _FakeClient
    fake_twilio = types.ModuleType("twilio")
    fake_twilio.rest = fake_rest
    monkeypatch.setitem(sys.modules, "twilio", fake_twilio)
    monkeypatch.setitem(sys.modules, "twilio.rest", fake_rest)

    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_test")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    return sink


# ── Registry incomplete: template_key absent → False, nothing sent ────────────
def test_unregistered_template_returns_false_without_sending(twilio_sink, monkeypatch):
    monkeypatch.setattr(notif, "_TEMPLATE_SIDS", {})  # key not in registry
    ok = notif.send_whatsapp_template("+2250700000000", "shizu_devis_fr", {"1": "Awa"})
    assert ok is False
    assert twilio_sink == []  # never reached Twilio, no silent fallback


# ── Empty variable → False, nothing sent ──────────────────────────────────────
def test_empty_variable_refused(twilio_sink, monkeypatch):
    monkeypatch.setattr(notif, "_TEMPLATE_SIDS", {"shizu_devis_fr": "HX1"})
    ok = notif.send_whatsapp_template(
        "+2250700000000", "shizu_devis_fr", {"1": "Awa", "2": ""},
    )
    assert ok is False
    assert twilio_sink == []


# ── None variable → False, nothing sent ───────────────────────────────────────
def test_none_variable_refused(twilio_sink, monkeypatch):
    monkeypatch.setattr(notif, "_TEMPLATE_SIDS", {"shizu_devis_fr": "HX1"})
    ok = notif.send_whatsapp_template(
        "+2250700000000", "shizu_devis_fr", {"1": "Awa", "2": None},
    )
    assert ok is False
    assert twilio_sink == []


# ── Positional mapping for shizu_devis_fr matches the approved template ────────
def test_devis_fr_positional_mapping(twilio_sink, monkeypatch):
    monkeypatch.setattr(notif, "_TEMPLATE_SIDS", {"shizu_devis_fr": "HXdevisfr"})

    ok = notif.notify_payment_instructions(
        client_name="Awa",
        client_phone="+2250700000000",
        booking_ref="SHZ-2026-47",
        amount=25000,
        payment_tier="deposit_30",
        quote_token="tok_abc",
        locale="fr",
    )

    assert ok is True
    assert len(twilio_sink) == 1
    sent = twilio_sink[0]
    assert sent["content_sid"] == "HXdevisfr"
    assert sent["from_"] == "whatsapp:+14155238886"
    assert sent["to"].startswith("whatsapp:")

    variables = json.loads(sent["content_variables"])
    assert variables == {
        "1": "Awa",                                                 # client_name
        "2": "SHZ-2026-47",                                         # booking_ref
        "3": "25 000",                                              # amount (_fmt_amount)
        "4": "Acompte de 30% à la confirmation, solde à la fin.",   # tier_label (full phrase)
        "5": "tok_abc",                                            # quote_token (button var, alone)
    }


# ── Devis without a quote_token is refused (no accept/decline link) ───────────
def test_devis_without_quote_token_refused(twilio_sink, monkeypatch):
    monkeypatch.setattr(notif, "_TEMPLATE_SIDS", {"shizu_devis_fr": "HXdevisfr"})
    ok = notif.notify_payment_instructions(
        client_name="Awa", client_phone="+2250700000000",
        booking_ref="SHZ-2026-47", amount=25000, quote_token=None, locale="fr",
    )
    assert ok is False
    assert twilio_sink == []


# ── Malformed registry JSON must not crash the boot, yields empty registry ────
def test_load_template_sids_invalid_json(monkeypatch):
    monkeypatch.setenv("WHATSAPP_TEMPLATE_SIDS", "{not valid json")
    assert notif._load_template_sids() == {}

    monkeypatch.setenv("WHATSAPP_TEMPLATE_SIDS", '["a", "b"]')  # JSON, but not an object
    assert notif._load_template_sids() == {}

    monkeypatch.setenv("WHATSAPP_TEMPLATE_SIDS", '{"shizu_devis_fr": "HX9"}')
    assert notif._load_template_sids() == {"shizu_devis_fr": "HX9"}
