"""
Free-request (demande libre) guards — T-28.

A booking created from the hero free-text entry has service_id NULL and
service_name "Demande libre". Two invariants:

1. assign_booking REFUSES such a booking (400 + zero mutation, zero event) —
   the only point where "Demande libre" would leak to a provider's WhatsApp.
2. PATCH /admin/bookings/<id>/service classifies it (writes service_id +
   service_name + a 'service_classified' event); reclassifying an
   already-categorized booking is refused.

Plus the exit-criterion flow server-side: classify → assign succeeds.

Offline (throwaway SQLite, Flask test client), same harness as
test_status_assign_guard (T-27).

Usage:
    pytest tests/test_free_request_flow.py -v
"""

from datetime import datetime, timedelta

import jwt as pyjwt
import pytest

import werkzeug as _werkzeug
if not hasattr(_werkzeug, "__version__"):
    try:
        from importlib.metadata import version as _pkg_version
        _werkzeug.__version__ = _pkg_version("werkzeug")
    except Exception:
        _werkzeug.__version__ = "0"

from flask import Flask

from shizuverse.models import db, ClientBooking, BookingEvent, User
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.routes.admin import admin_bp as portal_bp
from shizuverse.api.admin import admin_bp as api_admin_bp

SECRET = "test-secret-key"

PROVIDER_PHONE = "+2250700000002"   # normalized form stored on the SP row


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(application)
    application.register_blueprint(portal_bp)                              # /admin/...
    application.register_blueprint(api_admin_bp, url_prefix="/api/admin")  # /api/admin/...

    with application.app_context():
        db.create_all()
        # Real service chain (Service.subcategory_id is NOT NULL).
        cat = ServiceCategory(name="Plomberie")
        db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Réparation fuite", category_id=cat.id)
        db.session.add(sub); db.session.flush()
        svc = Service(name="Réparation de fuite", subcategory_id=sub.id, is_active=True)
        db.session.add(svc); db.session.flush()
        # Approved provider (person-level approval, T-20) for the assign flow.
        user = User(email=None, user_type="provider", preferred_language="fr")
        # set_password uses scrypt, unavailable on this Python/LibreSSL build —
        # auth is not under test, a dummy hash satisfies the NOT NULL column.
        user.password_hash = "test-hash"
        db.session.add(user); db.session.flush()
        sp = ServiceProvider(
            user_id=user.id, service_id=svc.id,
            company_name="Presta Test", phone_number=PROVIDER_PHONE,
            verification_status="approved", provider_status="active",
        )
        db.session.add(sp)
        db.session.commit()
        application.config["_TEST_SERVICE_ID"] = svc.id
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


def make_booking(app, **overrides):
    with app.app_context():
        b = ClientBooking(
            client_name="Test Client",
            client_phone="+2250700000001",
            client_location="Cocody, Abidjan",
            service_name="Demande libre",
            service_id=None,                       # free request
            appointment_date=datetime.utcnow() + timedelta(days=2),
            status="under_review",
        )
        for key, value in overrides.items():
            setattr(b, key, value)
        db.session.add(b)
        db.session.commit()
        return b.id


def get_booking(app, bid):
    with app.app_context():
        return db.session.get(ClientBooking, bid)


def all_events(app, bid):
    with app.app_context():
        return BookingEvent.query.filter_by(booking_id=bid).all()


# ── 1. Assign refused on a free request: 400 + ZERO mutation/event ───────────

def test_assign_refused_when_unclassified(app, client, admin_headers):
    bid = make_booking(app, amount_locked=True, amount_xof=25000)

    resp = client.put(
        f"/api/admin/bookings/{bid}/assign",
        json={"provider_name": "Presta Test", "provider_phone": PROVIDER_PHONE},
        headers=admin_headers,
    )

    assert resp.status_code == 400, resp.get_data(as_text=True)
    assert "Classez la demande" in resp.get_json()["error"]

    b = get_booking(app, bid)
    assert b.status == "under_review"           # no mutation
    assert b.provider_name is None
    assert b.provider_phone is None
    assert len(all_events(app, bid)) == 0       # guard sits BEFORE any write


# ── 2. Classification: writes service + event ────────────────────────────────

def test_classify_free_request(app, client, admin_headers):
    bid = make_booking(app)
    svc_id = app.config["_TEST_SERVICE_ID"]

    resp = client.patch(
        f"/admin/bookings/{bid}/service",
        json={"service_id": svc_id},
        headers=admin_headers,
    )

    assert resp.status_code == 200, resp.get_data(as_text=True)
    b = get_booking(app, bid)
    assert b.service_id == svc_id
    assert b.service_name == "Réparation de fuite"

    evs = [e for e in all_events(app, bid) if e.event_type == "service_classified"]
    assert len(evs) == 1
    assert "Demande libre" in (evs[0].note or "")
    assert "Réparation de fuite" in (evs[0].note or "")


# ── 3. Reclassifying a categorized booking is out of scope ───────────────────

def test_classify_refused_when_already_classified(app, client, admin_headers):
    svc_id = app.config["_TEST_SERVICE_ID"]
    bid = make_booking(app, service_id=svc_id, service_name="Réparation de fuite")

    resp = client.patch(
        f"/admin/bookings/{bid}/service",
        json={"service_id": svc_id},
        headers=admin_headers,
    )

    assert resp.status_code == 400, resp.get_data(as_text=True)
    assert "déjà classée" in resp.get_json()["error"]
    assert len(all_events(app, bid)) == 0       # nothing written


# ── 4. Exit criterion (server side): classify → assign succeeds ──────────────

def test_classified_free_request_can_be_assigned(app, client, admin_headers):
    bid = make_booking(app, amount_locked=True, amount_xof=25000)
    svc_id = app.config["_TEST_SERVICE_ID"]

    r1 = client.patch(f"/admin/bookings/{bid}/service",
                      json={"service_id": svc_id}, headers=admin_headers)
    assert r1.status_code == 200, r1.get_data(as_text=True)

    r2 = client.put(
        f"/api/admin/bookings/{bid}/assign",
        json={"provider_name": "Presta Test", "provider_phone": PROVIDER_PHONE},
        headers=admin_headers,
    )
    assert r2.status_code == 200, r2.get_data(as_text=True)

    b = get_booking(app, bid)
    assert b.status == "assigned"
    assert b.provider_phone == PROVIDER_PHONE
    types = [e.event_type for e in all_events(app, bid)]
    assert "service_classified" in types
    assert "provider_assigned" in types
