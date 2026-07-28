"""
Twilio inbound webhook + delivery statusCallback.

What must hold, and why each one matters:
  - an unsigned/badly-signed request is REFUSED (the endpoint is public);
  - a missing TWILIO_AUTH_TOKEN refuses too — never an open door;
  - a provider's number attaches to THEIR mission, a client's to THEIR booking;
  - a number that is both resolves to the provider AND keeps matched_role='both';
  - an unknown number is still STORED (booking_id NULL) — never dropped;
  - a Twilio retry (same MessageSid) never duplicates;
  - an internal error still answers 200, or Twilio retries forever;
  - a statusCallback records failed + ErrorCode on the right message.

Usage:
    pytest tests/test_whatsapp_inbound.py -v
"""
import json
import os
from datetime import datetime, timedelta
from urllib.parse import urlencode

import pytest

import werkzeug as _werkzeug
if not hasattr(_werkzeug, "__version__"):
    try:
        from importlib.metadata import version as _pkg_version
        _werkzeug.__version__ = _pkg_version("werkzeug")
    except Exception:
        _werkzeug.__version__ = "0"

from flask import Flask

from shizuverse.models import db, User, ClientBooking
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.models.whatsapp_message import WhatsAppMessage
from shizuverse.api.webhooks import webhooks_bp
from shizuverse.limiter import limiter

AUTH_TOKEN = "test_auth_token_0123456789"
BASE_URL = "http://localhost"

CLIENT_PHONE = "+2250707050154"     # client only
PROVIDER_PHONE = "+2250544332211"   # provider only
BOTH_PHONE = "+2250505050505"       # provider AND client — the test number case
UNKNOWN_PHONE = "+2250708000000"


def _sign(url, params):
    """Real Twilio signature — we exercise the validator, not a stub."""
    from twilio.request_validator import RequestValidator
    return RequestValidator(AUTH_TOKEN).compute_signature(url, params)


@pytest.fixture()
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", AUTH_TOKEN)

    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = "t"
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'wa.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    application.config["RATELIMIT_ENABLED"] = False

    db.init_app(application)
    limiter.init_app(application)
    application.register_blueprint(webhooks_bp, url_prefix="/api/webhooks")

    with application.app_context():
        db.create_all()

        # Client-only booking
        cb = ClientBooking(
            client_name="Awa Cliente", client_phone=CLIENT_PHONE,
            client_location="Cocody, Abidjan", service_name="Ménage",
            appointment_date=datetime.utcnow() + timedelta(days=2),
            status="requested", created_at=datetime.utcnow() - timedelta(days=1),
        )
        # Mission assigned to the provider-only number
        pb = ClientBooking(
            client_name="Client X", client_phone="+2250700000011",
            client_location="Marcory, Abidjan", service_name="Plomberie",
            appointment_date=datetime.utcnow() + timedelta(days=1),
            status="assigned", provider_name="Koffi Plombier",
            provider_phone=PROVIDER_PHONE, created_at=datetime.utcnow(),
        )
        # The dual-role number: a booking as CLIENT…
        both_client = ClientBooking(
            client_name="Yao Double", client_phone=BOTH_PHONE,
            client_location="Zone 4, Abidjan", service_name="Électricité",
            appointment_date=datetime.utcnow() + timedelta(days=3),
            status="requested", created_at=datetime.utcnow() - timedelta(days=2),
        )
        # …and a mission as PROVIDER
        both_mission = ClientBooking(
            client_name="Autre Client", client_phone="+2250700000022",
            client_location="Bingerville, Abidjan", service_name="Peinture",
            appointment_date=datetime.utcnow() + timedelta(days=1),
            status="assigned", provider_name="Yao Double",
            provider_phone=BOTH_PHONE, created_at=datetime.utcnow(),
        )
        db.session.add_all([cb, pb, both_client, both_mission])

        cat = ServiceCategory(name="Plomberie")
        db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Plomberie standard", category_id=cat.id)
        db.session.add(sub); db.session.flush()
        svc = Service(name="Plomberie", subcategory_id=sub.id, is_active=True)
        db.session.add(svc); db.session.flush()

        u1 = User(email=None, user_type="provider", full_name="Koffi Plombier")
        u1.password_hash = "test-hash"
        u2 = User(email=None, user_type="provider", full_name="Yao Double")
        u2.password_hash = "test-hash"
        db.session.add_all([u1, u2])
        db.session.flush()
        db.session.add_all([
            ServiceProvider(user_id=u1.id, service_id=svc.id, phone_number=PROVIDER_PHONE,
                            company_name="Koffi Plomberie",
                            verification_status="approved", provider_status="active"),
            ServiceProvider(user_id=u2.id, service_id=svc.id, phone_number=BOTH_PHONE,
                            company_name="Yao Peinture",
                            verification_status="approved", provider_status="active"),
        ])
        db.session.commit()

        application.config["_IDS"] = {
            "client_booking": cb.id, "provider_mission": pb.id,
            "both_client": both_client.id, "both_mission": both_mission.id,
        }

    yield application

    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _post_inbound(client, params, sign=True, url_path="/api/webhooks/twilio/inbound"):
    url = BASE_URL + url_path
    headers = {}
    if sign:
        headers["X-Twilio-Signature"] = _sign(url, params)
    return client.post(url_path, data=params, headers=headers,
                       content_type="application/x-www-form-urlencoded")


def _inbound_params(from_phone, body="Bonjour", sid="SM_TEST_1", num_media="0"):
    return {
        "MessageSid": sid,
        "From": f"whatsapp:{from_phone}",
        "To": "whatsapp:+14155238886",
        "Body": body,
        "NumMedia": num_media,
    }


# ── Signature ────────────────────────────────────────────────────────────────

def test_unsigned_request_is_refused(app, client):
    r = _post_inbound(client, _inbound_params(CLIENT_PHONE), sign=False)
    assert r.status_code == 403
    with app.app_context():
        assert WhatsAppMessage.query.count() == 0, "rien ne doit être écrit sans signature"


def test_bad_signature_is_refused(app, client):
    params = _inbound_params(CLIENT_PHONE)
    r = client.post("/api/webhooks/twilio/inbound", data=params,
                    headers={"X-Twilio-Signature": "totalement-faux"},
                    content_type="application/x-www-form-urlencoded")
    assert r.status_code == 403
    with app.app_context():
        assert WhatsAppMessage.query.count() == 0


def test_tampered_body_is_refused(app, client):
    """Signature computed on one body, a different body sent — must not pass."""
    params = _inbound_params(CLIENT_PHONE)
    sig = _sign(BASE_URL + "/api/webhooks/twilio/inbound", params)
    params["Body"] = "message modifié après signature"
    r = client.post("/api/webhooks/twilio/inbound", data=params,
                    headers={"X-Twilio-Signature": sig},
                    content_type="application/x-www-form-urlencoded")
    assert r.status_code == 403


def test_missing_auth_token_refuses_never_opens(app, client, monkeypatch):
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    r = _post_inbound(client, _inbound_params(CLIENT_PHONE))
    assert r.status_code == 403, "sans token, on REFUSE — jamais de passage silencieux"
    with app.app_context():
        assert WhatsAppMessage.query.count() == 0


# ── Rattachement ─────────────────────────────────────────────────────────────

def test_client_number_attaches_to_their_booking(app, client):
    r = _post_inbound(client, _inbound_params(CLIENT_PHONE, "Je confirme pour demain"))
    assert r.status_code == 200
    with app.app_context():
        m = WhatsAppMessage.query.one()
        assert m.direction == "inbound"
        assert m.matched_role == "client"
        assert m.booking_id == app.config["_IDS"]["client_booking"]
        assert m.provider_id is None
        assert m.body == "Je confirme pour demain"
        assert m.from_phone == CLIENT_PHONE


def test_provider_number_attaches_to_their_mission(app, client):
    r = _post_inbound(client, _inbound_params(PROVIDER_PHONE, "J'accepte la mission"))
    assert r.status_code == 200
    with app.app_context():
        m = WhatsAppMessage.query.one()
        assert m.matched_role == "provider"
        assert m.booking_id == app.config["_IDS"]["provider_mission"]
        assert m.provider_id is not None


def test_dual_role_number_resolves_to_provider_and_keeps_both(app, client):
    r = _post_inbound(client, _inbound_params(BOTH_PHONE, "Question"))
    assert r.status_code == 200
    with app.app_context():
        m = WhatsAppMessage.query.one()
        assert m.matched_role == "both", "l'ambiguïté doit être conservée, pas écrasée"
        assert m.booking_id == app.config["_IDS"]["both_mission"], "prestataire d'abord"
        assert m.provider_id is not None


def test_unknown_number_is_stored_not_dropped(app, client):
    r = _post_inbound(client, _inbound_params(UNKNOWN_PHONE, "Bonjour, vous faites quoi ?"))
    assert r.status_code == 200
    with app.app_context():
        m = WhatsAppMessage.query.one()
        assert m.matched_role == "none"
        assert m.booking_id is None
        assert m.body == "Bonjour, vous faites quoi ?", "un inconnu ne doit JAMAIS être perdu"


def test_local_format_number_still_attaches(app, client):
    """T-22 — the sender's number may arrive in a shape we don't store verbatim."""
    r = _post_inbound(client, _inbound_params("0707050154", "Format local"))
    assert r.status_code == 200
    with app.app_context():
        m = WhatsAppMessage.query.one()
        assert m.matched_role == "client"
        assert m.booking_id == app.config["_IDS"]["client_booking"]
        assert m.from_phone_raw == "0707050154", "le brut est conservé tel quel"
        assert m.from_phone == CLIENT_PHONE, "le normalisé sert au rattachement"


# ── Robustesse ───────────────────────────────────────────────────────────────

def test_twilio_retry_does_not_duplicate(app, client):
    params = _inbound_params(CLIENT_PHONE, sid="SM_RETRY")
    assert _post_inbound(client, params).status_code == 200
    assert _post_inbound(client, params).status_code == 200
    with app.app_context():
        assert WhatsAppMessage.query.filter_by(message_sid="SM_RETRY").count() == 1


def test_media_message_is_flagged(app, client):
    p = _inbound_params(CLIENT_PHONE, body="", num_media="2")
    assert _post_inbound(client, p).status_code == 200
    with app.app_context():
        assert WhatsAppMessage.query.one().num_media == 2


def test_payload_without_sid_is_ignored_but_answers_200(app, client):
    params = {"From": f"whatsapp:{CLIENT_PHONE}", "Body": "sans sid"}
    r = _post_inbound(client, params)
    assert r.status_code == 200, "toujours 200 — sinon Twilio retente en boucle"
    with app.app_context():
        assert WhatsAppMessage.query.count() == 0


def test_internal_error_still_answers_200(app, client, monkeypatch):
    """A bug on our side must never turn into a Twilio retry storm."""
    import shizuverse.api.webhooks as wh

    def boom(_phone):
        raise RuntimeError("résolution cassée")

    monkeypatch.setattr(wh, "resolve_phone", boom)
    r = _post_inbound(client, _inbound_params(CLIENT_PHONE, sid="SM_BOOM"))
    assert r.status_code == 200


def test_response_is_empty_twiml_no_autoreply(app, client):
    r = _post_inbound(client, _inbound_params(CLIENT_PHONE))
    assert b"<Response></Response>" in r.data, "pas d'auto-réponse : elle consommerait la fenêtre 24h"


# ── statusCallback ───────────────────────────────────────────────────────────

def _post_status(client, params, query=""):
    path = "/api/webhooks/twilio/status" + query
    url = BASE_URL + path
    return client.post(path, data=params,
                       headers={"X-Twilio-Signature": _sign(url, params)},
                       content_type="application/x-www-form-urlencoded")


def test_status_callback_records_failure_with_error_code(app, client):
    params = {"MessageSid": "SM_OUT_1", "MessageStatus": "failed",
              "ErrorCode": "63016", "To": f"whatsapp:{PROVIDER_PHONE}",
              "From": "whatsapp:+14155238886"}
    r = _post_status(client, params, query="?k=shizu_provider_new_mission_fr")
    assert r.status_code == 204
    with app.app_context():
        m = WhatsAppMessage.query.filter_by(message_sid="SM_OUT_1").one()
        assert m.direction == "outbound"
        assert m.status == "failed"
        assert m.error_code == "63016", "le code d'erreur est ce qui rend l'échec visible"
        assert m.template_key == "shizu_provider_new_mission_fr"
        assert m.booking_id == app.config["_IDS"]["provider_mission"]


def test_status_callback_updates_same_row(app, client):
    base = {"To": f"whatsapp:{CLIENT_PHONE}", "From": "whatsapp:+14155238886"}
    _post_status(client, {**base, "MessageSid": "SM_OUT_2", "MessageStatus": "sent"})
    _post_status(client, {**base, "MessageSid": "SM_OUT_2", "MessageStatus": "delivered"})
    _post_status(client, {**base, "MessageSid": "SM_OUT_2", "MessageStatus": "read"})
    with app.app_context():
        rows = WhatsAppMessage.query.filter_by(message_sid="SM_OUT_2").all()
        assert len(rows) == 1, "un seul enregistrement par MessageSid"
        assert rows[0].status == "read"
        assert rows[0].status_updated_at is not None


def test_status_callback_requires_signature(app, client):
    params = {"MessageSid": "SM_OUT_3", "MessageStatus": "delivered"}
    r = client.post("/api/webhooks/twilio/status", data=params,
                    content_type="application/x-www-form-urlencoded")
    assert r.status_code == 403


# ── statusCallback opt-in (notifications.py) ─────────────────────────────────

def test_status_callback_absent_by_default(monkeypatch):
    """No env var → messages.create() is called exactly as before."""
    monkeypatch.delenv("TWILIO_STATUS_CALLBACK_URL", raising=False)
    from shizuverse.utils.notifications import _status_callback_kwargs
    assert _status_callback_kwargs() == {}
    assert _status_callback_kwargs("shizu_devis_fr") == {}


def test_status_callback_carries_template_key(monkeypatch):
    monkeypatch.setenv("TWILIO_STATUS_CALLBACK_URL",
                       "https://shizu-verse.onrender.com/api/webhooks/twilio/status")
    from shizuverse.utils.notifications import _status_callback_kwargs
    assert _status_callback_kwargs() == {
        "status_callback": "https://shizu-verse.onrender.com/api/webhooks/twilio/status"}
    out = _status_callback_kwargs("shizu_provider_new_mission_fr")["status_callback"]
    assert out.endswith("?k=shizu_provider_new_mission_fr")
