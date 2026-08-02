"""
VALID_STATUSES — la canonique dit enfin la vérité.

L'histoire (git log -L sur la ligne) : 0e059ef crée le vocabulaire ADMIN,
b7b1e6c — un commit d'infrastructure sans rapport — l'écrase par le vocabulaire
CLIENT au lieu de faire l'union. Depuis le 15 mars, deux vocabulaires
coexistaient, et la victime réelle était le filtre du lookup public :
?status=assigned ou ?status=under_review renvoyait 400 sur des statuts qui
existaient en base, avec un message d'erreur qui documentait la mauvaise liste.

Ces tests verrouillent : le filtre accepte les statuts du flux admin, les sept
anciens passent toujours, et LIVE_STATUSES est désormais DÉRIVÉ
(VALID − TERMINAL + le cavalier 'pending') au lieu d'être une liste manuelle —
avec la preuve que la dérivation reproduit exactement la liste historique.

Usage:
    pytest tests/test_status_vocabulary.py -v
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
from shizuverse.models.client_booking import VALID_STATUSES, TERMINAL_STATUSES
from shizuverse.api.bookings import bookings_bp
from shizuverse.limiter import limiter
from shizuverse.utils.phone_match import LIVE_STATUSES

PHONE = "+2250707050154"

# La liste manuelle telle qu'elle était AVANT la dérivation — la référence de
# non-régression exigée : contenu strictement identique, ordre indifférent.
HISTORICAL_LIVE = (
    'requested', 'pending', 'under_review', 'assigned',
    'accepted', 'confirmed', 'in_progress', 'pending_payment',
)


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = "t"
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'sv.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    application.config["RATELIMIT_ENABLED"] = False

    db.init_app(application)
    limiter.init_app(application)
    application.register_blueprint(bookings_bp, url_prefix="/api/bookings")

    with application.app_context():
        db.create_all()
        # Un dossier par statut réellement écrit par le code — y compris ceux
        # que l'ancienne liste refusait de filtrer.
        ids = {}
        for st in VALID_STATUSES:
            b = ClientBooking(
                client_name="Awa", client_phone=PHONE,
                client_location="Cocody, Abidjan", service_name="Ménage",
                appointment_date=datetime.utcnow() + timedelta(days=2),
                status=st,
            )
            db.session.add(b)
            db.session.flush()
            ids[st] = b.id
        db.session.commit()
        application.config["_REF"] = f"SHZ-{datetime.utcnow().year}-{ids['requested']}"
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _lookup(app, client, status):
    return client.get(f"/api/bookings/?phone={PHONE}&ref={app.config['_REF']}"
                      f"&status={status}")


# ── La victime réelle : le filtre public accepte le vocabulaire admin ────────

@pytest.mark.parametrize("status", ["under_review", "assigned", "confirmed"])
def test_admin_flow_statuses_are_filterable(app, client, status):
    """400 hier sur des lignes qui existaient en base ; 200 avec la ligne."""
    r = _lookup(app, client, status)
    assert r.status_code == 200, r.get_data(as_text=True)
    data = r.get_json()
    assert data["count"] == 1
    assert data["items"][0]["status"] == status


@pytest.mark.parametrize("status", ["requested", "accepted", "declined",
                                    "in_progress", "completed", "cancelled",
                                    "pending_payment"])
def test_the_seven_old_statuses_still_pass(app, client, status):
    r = _lookup(app, client, status)
    assert r.status_code == 200
    assert r.get_json()["count"] == 1


def test_an_unknown_status_is_still_refused(app, client):
    """Élargir la liste n'ouvre pas la porte à n'importe quoi."""
    r = _lookup(app, client, "n_importe_quoi")
    assert r.status_code == 400


def test_pending_is_not_in_the_canonical(app, client):
    """Aucun écrivain organique, zéro ligne en prod — son sort se tranche avec
    la matrice de transition (dette ecf84f0), pas ici."""
    assert "pending" not in VALID_STATUSES
    assert _lookup(app, client, "pending").status_code == 400


# ── LIVE dérivé == LIVE historique ───────────────────────────────────────────

def test_derived_live_equals_the_historical_manual_list():
    """La dérivation VALID − TERMINAL + cavalier 'pending' reproduit
    EXACTEMENT la liste manuelle qu'elle remplace. À noter : la dérivation
    seule ne suffisait pas — 'pending' étant hors canonique, il aurait disparu
    de LIVE en silence, et un message WhatsApp sur un tel dossier aurait cessé
    de se rattacher en priorité. D'où le cavalier explicite."""
    assert set(LIVE_STATUSES) == set(HISTORICAL_LIVE)
    assert len(LIVE_STATUSES) == len(set(LIVE_STATUSES)), "pas de doublon"


def test_terminal_and_live_partition_the_vocabulary():
    """Chaque statut canonique est vivant ou terminal, jamais les deux,
    jamais aucun."""
    assert set(TERMINAL_STATUSES) <= set(VALID_STATUSES)
    derived_live = set(VALID_STATUSES) - set(TERMINAL_STATUSES)
    assert derived_live | set(TERMINAL_STATUSES) == set(VALID_STATUSES)
    assert derived_live & set(TERMINAL_STATUSES) == set()


def test_the_canonical_is_the_union_of_what_the_code_writes():
    """Les 10 valeurs réellement posées par le code (investigation du 6 août),
    ni plus ni moins — le prochain écrivain devra s'ajouter ici ET là-bas."""
    assert set(VALID_STATUSES) == {
        'requested', 'under_review', 'assigned', 'accepted', 'confirmed',
        'in_progress', 'pending_payment', 'completed', 'cancelled', 'declined',
    }
