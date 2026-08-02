"""
T-18 — the money trail must be REPLAYABLE, not merely enforced.

The lock invariant itself is covered by test_amount_lock.py (a locked amount
cannot be re-quoted, re-locked, or silently overwritten). What this file pins is
the other half: after a dispute cycle, can we still say WHICH amounts were in
play and in what order?

The booking row only ever holds the LATEST value. So the sequence
    quote at X → client accepts (lock at X) → dispute unlock → re-quote at Y
      → client accepts (lock at Y)
is reconstructible only if every step recorded its own amount. Three events used
to omit it — quoting recorded nothing at all, and both lock notes had dropped
the figure — which made exactly this scenario unreplayable.

Amounts are asserted RAW (20000, not "20 000"): an audit note is parsed, not
read aloud. The human-facing formatter lives in notifications._fmt_amount and
has no business here.

Usage:
    pytest tests/test_amount_audit_trail.py -v
"""
import re
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

from shizuverse.models import db, User, ClientBooking
from shizuverse.models.booking_event import BookingEvent
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.routes.admin import admin_bp as portal_bp
from shizuverse.api.quote import quote_bp
from shizuverse.limiter import limiter

SECRET = "test-secret-key"
QUOTE_1 = 20000    # first quote, accepted by the client
QUOTE_2 = 35000    # re-quote after the dispute unlock


@pytest.fixture()
def app(tmp_path):
    """Admin portal + the PUBLIC quote blueprint — the client acceptance path is
    where the amount actually gets locked, so it must be exercised for real."""
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'audit.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    application.config["RATELIMIT_ENABLED"] = False

    db.init_app(application)
    limiter.init_app(application)
    application.register_blueprint(portal_bp)                     # /admin/...
    application.register_blueprint(quote_bp, url_prefix="/api/quote")

    with application.app_context():
        db.create_all()
        cat = ServiceCategory(name="Ménage")
        db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Ménage standard", category_id=cat.id)
        db.session.add(sub); db.session.flush()
        svc = Service(name="Menage", subcategory_id=sub.id, is_active=True)
        db.session.add(svc); db.session.flush()
        user = User(email=None, user_type="provider", preferred_language="fr")
        user.password_hash = "test-hash"
        db.session.add(user); db.session.flush()
        db.session.add(ServiceProvider(
            user_id=user.id, service_id=svc.id,
            company_name="Presta Test", phone_number="+2250700000002",
            verification_status="approved", provider_status="active",
        ))
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
    token = pyjwt.encode(
        {"sub": "admin", "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET, algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def _make_booking(app):
    with app.app_context():
        b = ClientBooking(
            client_name="Test Client", client_phone="0700000001",
            client_location="Cocody, Abidjan", service_name="Menage",
            service_id=app.config["_SVC"],
            appointment_date=datetime.utcnow() + timedelta(days=3),
            status="requested",
        )
        db.session.add(b); db.session.commit()
        return b.id


def _token(app, bid):
    with app.app_context():
        return db.session.get(ClientBooking, bid).quote_token


def _history(app, bid):
    """(event_type, note) in chronological order — the admin's audit view."""
    with app.app_context():
        evs = (BookingEvent.query.filter_by(booking_id=bid)
               .order_by(BookingEvent.id.asc()).all())
        return [(e.event_type, e.note or "") for e in evs]


def _amount_in(note):
    """The XOF figure a note records, or None. Mirrors what a human auditor does."""
    m = re.search(r"(\d+)\s*XOF", note)
    return int(m.group(1)) if m else None


# ── Each step records its own amount ─────────────────────────────────────────

def test_quote_creates_an_event_carrying_the_amount(app, client, admin_headers):
    """Quoting was invisible in the history — the widest of the three holes."""
    bid = _make_booking(app)
    r = client.post(f"/admin/bookings/{bid}/quote",
                    json={"amount_xof": QUOTE_1}, headers=admin_headers)
    assert r.status_code == 200, r.get_data(as_text=True)

    quotes = [(t, n) for t, n in _history(app, bid) if t == "quote_set"]
    assert len(quotes) == 1, "la pose du devis doit laisser une trace"
    assert _amount_in(quotes[0][1]) == QUOTE_1


def test_client_acceptance_lock_records_the_amount(app, client, admin_headers):
    bid = _make_booking(app)
    client.post(f"/admin/bookings/{bid}/quote",
                json={"amount_xof": QUOTE_1}, headers=admin_headers)
    r = client.post(f"/api/quote/{_token(app, bid)}/accept", json={})
    assert r.status_code == 200, r.get_data(as_text=True)

    locks = [(t, n) for t, n in _history(app, bid) if t == "amount_locked"]
    assert len(locks) == 1
    assert _amount_in(locks[0][1]) == QUOTE_1
    # The two lock paths must stay distinguishable (the point of 349a68e).
    assert "acceptation du devis par le client" in locks[0][1]


def test_manual_lock_records_the_amount_and_stays_distinguishable(app, client, admin_headers):
    bid = _make_booking(app)
    r = client.post(f"/admin/bookings/{bid}/lock-amount",
                    json={"confirmed_amount": QUOTE_1}, headers=admin_headers)
    assert r.status_code == 200, r.get_data(as_text=True)

    locks = [(t, n) for t, n in _history(app, bid) if t == "amount_locked"]
    assert _amount_in(locks[0][1]) == QUOTE_1
    assert "hors app" in locks[0][1], "le verrou manuel doit rester reconnaissable"


def test_unlock_records_the_amount_being_unlocked(app, client, admin_headers):
    """Without it, the value in force before the dispute is lost forever."""
    bid = _make_booking(app)
    client.post(f"/admin/bookings/{bid}/lock-amount",
                json={"confirmed_amount": QUOTE_1}, headers=admin_headers)
    r = client.post(f"/admin/bookings/{bid}/unlock-amount",
                    json={"reason": "litige client"}, headers=admin_headers)
    assert r.status_code == 200, r.get_data(as_text=True)

    unlocks = [(t, n) for t, n in _history(app, bid) if t == "amount_unlocked"]
    assert len(unlocks) == 1
    assert _amount_in(unlocks[0][1]) == QUOTE_1, \
        "le montant déverrouillé doit être consigné, pas seulement le motif"
    assert "litige client" in unlocks[0][1]


# ── The invariant that matters: replay the whole dispute cycle ───────────────

def test_full_dispute_cycle_is_reconstructible_from_history(app, client, admin_headers):
    """quote → accept → unlock → re-quote → accept.

    Only the history can answer "which amounts were in play, in what order?" —
    the booking row holds nothing but the last one.
    """
    bid = _make_booking(app)

    # 1. Quote at 20000, client accepts → locked at 20000
    assert client.post(f"/admin/bookings/{bid}/quote", json={"amount_xof": QUOTE_1},
                       headers=admin_headers).status_code == 200
    assert client.post(f"/api/quote/{_token(app, bid)}/accept",
                       json={}).status_code == 200

    # 2. Dispute: unlock
    assert client.post(f"/admin/bookings/{bid}/unlock-amount",
                       json={"reason": "prestation contestée"},
                       headers=admin_headers).status_code == 200

    # 3. Re-quote at 35000, client accepts again → locked at 35000
    assert client.post(f"/admin/bookings/{bid}/quote", json={"amount_xof": QUOTE_2},
                       headers=admin_headers).status_code == 200
    assert client.post(f"/api/quote/{_token(app, bid)}/accept",
                       json={}).status_code == 200

    history = _history(app, bid)
    money = [(t, _amount_in(n)) for t, n in history
             if t in ("quote_set", "amount_locked", "amount_unlocked")]

    assert money == [
        ("quote_set",       QUOTE_1),
        ("amount_locked",   QUOTE_1),
        ("amount_unlocked", QUOTE_1),
        ("quote_set",       QUOTE_2),
        ("amount_locked",   QUOTE_2),
    ], f"séquence non reconstituable — historique réel : {history}"

    # And the row itself only knows the last value, which is exactly why the
    # history above has to carry the rest.
    with app.app_context():
        assert db.session.get(ClientBooking, bid).amount_xof == QUOTE_2


def test_no_money_event_omits_its_amount(app, client, admin_headers):
    """Guard for the next change: a money event with no figure is a blind spot."""
    bid = _make_booking(app)
    client.post(f"/admin/bookings/{bid}/quote", json={"amount_xof": QUOTE_1},
                headers=admin_headers)
    client.post(f"/api/quote/{_token(app, bid)}/accept", json={})
    client.post(f"/admin/bookings/{bid}/unlock-amount", json={"reason": "litige"},
                headers=admin_headers)

    for event_type, note in _history(app, bid):
        if event_type in ("quote_set", "amount_locked", "amount_unlocked"):
            assert _amount_in(note) is not None, \
                f"l'événement {event_type} ne consigne aucun montant : {note!r}"
