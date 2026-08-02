"""
Litiges — notifications aux deux parties (LOT B).

Câblage débloqué par a5b4cd1 : le flux ne peut plus se rejouer, donc un client
ne peut plus recevoir « remboursement » puis « paiement libéré au prestataire »
sur le même dossier.

Ce que ces tests verrouillent, au-delà du chemin nominal :
  - la clé de template EXACTE (une clé absente du registre = envoi silencieux
    qui retourne False, jamais d'exception) ;
  - les variables positionnelles (Meta rejette un décompte faux avec 63028) ;
  - la garde provider_phone — un litige peut naître sur une réservation sans
    prestataire assigné, et l'envoi ne doit alors pas partir ;
  - le caractère NON bloquant : un litige doit s'ouvrir même si WhatsApp tombe ;
  - booking_id dans le statusCallback, sans quoi la ligne sortante est
    rattachée en devinant depuis le téléphone.

Usage:
    pytest tests/test_dispute_notifications.py -v
"""
import json
import sys
import types
from datetime import datetime, timedelta

import pytest

import werkzeug as _werkzeug
if not hasattr(_werkzeug, "__version__"):
    try:
        from importlib.metadata import version as _pkg_version
        _werkzeug.__version__ = _pkg_version("werkzeug")
    except Exception:
        _werkzeug.__version__ = "0"

import jwt as pyjwt
from flask import Flask

from shizuverse.models import db, ClientBooking
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.routes.admin import admin_bp as portal_bp

SECRET = "test-secret-key"
PROVIDER_PHONE = "+2250544332211"
CALLBACK_URL = "https://shizu-verse.onrender.com/api/webhooks/twilio/status"

DISPUTE_KEYS = [
    "shizu_dispute_opened_client_fr", "shizu_dispute_opened_client_en",
    "shizu_dispute_refund_client_fr", "shizu_dispute_refund_client_en",
    "shizu_dispute_closed_client_fr", "shizu_dispute_closed_client_en",
    "shizu_dispute_opened_provider_fr",
    "shizu_dispute_no_payment_provider_fr",
    "shizu_dispute_released_provider_fr",
]


@pytest.fixture()
def twilio(monkeypatch):
    """Capture every messages.create() the endpoints trigger."""
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_test")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    monkeypatch.setenv("TWILIO_STATUS_CALLBACK_URL", CALLBACK_URL)

    import shizuverse.utils.notifications as n
    monkeypatch.setattr(n, "_TEMPLATE_SIDS", {k: f"HX_{k}" for k in DISPUTE_KEYS})

    calls = []

    class FakeMessages:
        def create(self, **kw):
            calls.append(kw)
            return types.SimpleNamespace(sid=f"SM_{len(calls)}")

    class FakeClient:
        def __init__(self, *a, **k):
            self.messages = FakeMessages()

    fake = types.ModuleType("twilio.rest")
    fake.Client = FakeClient
    monkeypatch.setitem(sys.modules, "twilio.rest", fake)

    def sent():
        return [{"key": c["content_sid"].replace("HX_", ""),
                 "to": c["to"],
                 "vars": json.loads(c["content_variables"]),
                 "callback": c.get("status_callback", "")} for c in calls]

    return types.SimpleNamespace(sent=sent, calls=calls)


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'dn.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(application)
    application.register_blueprint(portal_bp)
    with application.app_context():
        db.create_all()
        cat = ServiceCategory(name="Ménage")
        db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Ménage standard", category_id=cat.id)
        db.session.add(sub); db.session.flush()
        svc = Service(name="Menage", subcategory_id=sub.id, is_active=True)
        db.session.add(svc); db.session.flush()
        db.session.commit()
        application.config["_SVC"] = svc.id
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_headers():
    token = pyjwt.encode({"sub": "admin", "exp": datetime.utcnow() + timedelta(days=1)},
                         SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def _make_booking(app, *, with_provider=True, locale="fr"):
    with app.app_context():
        b = ClientBooking(
            client_name="Awa Cliente", client_phone="+2250707050154",
            client_location="Cocody, Abidjan", service_name="Menage",
            service_id=app.config["_SVC"],
            appointment_date=datetime.utcnow() + timedelta(days=3),
            status="requested", amount_xof=40000, locale=locale,
        )
        if with_provider:
            b.provider_name = "Koffi Plomberie"
            b.provider_phone = PROVIDER_PHONE
        db.session.add(b); db.session.commit()
        return b.id


def _open(client, headers, bid):
    return client.post(f"/admin/bookings/{bid}/dispute",
                       json={"reason": "prestation contestée"}, headers=headers)


def _resolve(client, headers, bid, resolution):
    return client.post(f"/admin/bookings/{bid}/resolve-dispute",
                       json={"resolution": resolution}, headers=headers)


def _ref(app, bid):
    from shizuverse.utils.booking_ref import booking_ref
    with app.app_context():
        return booking_ref(db.session.get(ClientBooking, bid))


# ── Ouverture ────────────────────────────────────────────────────────────────

def test_open_dispute_notifies_both_sides(app, client, admin_headers, twilio):
    bid = _make_booking(app)
    ref = _ref(app, bid)
    assert _open(client, admin_headers, bid).status_code == 200

    sent = twilio.sent()
    assert len(sent) == 2, sent
    cli, pro = sent[0], sent[1]

    assert cli["key"] == "shizu_dispute_opened_client_fr"
    assert cli["to"] == "whatsapp:+2250707050154"
    assert cli["vars"] == {"1": "Awa Cliente", "2": ref}

    assert pro["key"] == "shizu_dispute_opened_provider_fr"
    assert pro["to"] == f"whatsapp:{PROVIDER_PHONE}"
    assert pro["vars"] == {"1": ref}


def test_open_dispute_without_provider_notifies_only_the_client(app, client,
                                                                admin_headers, twilio):
    """Un litige peut naître avant toute assignation — pas d'envoi dans le vide."""
    bid = _make_booking(app, with_provider=False)
    assert _open(client, admin_headers, bid).status_code == 200

    sent = twilio.sent()
    assert len(sent) == 1, sent
    assert sent[0]["key"] == "shizu_dispute_opened_client_fr"


def test_client_key_follows_the_booking_locale(app, client, admin_headers, twilio):
    bid = _make_booking(app, locale="en")
    _open(client, admin_headers, bid)
    assert twilio.sent()[0]["key"] == "shizu_dispute_opened_client_en"


def test_provider_key_stays_french_on_an_english_booking(app, client,
                                                         admin_headers, twilio):
    """T-19 : aucune variante _en prestataire n'existe au registre."""
    bid = _make_booking(app, locale="en")
    _open(client, admin_headers, bid)
    assert twilio.sent()[1]["key"] == "shizu_dispute_opened_provider_fr"


# ── Résolution : refund_client ───────────────────────────────────────────────

def test_refund_client_notifies_refund_and_no_payment(app, client, admin_headers, twilio):
    bid = _make_booking(app)
    ref = _ref(app, bid)
    _open(client, admin_headers, bid)
    twilio.calls.clear()

    assert _resolve(client, admin_headers, bid, "refund_client").status_code == 200
    sent = twilio.sent()
    assert [s["key"] for s in sent] == [
        "shizu_dispute_refund_client_fr", "shizu_dispute_no_payment_provider_fr"]
    assert sent[0]["vars"] == {"1": "Awa Cliente", "2": ref}
    assert sent[1]["vars"] == {"1": ref}


# ── Résolution : release_provider ────────────────────────────────────────────

def test_release_provider_notifies_closed_and_released(app, client, admin_headers, twilio):
    bid = _make_booking(app)
    ref = _ref(app, bid)
    _open(client, admin_headers, bid)
    twilio.calls.clear()

    assert _resolve(client, admin_headers, bid, "release_provider").status_code == 200
    sent = twilio.sent()
    assert [s["key"] for s in sent] == [
        "shizu_dispute_closed_client_fr", "shizu_dispute_released_provider_fr"]
    assert sent[0]["vars"] == {"1": "Awa Cliente", "2": ref}
    assert sent[1]["vars"] == {"1": ref}


def test_resolution_without_provider_notifies_only_the_client(app, client,
                                                              admin_headers, twilio):
    bid = _make_booking(app, with_provider=False)
    _open(client, admin_headers, bid)
    twilio.calls.clear()
    _resolve(client, admin_headers, bid, "refund_client")
    assert [s["key"] for s in twilio.sent()] == ["shizu_dispute_refund_client_fr"]


# ── booking_id dans le statusCallback ────────────────────────────────────────

def test_every_dispute_message_carries_its_booking_id(app, client, admin_headers, twilio):
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    _resolve(client, admin_headers, bid, "release_provider")

    assert twilio.sent(), "aucun envoi capturé"
    for s in twilio.sent():
        assert s["callback"].endswith(f"&b={bid}"), s


# ── Non bloquant ─────────────────────────────────────────────────────────────

def test_a_notification_failure_never_blocks_the_dispute(app, client, admin_headers,
                                                         twilio, monkeypatch):
    """WhatsApp tombe : le litige doit quand même être enregistré."""
    import shizuverse.utils.notifications as n

    def boom(**kwargs):
        raise RuntimeError("Twilio indisponible")

    monkeypatch.setattr(n, "notify_dispute_opened_client", boom)

    bid = _make_booking(app)
    r = _open(client, admin_headers, bid)
    assert r.status_code == 200, r.get_data(as_text=True)
    with app.app_context():
        assert db.session.get(ClientBooking, bid).dispute_flag is True


def test_a_resolution_survives_a_notification_failure(app, client, admin_headers,
                                                      twilio, monkeypatch):
    import shizuverse.utils.notifications as n
    bid = _make_booking(app)
    _open(client, admin_headers, bid)

    def boom(**kwargs):
        raise RuntimeError("Twilio indisponible")

    monkeypatch.setattr(n, "notify_dispute_refund_client", boom)
    r = _resolve(client, admin_headers, bid, "refund_client")
    assert r.status_code == 200, r.get_data(as_text=True)
    with app.app_context():
        b = db.session.get(ClientBooking, bid)
        assert b.dispute_resolution == "refund_client"
        assert b.payment_status == "refunded"


# ── Aucun envoi sur un appel refusé ──────────────────────────────────────────

def test_a_refused_replay_sends_nothing(app, client, admin_headers, twilio):
    """Les gardes de a5b4cd1 doivent aussi couper les messages, pas seulement
    l'écriture — sinon le rejeu réenvoie sans rien changer en base."""
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    _resolve(client, admin_headers, bid, "refund_client")
    twilio.calls.clear()

    assert _open(client, admin_headers, bid).status_code == 409
    assert _resolve(client, admin_headers, bid, "release_provider").status_code == 409
    assert twilio.sent() == [], "un appel refusé ne doit déclencher aucun message"
