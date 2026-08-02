"""
AnomalyLog — les deux défauts du dedup (0c49ab1), latents tant que la fenêtre
24h de Yao est ouverte, actifs le jour où le destinataire devient Marie-Paule.

BUG 1 — le stamp conditionnel : last_notified_at n'était écrit que sur envoi
RÉUSSI. Sain pour un échec transitoire, faux pour un échec STRUCTUREL (envoi
free-form hors fenêtre 24h = échec à chaque run) : la ligne n'était jamais
tamponnée, le rappel 6h ne s'engageait jamais, réémission horaire à l'infini —
les ~44 alertes du dossier 77. Le stamp porte désormais sur la TENTATIVE, et
last_send_ok garde le résultat visible.

BUG 2 — la collision des agrégées : provider_id valait None sur les six types,
y compris low_provider_acceptance qui identifie un prestataire. Deux
prestataires en faible acceptation partageaient la clé (type, None, None) :
une seule ligne, la description du second écrasant celle du premier.

Usage:
    pytest tests/test_anomaly_dedup.py -v
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

from shizuverse.models import db, User, ClientBooking
from shizuverse.models.anomaly_log import AnomalyLog
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory


@pytest.fixture()
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("SHIZU_ADMIN_PHONE", "+2250554018989")

    application = Flask(__name__)
    application.config["TESTING"] = True
    application.config["SECRET_KEY"] = "t"
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path / 'an.db'}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(application)
    with application.app_context():
        db.create_all()
        cat = ServiceCategory(name="Ménage")
        db.session.add(cat); db.session.flush()
        sub = ServiceSubcategory(name="Ménage standard", category_id=cat.id)
        db.session.add(sub); db.session.flush()
        svc = Service(name="Menage", subcategory_id=sub.id, is_active=True)
        svc2 = Service(name="Plomberie", subcategory_id=sub.id, is_active=True)
        db.session.add_all([svc, svc2]); db.session.flush()
        db.session.commit()
        application.config["_SVC"] = svc.id
        application.config["_SVC2"] = svc2.id
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def sends(monkeypatch):
    """Capture les tentatives d'envoi ; échec par défaut (le cas Marie-Paule)."""
    import shizuverse.utils.anomaly_detector as det
    import shizuverse.utils.notifications as notif

    calls = []
    state = {"ok": False}

    def fake_send(phone, message, **kw):
        calls.append(message)
        return state["ok"]

    monkeypatch.setattr(notif, "send_whatsapp", fake_send)
    # L'alerte Haiku est hors sujet ici — texte déterministe.
    monkeypatch.setattr(det, "generate_anomaly_alert", lambda anoms: f"{len(anoms)} anomalie(s)")
    state["calls"] = calls
    return state


def _stuck_booking(app, hours_ago=4):
    """Réservation non assignée depuis N heures → booking_stuck_unassigned."""
    with app.app_context():
        b = ClientBooking(
            client_name="Client", client_phone="+2250707050154",
            client_location="Cocody, Abidjan", service_name="Menage",
            service_id=app.config["_SVC"],
            appointment_date=datetime.utcnow() + timedelta(days=1),
            status="requested",
            created_at=datetime.utcnow() - timedelta(hours=hours_ago),
        )
        db.session.add(b); db.session.commit()
        return b.id


def _provider(app, name, phone):
    with app.app_context():
        u = User(email=None, user_type="provider", full_name=name)
        u.password_hash = "x"
        db.session.add(u); db.session.flush()
        sp = ServiceProvider(
            user_id=u.id, service_id=app.config["_SVC"], phone_number=phone,
            company_name=name, verification_status="approved",
            provider_status="active",
        )
        db.session.add(sp); db.session.commit()
        return u.id, sp.id


def _declined_bookings(app, user_id, name, n=3):
    """N missions refusées récentes pour ce prestataire (insérées directement :
    le détecteur est exercé tel qu'écrit)."""
    with app.app_context():
        for _ in range(n):
            db.session.add(ClientBooking(
                client_name="Client", client_phone="+2250707050154",
                client_location="Cocody, Abidjan", service_name="Menage",
                service_id=app.config["_SVC"],
                appointment_date=datetime.utcnow() + timedelta(days=1),
                status="declined", provider_name=name,
                provider_user_id=user_id,
                created_at=datetime.utcnow() - timedelta(days=1),
            ))
        db.session.commit()


def _run(app):
    from shizuverse.utils.anomaly_detector import run_anomaly_check
    with app.app_context():
        return run_anomaly_check()


def _rows(app, kind):
    with app.app_context():
        return AnomalyLog.query.filter_by(anomaly_type=kind).all()


# ── BUG 1 : un échec d'envoi ne provoque plus de réémission ─────────────────

def test_a_failed_send_does_not_refire_on_the_next_run(app, sends):
    """Le cas qui explosera chez Marie-Paule : hors fenêtre 24h, l'envoi échoue
    à CHAQUE run. Hier : jamais tamponné → réémission horaire. Aujourd'hui :
    tamponné à la tentative, le run suivant ne notifie rien."""
    _stuck_booking(app)

    r1 = _run(app)
    assert r1["notified"] == 1 and r1["alert_sent"] is False
    assert len(sends["calls"]) == 1

    r2 = _run(app)   # le cron une heure plus tard, même échec structurel
    assert r2["detected"] == 1, "l'anomalie persiste"
    assert r2["notified"] == 0, "mais elle ne réémet PAS"
    assert len(sends["calls"]) == 1, "aucune nouvelle tentative avant le rappel 6h"


def test_the_failure_is_recorded_on_the_row(app, sends):
    _stuck_booking(app)
    _run(app)
    row = _rows(app, "booking_stuck_unassigned")[0]
    assert row.last_notified_at is not None, "la TENTATIVE est tamponnée"
    assert row.last_send_ok is False, "et son échec reste visible"


def test_the_6h_reminder_still_works_after_a_failure(app, sends):
    _stuck_booking(app)
    _run(app)
    with app.app_context():
        row = AnomalyLog.query.filter_by(anomaly_type="booking_stuck_unassigned").one()
        row.last_notified_at = datetime.utcnow() - timedelta(hours=7)
        db.session.commit()

    r = _run(app)
    assert r["notified"] == 1, "le rappel 6h reprend son rôle"
    assert len(sends["calls"]) == 2


def test_a_successful_send_is_recorded_too(app, sends):
    sends["ok"] = True
    _stuck_booking(app)
    r = _run(app)
    assert r["alert_sent"] is True
    assert _rows(app, "booking_stuck_unassigned")[0].last_send_ok is True


# ── BUG 2 : deux prestataires, deux lignes ──────────────────────────────────

def test_two_low_acceptance_providers_get_two_rows(app, sends):
    """Hier : clé partagée (type, None, None) → une ligne, la description du
    second écrasait celle du premier."""
    u1, sp1 = _provider(app, "Koffi Plomberie", "+2250544332211")
    u2, sp2 = _provider(app, "Behiri Services", "+2250545521606")
    _declined_bookings(app, u1, "Koffi Plomberie")
    _declined_bookings(app, u2, "Behiri Services")

    _run(app)
    rows = _rows(app, "low_provider_acceptance")
    assert len(rows) == 2, "une ligne PAR prestataire"
    assert {r.provider_id for r in rows} == {sp1, sp2}
    descriptions = " | ".join(r.description for r in rows)
    assert "Koffi Plomberie" in descriptions and "Behiri Services" in descriptions, \
        "aucune description écrasée"


def test_the_provider_id_is_deterministic_across_runs(app, sends):
    """T-20 : la personne a plusieurs lignes SP — l'id retenu doit être stable,
    sinon la clé de dedup change d'un run à l'autre."""
    u1, sp1 = _provider(app, "Koffi Plomberie", "+2250544332211")
    with app.app_context():
        # T-20 : une ligne PAR service — la contrainte (user_id, service_id)
        # est unique, la seconde ligne porte donc un autre service.
        db.session.add(ServiceProvider(
            user_id=u1, service_id=app.config["_SVC2"],
            phone_number="+2250544332211", company_name="Koffi Plomberie",
            verification_status="approved", provider_status="active",
        ))
        db.session.commit()
    _declined_bookings(app, u1, "Koffi Plomberie")

    _run(app); _run(app)
    rows = _rows(app, "low_provider_acceptance")
    assert len(rows) == 1, "deux runs, une seule ligne (dedup stable)"
    assert rows[0].provider_id == sp1, "toujours la plus ancienne ligne SP"
    assert rows[0].occurrence_count == 2


def test_a_platform_anomaly_keeps_provider_id_none(app, sends):
    """low_completion_rate est plateforme-wide : None y est correct, et il ne
    collisionne avec rien puisque les anomalies par prestataire portent
    désormais leur id."""
    u1, _ = _provider(app, "Koffi Plomberie", "+2250544332211")
    _declined_bookings(app, u1, "Koffi Plomberie", n=5)   # 5 non annulées, 0 terminée

    _run(app)
    platform = _rows(app, "low_completion_rate")
    assert len(platform) == 1
    assert platform[0].provider_id is None
    per_provider = _rows(app, "low_provider_acceptance")
    assert all(r.provider_id is not None for r in per_provider), \
        "les deux familles ne partagent plus de clé"
