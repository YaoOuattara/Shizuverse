"""
A request with no provider is flagged at 1h30 (warning) and 2h (critical).

The site promises « Confirmé sous 2h ». The detector used to wait 3h before
saying anything and 6h before calling it critical — the promise was broken
long before the admin heard about it.

Offline (throwaway SQLite), detect_anomalies only — no send.

Usage:
    pytest tests/test_anomaly_thresholds.py -v
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


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = "t"
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'th.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(application)
    with application.app_context():
        db.create_all()
    yield application
    with application.app_context():
        db.drop_all()


def _unassigned(app, minutes_ago):
    with app.app_context():
        db.session.add(ClientBooking(
            client_name="Client", client_phone="+2250707050154",
            client_location="Cocody, Abidjan", service_name="Demande libre",
            appointment_date=datetime.utcnow() + timedelta(days=1),
            status="requested",
            created_at=datetime.utcnow() - timedelta(minutes=minutes_ago),
        ))
        db.session.commit()


def _stuck(app):
    from shizuverse.utils.anomaly_detector import detect_anomalies
    with app.app_context():
        return [a for a in detect_anomalies() if a["type"] == "booking_stuck_unassigned"]


@pytest.mark.parametrize("minutes_ago, expected", [
    (80, None),          # 1h20 — still within the window, nothing yet
    (95, "warning"),     # 1h35 — past 1h30
    (125, "critical"),   # 2h05 — the promise is broken
    (240, "critical"),   # 4h — was only a warning with the old thresholds
])
def test_unassigned_request_severity(app, minutes_ago, expected):
    _unassigned(app, minutes_ago)
    found = _stuck(app)
    if expected is None:
        assert found == []
    else:
        assert [a["severity"] for a in found] == [expected]
