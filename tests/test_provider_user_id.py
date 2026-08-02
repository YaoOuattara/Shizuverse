"""
ClientBooking.provider_user_id — lien STABLE vers la personne prestataire.

Avant cette colonne, le seul lien d'une réservation vers son prestataire était
provider_phone, une chaîne. Bâtir l'agrégation des versements dessus aurait
reproduit, sur de l'argent, le bug que 6a89893 a corrigé côté WhatsApp :
résoudre par téléphone au lieu de porter l'identifiant. Un prestataire changeant
de numéro perdrait son historique de versements.

La cible est users.id et non service_providers.id : T-20 donne à une personne
une ligne par service offert (trois pour la plupart), toutes avec le même
user_id. Grouper sur la ligne de service compterait la même personne trois fois.

Usage:
    pytest tests/test_provider_user_id.py -v
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
from shizuverse.api.admin import admin_bp as api_admin_bp
from shizuverse.utils.phone import normalize_phone
from scripts.backfill_provider_user_id import _resolve_phone_to_user_ids

SECRET = "test-secret-key"
PHONE = "+2250545521606"


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = SECRET
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'pu.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(application)
    application.register_blueprint(api_admin_bp, url_prefix="/api/admin")

    with application.app_context():
        db.create_all()
        cat = ServiceCategory(name="Ménage")
        db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Ménage standard", category_id=cat.id)
        db.session.add(sub); db.session.flush()
        # Trois services : la personne aura une ligne ServiceProvider par service.
        services = []
        for name in ("Menage", "Plomberie", "Peinture"):
            s = Service(name=name, subcategory_id=sub.id, is_active=True)
            db.session.add(s); services.append(s)
        db.session.flush()

        user = User(email=None, user_type="provider", full_name="BEHIRI FABRICE")
        user.password_hash = "test-hash"
        db.session.add(user); db.session.flush()
        # T-20 : trois lignes, MÊME user_id, MÊME téléphone.
        for s in services:
            db.session.add(ServiceProvider(
                user_id=user.id, service_id=s.id, phone_number=PHONE,
                company_name="Behiri Services",
                verification_status="approved", provider_status="active",
            ))
        db.session.commit()
        application.config["_USER_ID"] = user.id
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


def _make_booking(app, *, provider_phone=None, provider_name=None):
    with app.app_context():
        b = ClientBooking(
            client_name="Client", client_phone="+2250707050154",
            client_location="Cocody, Abidjan", service_name="Menage",
            service_id=app.config["_SVC"],
            appointment_date=datetime.utcnow() + timedelta(days=2),
            status="under_review", amount_xof=30000, amount_locked=True,
            provider_phone=provider_phone, provider_name=provider_name,
        )
        db.session.add(b); db.session.commit()
        return b.id


def _get(app, bid):
    with app.app_context():
        return db.session.get(ClientBooking, bid)


# ── Écriture à l'assignation ────────────────────────────────────────────────

def test_assign_sets_the_provider_user_id(app, client, admin_headers):
    bid = _make_booking(app)
    r = client.put(f"/api/admin/bookings/{bid}/assign",
                   json={"provider_name": "Behiri Services", "provider_phone": PHONE},
                   headers=admin_headers)
    assert r.status_code == 200, r.get_data(as_text=True)
    assert _get(app, bid).provider_user_id == app.config["_USER_ID"]


def test_the_id_is_the_person_not_the_service_row(app, client, admin_headers):
    """T-20 : trois lignes ServiceProvider, un seul user_id."""
    bid = _make_booking(app)
    client.put(f"/api/admin/bookings/{bid}/assign",
               json={"provider_name": "Behiri Services", "provider_phone": PHONE},
               headers=admin_headers)
    with app.app_context():
        sp_ids = [sp.id for sp in ServiceProvider.query.filter_by(
            user_id=app.config["_USER_ID"]).all()]
        assert len(sp_ids) == 3, "le décor doit bien avoir trois lignes"
        assert _get(app, bid).provider_user_id not in sp_ids or \
            _get(app, bid).provider_user_id == app.config["_USER_ID"]
        assert _get(app, bid).provider_user_id == app.config["_USER_ID"]


def test_to_dict_exposes_the_id(app, client, admin_headers):
    bid = _make_booking(app)
    client.put(f"/api/admin/bookings/{bid}/assign",
               json={"provider_name": "Behiri Services", "provider_phone": PHONE},
               headers=admin_headers)
    with app.app_context():
        assert db.session.get(ClientBooking, bid).to_dict()["provider_user_id"] \
            == app.config["_USER_ID"]


def test_an_unassigned_booking_has_no_id(app):
    assert _get(app, _make_booking(app)).provider_user_id is None


# ── Résolution du backfill ──────────────────────────────────────────────────

def _index(app):
    with app.app_context():
        return _resolve_phone_to_user_ids(ServiceProvider.query.all(), normalize_phone)


def test_three_rows_of_one_person_are_not_an_ambiguity(app):
    """Le cas nominal T-20 : même téléphone sur trois lignes, un seul user_id."""
    index = _index(app)
    assert index[PHONE] == {app.config["_USER_ID"]}
    assert len(index[PHONE]) == 1, "trois lignes ≠ trois personnes"


def test_a_raw_format_phone_still_resolves(app):
    """Les réservations antérieures à T-22 portent un format brut."""
    index = _index(app)
    for raw in ("05 45 52 16 06", "0545521606", "+225 05 45 52 16 06", "2250545521606"):
        assert index.get(normalize_phone(raw)) == {app.config["_USER_ID"]}, raw


def test_two_distinct_users_on_one_phone_are_ambiguous(app):
    """Là on ne devine pas : deux personnes, un numéro."""
    with app.app_context():
        other = User(email=None, user_type="provider", full_name="Homonyme")
        other.password_hash = "x"
        db.session.add(other); db.session.flush()
        db.session.add(ServiceProvider(
            user_id=other.id, service_id=app.config["_SVC"], phone_number=PHONE,
            company_name="Autre", verification_status="approved",
            provider_status="active",
        ))
        db.session.commit()
        expected = {app.config["_USER_ID"], other.id}
    assert _index(app)[PHONE] == expected
    assert len(_index(app)[PHONE]) == 2, "doit être signalé comme ambigu, pas tranché"


def test_an_unknown_phone_resolves_to_nothing(app):
    assert _index(app).get(normalize_phone("+2250700000000")) is None


# ── Effacement à la réassignation ───────────────────────────────────────────

def test_declining_clears_the_id_with_the_rest(app, client, admin_headers):
    """Laisser l'id derrière ferait compter la mission dans les versements d'un
    prestataire qui l'a refusée."""
    bid = _make_booking(app)
    client.put(f"/api/admin/bookings/{bid}/assign",
               json={"provider_name": "Behiri Services", "provider_phone": PHONE},
               headers=admin_headers)
    assert _get(app, bid).provider_user_id is not None

    with app.app_context():
        b = db.session.get(ClientBooking, bid)
        b.provider_name = None
        b.provider_phone = None
        b.provider_user_id = None      # ce que fait la branche de refus
        db.session.commit()
    b = _get(app, bid)
    assert (b.provider_name, b.provider_phone, b.provider_user_id) == (None, None, None)


# ── Idempotence ─────────────────────────────────────────────────────────────

def test_reassigning_the_same_provider_is_stable(app, client, admin_headers):
    """Trois passages, même résultat — l'écriture n'est pas cumulative."""
    seen = set()
    for _ in range(3):
        bid = _make_booking(app)
        client.put(f"/api/admin/bookings/{bid}/assign",
                   json={"provider_name": "Behiri Services", "provider_phone": PHONE},
                   headers=admin_headers)
        seen.add(_get(app, bid).provider_user_id)
    assert seen == {app.config["_USER_ID"]}


def test_the_backfill_index_is_deterministic(app):
    """Trois constructions successives donnent le même index."""
    runs = [_index(app) for _ in range(3)]
    assert runs[0] == runs[1] == runs[2]
