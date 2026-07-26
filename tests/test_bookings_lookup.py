"""
Public booking lookup — phone format tolerance (T-22).

Bookings are stored E.164 (+225…). The client types the LOCAL form, with
spaces, or an international prefix: every format must match. Before this fix
the exact-match lookup silently returned "no bookings" for the natural local
input — a lying "Suivre ma demande" button.

Usage:
    pytest tests/test_bookings_lookup.py -v
"""

from datetime import datetime, timedelta

import pytest

import werkzeug as _werkzeug
if not hasattr(_werkzeug, "__version__"):
    try:
        from importlib.metadata import version as _pkg_version
        _werkzeug.__version__ = _pkg_version("werkzeug")
    except Exception:
        _werkzeug.__version__ = "0"

from flask import Flask

from shizuverse.models import db, ClientBooking
from shizuverse.api.bookings import bookings_bp
from shizuverse.limiter import limiter

STORED_PHONE = "+2250707050154"   # E.164, comme écrit par create_booking


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = "t"
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'test.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    application.config["RATELIMIT_ENABLED"] = False

    db.init_app(application)
    limiter.init_app(application)
    application.register_blueprint(bookings_bp, url_prefix="/api/bookings")

    with application.app_context():
        db.create_all()
        b = ClientBooking(
            client_name="Awa Test",
            client_phone=STORED_PHONE,
            client_location="Cocody, Abidjan",
            service_name="Ménage",
            appointment_date=datetime.utcnow() + timedelta(days=2),
            status="confirmed",
        )
        db.session.add(b)
        db.session.commit()
        application.config["_REF"] = f"SHZ-{datetime.utcnow().year}-{b.id}"
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.mark.parametrize("typed", [
    "0707050154",              # forme locale — la saisie naturelle
    "+2250707050154",          # E.164 exact
    "+225 07 07 05 01 54",     # avec espaces
    "00225 0707050154",        # préfixe international 00
    "2250707050154",           # sans le +
])
def test_lookup_matches_every_phone_format(app, client, typed):
    r = client.get(f"/api/bookings/?phone={typed}&ref={app.config['_REF']}")
    assert r.status_code == 200
    data = r.get_json()
    assert data["count"] == 1, f"{typed!r} n'a pas matché"
    assert data["items"][0]["client_phone"] == STORED_PHONE


def test_lookup_wrong_phone_stays_empty(app, client):
    r = client.get(f"/api/bookings/?phone=0708000000&ref={app.config['_REF']}")
    assert r.status_code == 200
    assert r.get_json()["count"] == 0
