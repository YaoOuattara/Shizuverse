"""
Litiges — gardes contre le rejeu (LOT A).

Pourquoi ces gardes existent : dispute_flag n'est JAMAIS remis à False dans tout
le projet. La garde d'entrée de resolve-dispute étant `if not b.dispute_flag`,
elle reste donc satisfaite après une résolution — l'endpoint pouvait être
rappelé indéfiniment, écrasant la résolution et réappliquant ses effets
financiers. Un remboursement pouvait devenir un paiement au prestataire, les
deux consignés comme des faits.

C'est un prérequis au câblage des notifications : sans ces gardes, un client
recevrait « remboursement » puis « paiement libéré au prestataire » sur le même
dossier. Aucune notification n'est envoyée dans ce lot.

L'interface admin masque bien les boutons une fois le litige résolu, mais c'est
de l'affichage : un retry ou un double-clic sur connexion lente passait quand
même. Les tests attaquent donc l'API directement.

Usage:
    pytest tests/test_dispute_guards.py -v
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

from shizuverse.models import db, ClientBooking
from shizuverse.models.booking_event import BookingEvent
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.routes.admin import admin_bp as portal_bp

SECRET = "test-secret-key"
QUOTE = 40000


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'dispute.db'}"
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
    token = pyjwt.encode(
        {"sub": "admin", "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET, algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def _make_booking(app, **overrides):
    with app.app_context():
        b = ClientBooking(
            client_name="Test Client", client_phone="0700000001",
            client_location="Cocody, Abidjan", service_name="Menage",
            service_id=app.config["_SVC"],
            appointment_date=datetime.utcnow() + timedelta(days=3),
            status="requested", amount_xof=QUOTE,
            # Le décor nominal : le client a payé. Les gardes « pas de
            # remboursement sans encaissement » ont leurs propres tests avec
            # collected=0 explicite.
            amount_collected=QUOTE,
        )
        for k, v in overrides.items():
            setattr(b, k, v)
        db.session.add(b); db.session.commit()
        return b.id


def _booking(app, bid):
    with app.app_context():
        return db.session.get(ClientBooking, bid)


def _events(app, bid, event_type):
    with app.app_context():
        return BookingEvent.query.filter_by(booking_id=bid, event_type=event_type).all()


def _open(client, headers, bid, reason="prestation contestée"):
    return client.post(f"/admin/bookings/{bid}/dispute",
                       json={"reason": reason}, headers=headers)


def _resolve(client, headers, bid, resolution):
    return client.post(f"/admin/bookings/{bid}/resolve-dispute",
                       json={"resolution": resolution}, headers=headers)


# ── A2 — ouverture ───────────────────────────────────────────────────────────

def test_open_dispute_first_time_succeeds(app, client, admin_headers):
    bid = _make_booking(app)
    r = _open(client, admin_headers, bid)
    assert r.status_code == 200, r.get_data(as_text=True)
    b = _booking(app, bid)
    assert b.dispute_flag is True
    assert b.dispute_reason == "prestation contestée"
    assert len(_events(app, bid, "dispute_opened")) == 1


def test_reopening_an_open_dispute_is_refused(app, client, admin_headers):
    bid = _make_booking(app)
    _open(client, admin_headers, bid, reason="motif initial")
    r = _open(client, admin_headers, bid, reason="motif écrasant")
    assert r.status_code == 409, r.get_data(as_text=True)

    b = _booking(app, bid)
    assert b.dispute_reason == "motif initial", "le motif d'origine ne doit pas être écrasé"
    assert len(_events(app, bid, "dispute_opened")) == 1, "pas de second événement"


def test_reopening_a_RESOLVED_dispute_is_refused(app, client, admin_headers):
    """L'état incohérent visé : rouvert ET résolu en même temps."""
    bid = _make_booking(app)
    _open(client, admin_headers, bid, reason="motif initial")
    _resolve(client, admin_headers, bid, "refund_client")

    r = _open(client, admin_headers, bid, reason="nouveau litige")
    assert r.status_code == 409
    b = _booking(app, bid)
    assert b.dispute_reason == "motif initial"
    assert b.dispute_resolved_at is not None, "la résolution reste en place"


def test_open_dispute_409_reports_the_current_state(app, client, admin_headers):
    bid = _make_booking(app)
    _open(client, admin_headers, bid, reason="motif initial")
    body = _open(client, admin_headers, bid).get_json()
    assert "déjà ouvert" in body["error"]
    assert body["dispute_reason"] == "motif initial"
    assert body["dispute_opened_at"] is not None


# ── A1 — résolution ──────────────────────────────────────────────────────────

def test_resolve_requires_an_open_dispute(app, client, admin_headers):
    bid = _make_booking(app)
    r = _resolve(client, admin_headers, bid, "refund_client")
    assert r.status_code == 400


def test_resolve_first_time_succeeds_and_applies_its_effect(app, client, admin_headers):
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    r = _resolve(client, admin_headers, bid, "refund_client")
    assert r.status_code == 200, r.get_data(as_text=True)
    b = _booking(app, bid)
    assert b.dispute_resolution == "refund_client"
    assert b.dispute_resolved_at is not None
    assert b.payment_status == "refunded"


def test_resolving_twice_is_refused(app, client, admin_headers):
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    assert _resolve(client, admin_headers, bid, "refund_client").status_code == 200
    r = _resolve(client, admin_headers, bid, "refund_client")
    assert r.status_code == 409, r.get_data(as_text=True)
    assert len(_events(app, bid, "dispute_resolved")) == 1


def test_a_refund_cannot_be_turned_into_a_payout(app, client, admin_headers):
    """Le scénario qui interdisait de câbler les notifications."""
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    _resolve(client, admin_headers, bid, "refund_client")

    r = _resolve(client, admin_headers, bid, "release_provider")
    assert r.status_code == 409
    b = _booking(app, bid)
    assert b.dispute_resolution == "refund_client", "la première résolution fait foi"
    assert b.payment_status == "refunded"
    assert b.payout_status != "due", "l'effet financier contraire ne doit pas s'appliquer"
    assert len(_events(app, bid, "dispute_resolved")) == 1


def test_resolve_409_reports_the_resolution_in_place(app, client, admin_headers):
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    _resolve(client, admin_headers, bid, "release_provider")
    body = _resolve(client, admin_headers, bid, "split").get_json()
    assert "déjà été résolu" in body["error"]
    assert body["dispute_resolution"] == "release_provider"
    assert body["dispute_resolved_at"] is not None


def test_an_invalid_resolution_is_still_rejected(app, client, admin_headers):
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    r = _resolve(client, admin_headers, bid, "n_importe_quoi")
    assert r.status_code == 400
    assert _booking(app, bid).dispute_resolution is None


# ── A3/A4 — la note consigne le montant, en français ─────────────────────────

@pytest.mark.parametrize("resolution", ["refund_client", "release_provider"])
def test_resolution_event_records_the_amount(app, client, admin_headers, resolution):
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    _resolve(client, admin_headers, bid, resolution)

    note = _events(app, bid, "dispute_resolved")[0].note
    amount = re.search(r"(\d+)\s*XOF", note)
    assert amount is not None, f"aucun montant consigné : {note!r}"
    assert int(amount.group(1)) == QUOTE
    assert resolution in note, "la valeur machine doit rester lisible"


def test_resolution_note_is_in_french(app, client, admin_headers):
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    _resolve(client, admin_headers, bid, "refund_client")
    note = _events(app, bid, "dispute_resolved")[0].note
    assert note.startswith("Litige résolu"), note
    assert "remboursement client" in note
    assert "Resolution:" not in note, "l'ancienne note anglaise ne doit plus apparaître"


def test_amount_recorded_is_the_effective_one(app, client, admin_headers):
    """amount_due_total = coalesce(final_amount, amount_xof) — un dépassement
    justifié est ce qui est réellement en jeu dans le litige."""
    bid = _make_booking(app, final_amount=52000)
    _open(client, admin_headers, bid)
    _resolve(client, admin_headers, bid, "release_provider")
    note = _events(app, bid, "dispute_resolved")[0].note
    assert "52000 XOF" in note, note


def test_split_is_no_longer_an_accepted_resolution(app, client, admin_headers):
    """Retiré : accepté et enregistré, il ne produisait AUCUN effet financier.
    Le bouton correspondant est retiré de l'interface admin dans le même lot."""
    bid = _make_booking(app)
    _open(client, admin_headers, bid)
    r = _resolve(client, admin_headers, bid, "split")
    assert r.status_code == 400, r.get_data(as_text=True)
    assert _booking(app, bid).dispute_resolution is None
    assert _events(app, bid, "dispute_resolved") == []


# ── Cohérence argent / litige (lot gardes finance) ──────────────────────────

def _finance(client, headers, bid, **body):
    return client.post(f"/admin/bookings/{bid}/finance", json=body, headers=headers)


def test_no_refund_on_a_never_collected_file(app, client, admin_headers):
    """Le dossier 76 en prod : « Non payé + Remboursé ». On ne rembourse pas
    un argent jamais reçu."""
    bid = _make_booking(app, amount_collected=0)
    r = _finance(client, admin_headers, bid, payment_status='refunded')
    assert r.status_code == 400, r.get_data(as_text=True)
    assert "rien à rembourser" in r.get_json()["error"]
    assert _booking(app, bid).payment_status != 'refunded'


def test_a_partial_collection_can_be_refunded(app, client, admin_headers):
    """Un acompte encaissé suffit — on ne compare jamais au montant du devis."""
    bid = _make_booking(app, amount_collected=10000)   # 10000 < QUOTE
    r = _finance(client, admin_headers, bid, payment_status='refunded')
    assert r.status_code == 200, r.get_data(as_text=True)
    assert _booking(app, bid).payment_status == 'refunded'


def test_refund_client_on_a_never_collected_file(app, client, admin_headers):
    """L'arbitrage reste valide, mais payment_status ne passe PAS à refunded :
    il n'y a rien à rembourser. Le versement est bien annulé."""
    bid = _make_booking(app, amount_collected=0, payout_status='due')
    _open(client, admin_headers, bid)
    r = _resolve(client, admin_headers, bid, "refund_client")
    assert r.status_code == 200, r.get_data(as_text=True)

    b = _booking(app, bid)
    assert b.dispute_resolution == "refund_client", "l'arbitrage est enregistré"
    assert b.payment_status != 'refunded', "rien encaissé → rien de remboursé"
    assert b.payout_status == 'not_due', "le prestataire n'est pas payé pour autant"
    note = _events(app, bid, "dispute_resolved")[0].note
    assert "rien encaissé" in note, note


def test_opening_a_dispute_suspends_a_due_payout(app, client, admin_headers):
    """shizu_dispute_opened_provider_fr promet « le règlement est suspendu » —
    la promesse a maintenant un mécanisme."""
    bid = _make_booking(app, payout_status='due')
    assert _open(client, admin_headers, bid).status_code == 200

    b = _booking(app, bid)
    assert b.payout_status == 'not_due'
    evs = _events(app, bid, "finance_updated")
    assert len(evs) == 1
    assert "Versement suspendu" in evs[0].note
    assert f"{QUOTE} XOF" in evs[0].note, "le montant suspendu est consigné (4d06e64)"


def test_opening_a_dispute_on_a_sent_payout_touches_nothing(app, client, admin_headers):
    """L'argent est déjà parti : un fait, jamais écrasé. Le litige s'ouvre
    quand même, et l'événement en garde la trace pour un futur bandeau."""
    bid = _make_booking(app, payout_status='sent')
    assert _open(client, admin_headers, bid).status_code == 200

    b = _booking(app, bid)
    assert b.payout_status == 'sent', "sent n'est jamais écrasé"
    assert b.dispute_flag is True, "le litige s'ouvre malgré tout"
    assert _events(app, bid, "finance_updated") == [], "aucun faux événement finance"
    note = _events(app, bid, "dispute_opened")[0].note
    assert "déjà envoyé" in note, note


def test_the_full_suspend_release_cycle(app, client, admin_headers):
    """due → litige (suspendu) → release_provider → due. Le cycle est complet
    et chaque étape laisse sa trace."""
    bid = _make_booking(app, payout_status='due')

    _open(client, admin_headers, bid)
    assert _booking(app, bid).payout_status == 'not_due', "suspendu à l'ouverture"

    assert _resolve(client, admin_headers, bid, "release_provider").status_code == 200
    b = _booking(app, bid)
    assert b.payout_status == 'due', "débloqué à la résolution en faveur du prestataire"
    assert b.dispute_resolution == "release_provider"
    assert len(_events(app, bid, "finance_updated")) == 1, "la suspension est tracée"
