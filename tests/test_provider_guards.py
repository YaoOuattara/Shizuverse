"""
Provider-side guards (T-26/T-28 pool closure + paused, person-level T-20).

Invariants:
1. accept REFUSES raw requests (403, zero mutation) — the legacy open pool is
   closed; a provider only takes missions the admin assigned to THEM.
2. accept REFUSES a mission assigned to another provider (403).
3. A PAUSED provider is refused everywhere: manual assign (400), accept (403),
   start (403) — the AI matcher already excluded them.
4. Positive control: active provider accepts + starts their own assigned
   mission.
5. The bookings feed serves OWN missions only — no masked open pool.

Offline (throwaway SQLite, Flask test client), pattern T-27/T-28.

Usage:
    pytest tests/test_provider_guards.py -v
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
from shizuverse.api.admin import admin_bp as api_admin_bp, provider_bp

SECRET = "test-secret-key"

ACTIVE_PHONE = "+2250700000002"
PAUSED_PHONE = "+2250700000003"
OTHER_PHONE = "+2250700000004"


def _mk_user():
    u = User(email=None, user_type="provider", preferred_language="fr")
    u.password_hash = "test-hash"
    db.session.add(u)
    db.session.flush()
    return u


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(application)
    application.register_blueprint(api_admin_bp, url_prefix="/api/admin")
    application.register_blueprint(provider_bp, url_prefix="/api/provider")

    with application.app_context():
        db.create_all()
        cat = ServiceCategory(name="Plomberie"); db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Fuite", category_id=cat.id); db.session.add(sub); db.session.flush()
        svc = Service(name="Réparation de fuite", subcategory_id=sub.id, is_active=True)
        db.session.add(svc); db.session.flush()

        def mk_sp(phone, name, status):
            u = _mk_user()
            sp = ServiceProvider(
                user_id=u.id, service_id=svc.id, company_name=name,
                phone_number=phone, verification_status="approved",
                provider_status=status,
            )
            db.session.add(sp); db.session.flush()
            return sp.id

        application.config["_SVC_ID"] = svc.id
        application.config["_SP_ACTIVE"] = mk_sp(ACTIVE_PHONE, "Presta Actif", "active")
        application.config["_SP_PAUSED"] = mk_sp(PAUSED_PHONE, "Presta Pause", "paused")
        db.session.commit()
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _admin_headers():
    token = pyjwt.encode(
        {"sub": "admin", "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def _provider_headers(sp_id):
    token = pyjwt.encode(
        {"sub": "1", "type": "provider", "provider_id": sp_id,
         "exp": datetime.utcnow() + timedelta(hours=1)},
        SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def make_booking(app, **overrides):
    with app.app_context():
        b = ClientBooking(
            client_name="Test Client",
            client_phone="+2250700000001",
            client_location="Cocody, Abidjan",
            service_name="Réparation de fuite",
            service_id=app.config["_SVC_ID"],
            appointment_date=datetime.utcnow() + timedelta(days=2),
            status="requested",
        )
        for k, v in overrides.items():
            setattr(b, k, v)
        db.session.add(b); db.session.commit()
        return b.id


def get_booking(app, bid):
    with app.app_context():
        return db.session.get(ClientBooking, bid)


def all_events(app, bid):
    with app.app_context():
        return BookingEvent.query.filter_by(booking_id=bid).all()


# ── 1. Pool closed: accepting a raw request → 403, ZERO mutation ─────────────

@pytest.mark.parametrize("status", ["requested", "pending"])
def test_accept_refuses_open_pool(app, client, status):
    bid = make_booking(app, status=status)
    r = client.patch(f"/api/provider/bookings/{bid}/accept",
                     headers=_provider_headers(app.config["_SP_ACTIVE"]))
    assert r.status_code == 403, r.get_data(as_text=True)
    assert "pas encore assignée" in r.get_json()["error"]
    b = get_booking(app, bid)
    assert b.status == status
    assert b.provider_name is None
    assert len(all_events(app, bid)) == 0


# ── 2. Assigned to someone else → 403 ────────────────────────────────────────

def test_accept_refuses_other_providers_mission(app, client):
    bid = make_booking(app, status="assigned",
                       provider_name="Autre", provider_phone=OTHER_PHONE)
    r = client.patch(f"/api/provider/bookings/{bid}/accept",
                     headers=_provider_headers(app.config["_SP_ACTIVE"]))
    assert r.status_code == 403, r.get_data(as_text=True)
    assert "autre prestataire" in r.get_json()["error"]
    assert get_booking(app, bid).status == "assigned"
    assert len(all_events(app, bid)) == 0


# ── 3. Paused refused on assign / accept / start ─────────────────────────────

def test_paused_refused_on_assign(app, client):
    bid = make_booking(app, status="under_review",
                       amount_locked=True, amount_xof=25000)
    r = client.put(f"/api/admin/bookings/{bid}/assign",
                   json={"provider_name": "Presta Pause", "provider_phone": PAUSED_PHONE},
                   headers=_admin_headers())
    assert r.status_code == 400, r.get_data(as_text=True)
    assert "en pause" in r.get_json()["error"]
    b = get_booking(app, bid)
    assert b.status == "under_review" and b.provider_phone is None
    assert len(all_events(app, bid)) == 0


def test_paused_refused_on_accept(app, client):
    bid = make_booking(app, status="assigned",
                       provider_name="Presta Pause", provider_phone=PAUSED_PHONE)
    r = client.patch(f"/api/provider/bookings/{bid}/accept",
                     headers=_provider_headers(app.config["_SP_PAUSED"]))
    assert r.status_code == 403, r.get_data(as_text=True)
    assert "en pause" in r.get_json()["error"]
    assert get_booking(app, bid).status == "assigned"
    assert len(all_events(app, bid)) == 0


def test_paused_refused_on_start(app, client):
    bid = make_booking(app, status="accepted",
                       provider_name="Presta Pause", provider_phone=PAUSED_PHONE)
    r = client.patch(f"/api/provider/bookings/{bid}/start",
                     headers=_provider_headers(app.config["_SP_PAUSED"]))
    assert r.status_code == 403, r.get_data(as_text=True)
    assert get_booking(app, bid).status == "accepted"
    assert len(all_events(app, bid)) == 0


# ── 4. Positive control: active provider, own mission → accept then start ────

def test_active_provider_accepts_and_starts_own_mission(app, client):
    bid = make_booking(app, status="assigned",
                       provider_name="Presta Actif", provider_phone=ACTIVE_PHONE,
                       amount_locked=True, amount_xof=25000)
    hdr = _provider_headers(app.config["_SP_ACTIVE"])

    r1 = client.patch(f"/api/provider/bookings/{bid}/accept", headers=hdr)
    assert r1.status_code == 200, r1.get_data(as_text=True)
    assert get_booking(app, bid).status == "accepted"
    assert "provider_accepted" in [e.event_type for e in all_events(app, bid)]

    r2 = client.patch(f"/api/provider/bookings/{bid}/start", headers=hdr)
    assert r2.status_code == 200, r2.get_data(as_text=True)
    assert get_booking(app, bid).status == "in_progress"


# ── 5. Feed serves OWN missions only — no masked pool ────────────────────────

def test_bookings_feed_excludes_open_pool(app, client):
    make_booking(app, status="requested")            # open request → invisible
    own = make_booking(app, status="assigned",
                       provider_name="Presta Actif", provider_phone=ACTIVE_PHONE)
    r = client.get("/api/provider/bookings",
                   headers=_provider_headers(app.config["_SP_ACTIVE"]))
    assert r.status_code == 200
    items = r.get_json()
    assert [b["id"] for b in items] == [own]
    assert all(b["masked"] is False for b in items)
