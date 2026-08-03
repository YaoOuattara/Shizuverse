"""
GET /admin/messages — l'onglet et le badge partagent LA MÊME définition.

Le filtre unread=1 ne portait que sur is_read, sans direction, alors que
unread_count filtrait direction='inbound' : deux définitions de « non lu »,
nées à cinq lignes d'écart. Une ligne sortante naît is_read=False et personne
ne la « lit » jamais — la liste de l'onglet grossissait d'un item à chaque
notification envoyée pendant que le badge restait au compte des entrants. La
fourche VALID_STATUSES en miniature : deux définitions du même concept qui
coïncident un temps, puis divergent en silence.

Usage:
    pytest tests/test_messages_endpoint.py -v
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

import jwt as pyjwt
from flask import Flask

from shizuverse.models import db
from shizuverse.models.whatsapp_message import WhatsAppMessage
from shizuverse.routes.admin import admin_bp as portal_bp

SECRET = "test-secret-key"


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'msg.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(application)
    application.register_blueprint(portal_bp)
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
    token = pyjwt.encode({"sub": "admin", "exp": datetime.utcnow() + timedelta(days=1)},
                         SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def _msg(app, *, sid, direction, is_read=False, booking_id=None):
    with app.app_context():
        db.session.add(WhatsAppMessage(
            message_sid=sid, direction=direction, is_read=is_read,
            from_phone="+2250707050154", to_phone="+2250544332211",
            body="test" if direction == "inbound" else None,
            booking_id=booking_id,
            received_at=datetime.utcnow(),
        ))
        db.session.commit()


def test_an_unread_outbound_does_not_appear_in_the_unread_tab(app, client, admin_headers):
    """Le cas commandé : un sortant naît is_read=False — il n'est pas « à lire »."""
    _msg(app, sid="SM_IN", direction="inbound")            # à lire
    _msg(app, sid="SM_OUT", direction="outbound")          # envoyé, is_read=False
    _msg(app, sid="SM_IN_READ", direction="inbound", is_read=True)

    r = client.get("/admin/messages?unread=1", headers=admin_headers)
    assert r.status_code == 200, r.get_data(as_text=True)
    data = r.get_json()
    assert [m["message_sid"] for m in data["items"]] == ["SM_IN"]
    assert all(m["direction"] == "inbound" for m in data["items"])


def test_the_tab_and_the_badge_share_one_definition(app, client, admin_headers):
    """len(items) == unread_count, quelle que soit la population — c'est
    l'invariant, pas une coïncidence de filtrage client."""
    _msg(app, sid="SM_1", direction="inbound")
    _msg(app, sid="SM_2", direction="inbound")
    for i in range(5):                                     # 5 notifications parties
        _msg(app, sid=f"SM_OUT_{i}", direction="outbound")

    data = client.get("/admin/messages?unread=1", headers=admin_headers).get_json()
    assert data["unread_count"] == 2
    assert len(data["items"]) == data["unread_count"], \
        "la liste ne doit jamais dépasser son propre badge"


def test_the_unmatched_tab_shares_the_badge_definition_too(app, client, admin_headers):
    """Même règle que « Non lus » : un sortant sans booking_id (?b= absent, non
    résolu) est une dette de traçage, pas un entrant à rattacher."""
    _msg(app, sid="SM_ORPH_IN", direction="inbound")                 # orphelin à rattacher
    _msg(app, sid="SM_ORPH_OUT", direction="outbound")               # sortant non résolu
    _msg(app, sid="SM_LINKED", direction="inbound", booking_id=None)

    data = client.get("/admin/messages?unmatched=1", headers=admin_headers).get_json()
    assert all(m["direction"] == "inbound" for m in data["items"])
    assert len(data["items"]) == data["unmatched_count"], \
        "liste et badge : une seule définition"
