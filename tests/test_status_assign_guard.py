"""
Guard test: PUT/PATCH /api/admin/bookings/<id>/status must REFUSE the
'assigned' transition (assignment goes through /assign, which validates the
phone + provider approval and writes the provider_assigned event).

The important assertion is the THIRD one: no BookingEvent is created. That
proves the guard runs BEFORE any write (status mutation or event insert), not
merely that a 400 is returned.

Runs entirely offline against a throwaway SQLite DB via the Flask test client.

Usage:
    pytest tests/test_status_assign_guard.py -v
"""

from datetime import datetime, timedelta

import jwt as pyjwt
import pytest

# Compat shim (same as test_amount_lock): some Werkzeug builds drop __version__,
# which Flask's test client reads.
import werkzeug as _werkzeug
if not hasattr(_werkzeug, "__version__"):
    try:
        from importlib.metadata import version as _pkg_version
        _werkzeug.__version__ = _pkg_version("werkzeug")
    except Exception:
        _werkzeug.__version__ = "0"

from flask import Flask

from shizuverse.models import db, ClientBooking, BookingEvent
from shizuverse.api.admin import admin_bp as api_admin_bp

SECRET = "test-secret-key"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(application)
    application.register_blueprint(api_admin_bp, url_prefix="/api/admin")

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
    token = pyjwt.encode(
        {"sub": "admin", "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def make_booking(app, **overrides):
    with app.app_context():
        b = ClientBooking(
            client_name="Test Client",
            client_phone="0700000001",
            client_location="Cocody, Abidjan",
            service_name="Menage",
            appointment_date=datetime.utcnow() + timedelta(days=3),
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


# ---------------------------------------------------------------------------
# The guard: 'assigned' via /status is refused with no side effects
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("method", ["put", "patch"])
def test_status_assigned_refused_without_side_effects(app, client, admin_headers, method):
    bid = make_booking(app, status="under_review")
    assert len(all_events(app, bid)) == 0  # baseline: nothing yet

    resp = getattr(client, method)(
        f"/api/admin/bookings/{bid}/status",
        json={"status": "assigned"},
        headers=admin_headers,
    )

    # 1. Rejected with 400, and the message orients to the /assign endpoint.
    assert resp.status_code == 400, resp.get_data(as_text=True)
    assert "/assign" in resp.get_json()["error"]

    # 2. No mutation: the booking status is unchanged.
    assert get_booking(app, bid).status == "under_review"

    # 3. MOST IMPORTANT — no BookingEvent was written. The guard must sit before
    #    any write, so a rejected 'assigned' leaves the history completely empty.
    assert len(all_events(app, bid)) == 0


# ---------------------------------------------------------------------------
# Positive control: a legitimate transition still works (guard isn't too broad)
# ---------------------------------------------------------------------------

def test_status_confirmed_still_allowed(app, client, admin_headers):
    bid = make_booking(app, status="under_review")

    resp = client.put(
        f"/api/admin/bookings/{bid}/status",
        json={"status": "confirmed"},
        headers=admin_headers,
    )

    assert resp.status_code == 200, resp.get_data(as_text=True)
    assert get_booking(app, bid).status == "confirmed"
    # The allowed transition IS traced (status actually changed).
    assert len(all_events(app, bid)) == 1
    assert all_events(app, bid)[0].event_type == "status_changed"
