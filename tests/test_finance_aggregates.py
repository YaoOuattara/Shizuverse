"""
Agrégats financiers — un dossier remboursé ne doit plus gonfler les totaux.

Constaté en production : « Total encaissé 68 500 FCFA » alors que trois dossiers
étaient remboursés, avec « Revenus Shizu » et « Versements dus » exactement à
15 % et 85 % de ce même 68 500 — une seule erreur affichée trois fois, sur DEUX
pages (Paiements et Aperçu).

Cause : le prédicat ne regardait que amount_collected (l'axe argent) et jamais
payment_status (l'axe dossier). Or un remboursement laisse amount_collected
intact — délibérément, T-29 : le client a bel et bien payé, l'effacer rendrait un
remboursement partiel inreprésentable. L'argent est entré (un fait) puis sorti
(un autre fait, un autre axe). Les agrégats doivent donc exclure le dossier
explicitement.

Second défaut couvert ici : « Versements dus » filtrait payout_status != 'sent',
ce qui laissait passer 'not_due' — des versements explicitement NON dus étaient
comptés comme dus.

Usage:
    pytest tests/test_finance_aggregates.py -v
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

from shizuverse.models import db, ClientBooking
from shizuverse.models.booking_event import BookingEvent
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.routes.admin import admin_bp as portal_bp

SECRET = "test-secret-key"


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'fin.db'}"
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


def _booking(app, *, amount, collected, payment_status='open',
             payout_status='not_due', status='completed'):
    with app.app_context():
        b = ClientBooking(
            client_name="Client", client_phone="0700000001",
            client_location="Cocody, Abidjan", service_name="Menage",
            service_id=app.config["_SVC"],
            appointment_date=datetime.utcnow() + timedelta(days=1),
            status=status, amount_xof=amount, amount_collected=collected,
            payment_status=payment_status, payout_status=payout_status,
        )
        db.session.add(b); db.session.commit()
        return b.id


def _overview(client, headers):
    r = client.get("/admin/overview", headers=headers)
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()


def _summary(client, headers):
    r = client.get("/admin/finance/summary", headers=headers)
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()


# ── Exclusion des remboursés ────────────────────────────────────────────────

def test_a_refunded_booking_no_longer_inflates_the_totals(app, client, admin_headers):
    """Le scénario de production, réduit à deux lignes."""
    _booking(app, amount=30000, collected=30000)                              # compte
    _booking(app, amount=20000, collected=20000, payment_status='refunded')   # ne compte pas

    o = _overview(client, admin_headers)
    assert o["gmv_total"] == 30000, "le dossier remboursé est encore compté"
    assert o["revenue_shizu"] == 4500, "15% de 30000, pas de 50000"


def test_the_refund_does_not_erase_the_collected_amount(app, client, admin_headers):
    """T-29 : l'argent est bien entré, c'est un fait immuable. Seuls les
    agrégats de revenu excluent le dossier — pas l'historique d'encaissement."""
    bid = _booking(app, amount=20000, collected=20000, payment_status='refunded')
    with app.app_context():
        b = db.session.get(ClientBooking, bid)
        assert b.amount_collected == 20000, "amount_collected doit rester intact"
        assert b.collection_status == 'paid', "l'axe argent dit toujours payé"
        assert b.payment_status == 'refunded', "l'axe dossier dit remboursé"

    # Le cash réellement entré, lui, compte toujours le remboursé : c'est une
    # autre métrique (total_paid_xof), pas le GMV.
    assert _summary(client, admin_headers)["total_paid_xof"] == 20000


def test_gmv_month_excludes_refunds_too(app, client, admin_headers):
    """Sinon le bug se reproduit à l'échelle mensuelle."""
    _booking(app, amount=30000, collected=30000)
    _booking(app, amount=20000, collected=20000, payment_status='refunded')
    o = _overview(client, admin_headers)
    assert o["gmv_month"] == 30000


# ── Versements dus ──────────────────────────────────────────────────────────

def test_not_due_is_no_longer_counted_as_due(app, client, admin_headers):
    """'not_due' passait le filtre `!= sent` : des versements explicitement NON
    dus étaient affichés comme dus."""
    _booking(app, amount=30000, collected=30000, payout_status='not_due')
    assert _overview(client, admin_headers)["payouts_due"] == 0


def test_payouts_due_is_the_provider_share_not_the_gross(app, client, admin_headers):
    _booking(app, amount=30000, collected=30000, payout_status='due')
    o = _overview(client, admin_headers)
    assert o["payouts_due"] == 25500, "85% de 30000, pas le brut"


def test_payouts_due_excludes_refunded(app, client, admin_headers):
    """Verser au prestataire ET rembourser le client, c'est payer deux fois."""
    _booking(app, amount=30000, collected=30000, payout_status='due',
             payment_status='refunded')
    assert _overview(client, admin_headers)["payouts_due"] == 0


def test_both_endpoints_agree_on_payouts_due(app, client, admin_headers):
    """Le doublon d'origine : deux définitions du même chiffre, 15% d'écart."""
    _booking(app, amount=30000, collected=30000, payout_status='due')
    _booking(app, amount=20000, collected=20000, payout_status='due',
             payment_status='refunded')
    _booking(app, amount=10000, collected=10000, payout_status='not_due')

    assert _overview(client, admin_headers)["payouts_due"] == \
        _summary(client, admin_headers)["payouts_due_value_xof"] == 25500


def test_payouts_sent_uses_the_same_population(app, client, admin_headers):
    _booking(app, amount=30000, collected=30000, payout_status='sent')
    _booking(app, amount=20000, collected=20000, payout_status='sent',
             payment_status='refunded')
    assert _overview(client, admin_headers)["payouts_sent"] == 25500


# ── Garde 409 sur update_finance ────────────────────────────────────────────

def _finance(client, headers, bid, **body):
    return client.post(f"/admin/bookings/{bid}/finance", json=body, headers=headers)


def test_refunding_twice_is_refused(app, client, admin_headers):
    bid = _booking(app, amount=30000, collected=30000)
    assert _finance(client, admin_headers, bid, payment_status='refunded').status_code == 200
    r = _finance(client, admin_headers, bid, payment_status='refunded')
    assert r.status_code == 409, r.get_data(as_text=True)
    assert r.get_json()["payment_status"] == 'refunded'


def test_a_refund_cannot_be_walked_back(app, client, admin_headers):
    """'refunded' est terminal — repasser à 'open' effaçait le fait sans trace."""
    bid = _booking(app, amount=30000, collected=30000)
    _finance(client, admin_headers, bid, payment_status='refunded')
    assert _finance(client, admin_headers, bid, payment_status='open').status_code == 409
    with app.app_context():
        assert db.session.get(ClientBooking, bid).payment_status == 'refunded'


def test_payout_status_stays_editable_on_a_refunded_file(app, client, admin_headers):
    """La garde porte sur l'axe dossier seul : un versement peut encore être
    marqué échoué ou annulé après un remboursement."""
    bid = _booking(app, amount=30000, collected=30000)
    _finance(client, admin_headers, bid, payment_status='refunded')
    r = _finance(client, admin_headers, bid, payout_status='failed')
    assert r.status_code == 200, r.get_data(as_text=True)
    with app.app_context():
        assert db.session.get(ClientBooking, bid).payout_status == 'failed'


# ── Traçabilité des changements finance ─────────────────────────────────────

def _events(app, bid, kind):
    with app.app_context():
        return BookingEvent.query.filter_by(booking_id=bid, event_type=kind).all()


def test_a_payment_status_change_leaves_a_trace_with_the_amount(app, client, admin_headers):
    """Ces changements ne laissaient AUCUNE trace — même angle mort que 4d06e64."""
    bid = _booking(app, amount=30000, collected=30000)
    _finance(client, admin_headers, bid, payment_status='refunded')
    evs = _events(app, bid, 'finance_updated')
    assert len(evs) == 1
    assert "30000 XOF" in evs[0].note, evs[0].note
    assert "open → refunded" in evs[0].note


def test_a_payout_status_change_leaves_a_trace(app, client, admin_headers):
    bid = _booking(app, amount=30000, collected=30000)
    _finance(client, admin_headers, bid, payout_status='due')
    evs = _events(app, bid, 'finance_updated')
    assert len(evs) == 1
    assert "versement not_due → due" in evs[0].note
    assert "30000 XOF" in evs[0].note


def test_a_no_op_write_records_nothing(app, client, admin_headers):
    """Réécrire la même valeur n'est pas un changement — pas de faux événement."""
    bid = _booking(app, amount=30000, collected=30000, payout_status='due')
    assert _finance(client, admin_headers, bid, payout_status='due').status_code == 200
    assert _events(app, bid, 'finance_updated') == []


def test_the_reason_is_carried_into_the_trace(app, client, admin_headers):
    bid = _booking(app, amount=30000, collected=30000)
    _finance(client, admin_headers, bid, payment_status='refunded',
             reason='geste commercial')
    assert "geste commercial" in _events(app, bid, 'finance_updated')[0].note


# ── L'invariant complet : un dossier remboursé ne doit rien au prestataire ───

def test_refund_client_cancels_the_payout_and_clears_the_aggregate(app, client,
                                                                   admin_headers):
    """L'invariant entier, pas ses deux moitiés.

    shizu_dispute_no_payment_provider_fr annonce au prestataire une clôture SANS
    règlement. Il faut donc que (1) la ligne le dise — payout_status='not_due' —
    et (2) l'agrégat ne compte plus ce dossier. Bloquer seulement les chemins
    d'affichage laisserait la base contredire un message déjà envoyé.
    """
    bid = _booking(app, amount=30000, collected=30000, payout_status='due')
    # Avant : le versement est dû et compté.
    assert _overview(client, admin_headers)["payouts_due"] == 25500

    assert client.post(f"/admin/bookings/{bid}/dispute",
                       json={"reason": "prestation non conforme"},
                       headers=admin_headers).status_code == 200
    assert client.post(f"/admin/bookings/{bid}/resolve-dispute",
                       json={"resolution": "refund_client"},
                       headers=admin_headers).status_code == 200

    with app.app_context():
        b = db.session.get(ClientBooking, bid)
        assert b.payment_status == 'refunded'
        assert b.payout_status == 'not_due', \
            "le versement en attente doit être annulé — c'est ce que le message promet"
        assert b.amount_collected == 30000, "T-29 : l'encaissement reste un fait"

    assert _overview(client, admin_headers)["payouts_due"] == 0
    assert _summary(client, admin_headers)["payouts_due_value_xof"] == 0


def test_a_payout_cannot_be_made_due_on_a_refunded_file(app, client, admin_headers):
    """La garde collection_status ne peut PAS l'attraper : amount_collected étant
    intact, collection_status vaut toujours 'paid' et le contrôle passe."""
    bid = _booking(app, amount=30000, collected=30000)
    _finance(client, admin_headers, bid, payment_status='refunded')

    r = _finance(client, admin_headers, bid, payout_status='due')
    assert r.status_code == 409, r.get_data(as_text=True)
    with app.app_context():
        b = db.session.get(ClientBooking, bid)
        assert b.payout_status != 'due'
        assert b.collection_status == 'paid', "l'axe argent dit toujours payé"
