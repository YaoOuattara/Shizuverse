"""
Tests for the amount-lock fix (immutability + traceability + payment tiers).

Runs entirely offline against a throwaway SQLite database using the Flask
test client — it never touches production / Neon. The two real admin
blueprints are mounted on a minimal app so the exact route handlers under
test are exercised:

    routes/admin.py  (blueprint 'admin_portal')  -> /admin/...
    api/admin.py     (blueprint 'admin')         -> /api/admin/...

Usage:
    pytest tests/test_amount_lock.py -v
"""

from datetime import datetime, timedelta

import jwt as pyjwt
import pytest

# Compat shim: some Flask/Werkzeug version combos in this env expose a
# Werkzeug that no longer defines __version__, which Flask's test client
# reads. Backfill it from package metadata so app.test_client() works.
import werkzeug as _werkzeug
if not hasattr(_werkzeug, "__version__"):
    try:
        from importlib.metadata import version as _pkg_version
        _werkzeug.__version__ = _pkg_version("werkzeug")
    except Exception:
        _werkzeug.__version__ = "0"

from flask import Flask

from shizuverse.models import db, ClientBooking, BookingEvent
from shizuverse.routes.admin import admin_bp as portal_bp
from shizuverse.api.admin import admin_bp as api_admin_bp
from shizuverse.utils.payment_rules import get_payment_tier, get_deposit_amount

SECRET = "test-secret-key"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def app(tmp_path):
    """Minimal Flask app with the two real admin blueprints and a fresh SQLite DB."""
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(application)
    application.register_blueprint(portal_bp)                          # /admin/...
    application.register_blueprint(api_admin_bp, url_prefix="/api/admin")  # /api/admin/...

    with application.app_context():
        db.create_all()
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_headers():
    """Forge a valid admin JWT (same HS256 scheme the decorators verify)."""
    token = pyjwt.encode(
        {"sub": "admin", "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def make_booking(app, **overrides):
    """Insert a ClientBooking directly and return its id."""
    with app.app_context():
        b = ClientBooking(
            client_name="Test Client",
            client_phone="0700000001",
            client_location="Cocody, Abidjan",
            service_name="Menage",
            appointment_date=datetime.utcnow() + timedelta(days=3),
            status="requested",
        )
        for key, value in overrides.items():
            setattr(b, key, value)
        db.session.add(b)
        db.session.commit()
        return b.id


def get_booking(app, bid):
    with app.app_context():
        return db.session.get(ClientBooking, bid)


def events_of(app, bid, event_type):
    with app.app_context():
        return BookingEvent.query.filter_by(booking_id=bid, event_type=event_type).all()


# ---------------------------------------------------------------------------
# TEST 1 — Assign blocked without lock
# ---------------------------------------------------------------------------

def test_1_assign_blocked_without_lock(app, client, admin_headers):
    bid = make_booking(app)  # amount_locked defaults to False
    resp = client.put(
        f"/api/admin/bookings/{bid}/assign",
        json={"provider_name": "Presta Test", "provider_phone": "0700000002"},
        headers=admin_headers,
    )
    assert resp.status_code == 400, resp.get_data(as_text=True)
    assert "confirmer le montant" in resp.get_json()["error"].lower()


# ---------------------------------------------------------------------------
# TEST 2 — Lock + BookingEvent
# ---------------------------------------------------------------------------

def test_2_lock_amount_success_and_event(app, client, admin_headers):
    bid = make_booking(app)
    resp = client.post(
        f"/admin/bookings/{bid}/lock-amount",
        json={"confirmed_amount": 20000},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)
    assert resp.get_json()["amount_locked"] is True

    b = get_booking(app, bid)
    assert b.amount_locked is True
    assert b.amount_locked_at is not None

    evs = events_of(app, bid, "amount_locked")
    assert len(evs) == 1
    assert evs[0].actor_id is None
    assert "20000" in (evs[0].note or "")


# ---------------------------------------------------------------------------
# TEST 3 — Immutability (the core fix)
# ---------------------------------------------------------------------------

def test_3a_quote_rejected_when_locked(app, client, admin_headers):
    bid = make_booking(
        app, amount_xof=20000, amount_locked=True, amount_locked_at=datetime.utcnow()
    )
    resp = client.post(
        f"/admin/bookings/{bid}/quote",
        json={"amount_xof": 99999},
        headers=admin_headers,
    )
    assert resp.status_code == 409, resp.get_data(as_text=True)

    b = get_booking(app, bid)
    assert b.amount_xof == 20000            # amount unchanged
    assert b.amount_locked is True          # no silent unlock


def test_3b_relock_rejected_when_locked(app, client, admin_headers):
    bid = make_booking(
        app, amount_xof=20000, amount_locked=True, amount_locked_at=datetime.utcnow()
    )
    resp = client.post(
        f"/admin/bookings/{bid}/lock-amount",
        json={"confirmed_amount": 99999},
        headers=admin_headers,
    )
    assert resp.status_code == 409, resp.get_data(as_text=True)
    assert get_booking(app, bid).amount_xof == 20000


# ---------------------------------------------------------------------------
# TEST 4 — Dispute unlock
# ---------------------------------------------------------------------------

def test_4a_unlock_requires_reason(app, client, admin_headers):
    bid = make_booking(
        app, amount_xof=20000, amount_locked=True, amount_locked_at=datetime.utcnow()
    )
    resp = client.post(
        f"/admin/bookings/{bid}/unlock-amount",
        json={},
        headers=admin_headers,
    )
    assert resp.status_code == 400, resp.get_data(as_text=True)
    assert get_booking(app, bid).amount_locked is True  # still locked


def test_4b_unlock_with_reason_and_event(app, client, admin_headers):
    bid = make_booking(
        app, amount_xof=20000, amount_locked=True, amount_locked_at=datetime.utcnow()
    )
    resp = client.post(
        f"/admin/bookings/{bid}/unlock-amount",
        json={"reason": "Litige client"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    b = get_booking(app, bid)
    assert b.amount_locked is False
    assert b.amount_locked_at is None

    evs = events_of(app, bid, "amount_unlocked")
    assert len(evs) == 1
    assert evs[0].actor_id is None
    assert "Litige client" in (evs[0].note or "")


def test_4c_quote_succeeds_after_unlock(app, client, admin_headers):
    bid = make_booking(
        app, amount_xof=20000, amount_locked=True, amount_locked_at=datetime.utcnow()
    )
    # unlock first
    client.post(
        f"/admin/bookings/{bid}/unlock-amount",
        json={"reason": "Litige client"},
        headers=admin_headers,
    )
    # now a new quote must be accepted
    resp = client.post(
        f"/admin/bookings/{bid}/quote",
        json={"amount_xof": 30000},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)
    assert get_booking(app, bid).amount_xof == 30000


# ---------------------------------------------------------------------------
# TEST 5 — Assignment traceability
# ---------------------------------------------------------------------------

def test_5_assign_creates_event(app, client, admin_headers):
    bid = make_booking(
        app, amount_xof=20000, amount_locked=True, amount_locked_at=datetime.utcnow()
    )
    resp = client.put(
        f"/api/admin/bookings/{bid}/assign",
        json={"provider_name": "Presta Test", "provider_phone": "0700000002"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    evs = events_of(app, bid, "provider_assigned")
    assert len(evs) == 1
    assert evs[0].actor_id is None
    assert evs[0].to_status == "assigned"
    assert "Presta Test" in (evs[0].note or "")


# ---------------------------------------------------------------------------
# TEST 6 — Payment tiers (pure unit test on payment_rules.py)
# ---------------------------------------------------------------------------

def test_6_payment_tiers():
    assert get_payment_tier(10000) == "after_service"
    assert get_payment_tier(30000) == "deposit_30"
    assert get_payment_tier(60000) == "full_prepay"  # NOT deposit_40


def test_6_full_prepay_deposit_is_total():
    assert get_deposit_amount(60000, "full_prepay") == 60000
