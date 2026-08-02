"""
Vue versements par PERSONNE — GET /admin/payouts/by-provider.

Ce que l'ancien onglet faisait de faux, et que ces tests verrouillent :
  - une ligne par RÉSERVATION, jamais par personne → ici on groupe sur
    provider_user_id. T-20 : une personne = plusieurs lignes ServiceProvider
    (une par service) ; grouper sur la ligne SP compterait Behiri trois fois ;
  - les dossiers sans destinataire disparaissaient du chiffre → ici les
    ORPHELINS sont comptés, avec leur propre total. Un « total à verser : X »
    pendant que 25 500 flottent sans destinataire mentirait par omission ;
  - les anomalies MoMo étaient invisibles → ici remontées, jamais masquées :
    montant dû sans numéro, numéro sans titulaire, titulaire ≠ prestataire.

Usage:
    pytest tests/test_payouts_by_provider.py -v
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

from shizuverse.models import db, User, ClientBooking
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.routes.admin import admin_bp as portal_bp

SECRET = "test-secret-key"
PHONE = "+2250545521606"


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'pbp.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(application)
    application.register_blueprint(portal_bp)

    with application.app_context():
        db.create_all()
        cat = ServiceCategory(name="Ménage")
        db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Ménage standard", category_id=cat.id)
        db.session.add(sub); db.session.flush()
        services = []
        for name in ("Menage", "Plomberie", "Peinture"):
            s = Service(name=name, subcategory_id=sub.id, is_active=True)
            db.session.add(s); services.append(s)
        db.session.flush()

        user = User(email=None, user_type="provider", full_name="BEHIRI FABRICE")
        user.password_hash = "x"
        db.session.add(user); db.session.flush()
        # T-20 : TROIS lignes SP, même personne, mêmes coordonnées MoMo
        # (synchronisées en prod par _sync_provider_rows).
        for s in services:
            db.session.add(ServiceProvider(
                user_id=user.id, service_id=s.id, phone_number=PHONE,
                company_name="Behiri Services",
                mobile_money_number="0545521606",
                mobile_money_name="Tiemoko Bakayoko",   # titulaire ≠ prestataire
                mobile_money_operator="mtn_momo",
                verification_status="approved", provider_status="active",
            ))
        db.session.commit()
        application.config["_UID"] = user.id
        application.config["_SVC"] = services[0].id
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


def _booking(app, *, amount=30000, collected=None, status='completed',
             payout_status='not_due', payment_status='open',
             provider_user_id='DEFAULT', provider_phone='DEFAULT',
             provider_name="Behiri Services"):
    with app.app_context():
        b = ClientBooking(
            client_name="Client", client_phone="+2250707050154",
            client_location="Cocody, Abidjan", service_name="Menage",
            service_id=app.config["_SVC"],
            appointment_date=datetime.utcnow() + timedelta(days=1),
            status=status, amount_xof=amount,
            amount_collected=amount if collected is None else collected,
            payment_status=payment_status, payout_status=payout_status,
            provider_user_id=app.config["_UID"] if provider_user_id == 'DEFAULT' else provider_user_id,
            provider_phone=PHONE if provider_phone == 'DEFAULT' else provider_phone,
            provider_name=provider_name,
        )
        db.session.add(b); db.session.commit()
        return b.id


def _view(client, headers):
    r = client.get("/admin/payouts/by-provider", headers=headers)
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()


# ── Groupage par personne, pas par ligne SP ─────────────────────────────────

def test_one_person_three_sp_rows_counts_once(app, client, admin_headers):
    """Behiri a 3 lignes ServiceProvider : la vue doit montrer UNE carte."""
    _booking(app)   # eligible, 25500
    _booking(app, payout_status='due')   # due, 25500
    v = _view(client, admin_headers)
    assert len(v["providers"]) == 1, "trois lignes SP ≠ trois personnes"
    p = v["providers"][0]
    assert p["user_id"] == app.config["_UID"]
    assert p["eligible"]["total"] == 25500
    assert p["due"]["total"] == 25500, "surtout pas 3 × 25500"


# ── Les trois blocs ─────────────────────────────────────────────────────────

def test_blocks_are_classified_correctly(app, client, admin_headers):
    _booking(app)                                        # eligible : soldé, not_due
    _booking(app, payout_status='due')                   # due
    _booking(app, collected=10000)                       # upcoming : pas soldé
    p = _view(client, admin_headers)["providers"][0]
    assert (p["eligible"]["count"], p["due"]["count"], p["upcoming"]["count"]) == (1, 1, 1)
    assert p["upcoming"]["total"] == 25500, "la part prestataire, même non soldée"


def test_refunded_files_are_out_entirely(app, client, admin_headers):
    """Un client remboursé = pas de versement (c744d55)."""
    _booking(app, payment_status='refunded')
    v = _view(client, admin_headers)
    assert v["providers"] == []
    assert v["totals"] == {"due": 0, "eligible": 0, "upcoming": 0, "orphans": 0}


def test_sent_is_done_but_not_silently_gone(app, client, admin_headers):
    _booking(app, payout_status='sent')
    p = _view(client, admin_headers)["providers"][0]
    assert p["due"]["count"] == 0 and p["eligible"]["count"] == 0
    assert p["sent_total"] == 25500, "un versement envoyé reste visible en cumul"


def test_failed_goes_back_to_due_and_is_counted(app, client, admin_headers):
    """Un versement échoué est à repayer, pas à oublier."""
    _booking(app, payout_status='failed')
    p = _view(client, admin_headers)["providers"][0]
    assert p["failed_count"] == 1
    assert p["due"]["count"] == 1, "échoué = à re-verser, il rejoint le bloc dû"


# ── Orphelins : comptés, jamais masqués ─────────────────────────────────────

def test_orphan_without_any_provider(app, client, admin_headers):
    """Le dossier 75 : completed, soldé, aucun lien prestataire."""
    _booking(app, provider_user_id=None, provider_phone=None, provider_name=None)
    v = _view(client, admin_headers)
    assert v["orphans"]["count"] == 1
    assert v["orphans"]["total"] == 25500
    assert v["orphans"]["items"][0]["cause"] == "no_provider"
    assert v["totals"]["orphans"] == 25500, "le total orphelin est visible en tête"


def test_orphan_with_unresolved_phone(app, client, admin_headers):
    """Un téléphone que le backfill n'a pas résolu : autre cause, autre action."""
    _booking(app, provider_user_id=None, provider_phone="+2250799999999",
             provider_name="Inconnu")
    o = _view(client, admin_headers)["orphans"]["items"][0]
    assert o["cause"] == "unresolved_provider"
    assert o["provider_phone"] == "+2250799999999"


def test_orphans_do_not_leak_into_provider_totals(app, client, admin_headers):
    _booking(app)                                                   # Behiri
    _booking(app, provider_user_id=None, provider_phone=None)       # orphelin
    v = _view(client, admin_headers)
    assert v["totals"]["eligible"] == 25500
    assert v["totals"]["orphans"] == 25500
    assert v["providers"][0]["eligible"]["count"] == 1


# ── Coordonnées et anomalies ────────────────────────────────────────────────

def test_momo_coordinates_are_exposed(app, client, admin_headers):
    _booking(app)
    p = _view(client, admin_headers)["providers"][0]
    assert p["mobile_money_number"] == "0545521606"
    assert p["mobile_money_name"] == "Tiemoko Bakayoko"
    assert p["mobile_money_operator"] == "mtn_momo"


def test_a_different_momo_holder_is_flagged(app, client, admin_headers):
    """Behiri Fabrice → compte au nom de Tiemoko Bakayoko : l'argent part vers
    un tiers, Marie-Paule doit le voir."""
    _booking(app)
    p = _view(client, admin_headers)["providers"][0]
    assert "momo_holder_differs" in p["anomalies"]


def test_a_missing_momo_number_is_flagged(app, client, admin_headers):
    """Le cas Nour Ouattara : un montant dû sans aucun moyen de le payer."""
    with app.app_context():
        for sp in ServiceProvider.query.all():
            sp.mobile_money_number = None
            sp.mobile_money_name = None
        db.session.commit()
    _booking(app, payout_status='due')
    p = _view(client, admin_headers)["providers"][0]
    assert "missing_momo_number" in p["anomalies"]
    assert p["mobile_money_number"] is None
    assert p["due"]["total"] == 25500, "le montant reste visible, l'anomalie aussi"


def test_a_missing_momo_holder_is_flagged(app, client, admin_headers):
    """Le cas Ouedraogo : un numéro dont on ignore le titulaire."""
    with app.app_context():
        for sp in ServiceProvider.query.all():
            sp.mobile_money_name = None
        db.session.commit()
    _booking(app)
    assert "missing_momo_name" in _view(client, admin_headers)["providers"][0]["anomalies"]


# ── Cohérence avec les agrégats des tuiles ──────────────────────────────────

def test_due_total_matches_the_overview_aggregate(app, client, admin_headers):
    """Même expression SQL (finance_expressions) : les deux vues ne peuvent pas
    diverger — c'est le contraire du doublon overview/finance_summary."""
    _booking(app, payout_status='due')
    _booking(app, payout_status='due', payment_status='refunded')   # exclu partout
    view_total = _view(client, admin_headers)["totals"]["due"]
    r = client.get("/admin/overview", headers=admin_headers)
    assert view_total == r.get_json()["payouts_due"] == 25500
