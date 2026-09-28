"""
Admin alert on every new booking — e-mail + WhatsApp template.

Pins the contract that makes « Confirmé sous 2h » possible:
  - every configured admin recipient gets its own send and its own log line,
    and one failing recipient never stops the others;
  - the WhatsApp template's variables are flat, truncated and never empty
    (Meta rejects the whole send otherwise);
  - a template not yet approved (no SID) logs « template en attente » —
    never a silent miss — while the e-mail still goes out;
  - create_booking saves the booking even when the alert blows up.

Offline: fake twilio.rest and fake smtplib, throwaway SQLite, no network.

Usage:
    pytest tests/test_admin_new_booking_alert.py -v
"""
import logging
import sys
import types
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

import werkzeug as _werkzeug
if not hasattr(_werkzeug, "__version__"):
    try:
        from importlib.metadata import version as _pkg_version
        _werkzeug.__version__ = _pkg_version("werkzeug")
    except Exception:
        _werkzeug.__version__ = "0"

from flask import Flask

import shizuverse.utils.admin_alerts as alerts
import shizuverse.utils.mailer as mailer
import shizuverse.utils.notifications as notif

KEY = alerts.TEMPLATE_KEY


def fake_booking(**overrides):
    base = dict(
        id=86,
        created_at=datetime(2026, 9, 28, 10, 0),
        appointment_date=datetime(2026, 9, 29, 8, 0),
        client_name="Awa Koné",
        client_phone="+2250700000001",
        client_location="Cocody, Riviera 3, près de la pharmacie",
        service_name="Demande libre",
        urgency="urgent_2h",
        time_preference="morning",
        time_slot=None,
        locale="fr",
        notes=("Demande du client : « Fuite d'eau sous l'évier »\n"
               "Précisions du client : Portail bleu, 2e étage"),
    )
    base.update(overrides)
    return SimpleNamespace(**base)


# ── Fakes ─────────────────────────────────────────────────────────────────────

@pytest.fixture()
def env(monkeypatch):
    for k in ("SHIZU_ADMIN_PHONES", "SHIZU_ADMIN_PHONE", "SHIZU_ADMIN_EMAILS",
              "TWILIO_STATUS_CALLBACK_URL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_test")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    monkeypatch.setenv("SMTP_HOST", "smtp.test")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "alertes@shizu.test")
    monkeypatch.setenv("SMTP_PASSWORD", "pw")
    return monkeypatch


@pytest.fixture()
def twilio(monkeypatch):
    """Registered template + captured Twilio sends. fail_to = numbers that raise."""
    monkeypatch.setattr(notif, "_TEMPLATE_SIDS", {KEY: "HX_admin"})
    state = SimpleNamespace(calls=[], fail_to=set())

    class FakeMessages:
        def create(self, **kw):
            if kw["to"].replace("whatsapp:", "") in state.fail_to:
                raise RuntimeError("twilio down for this number")
            state.calls.append(kw)
            return SimpleNamespace(sid="SM_test")

    class FakeClient:
        def __init__(self, *a, **k):
            self.messages = FakeMessages()

    fake = types.ModuleType("twilio.rest")
    fake.Client = FakeClient
    monkeypatch.setitem(sys.modules, "twilio.rest", fake)
    return state


@pytest.fixture()
def smtp(monkeypatch):
    """Captured SMTP sends. fail_to = addresses whose send raises."""
    state = SimpleNamespace(sent=[], fail_to=set(), ssl=[], starttls=0)

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            self.host, self.port = host, port
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False
        def starttls(self):
            state.starttls += 1
        def login(self, user, pw):
            pass
        def send_message(self, msg):
            if msg["To"] in state.fail_to:
                raise OSError("smtp refused")
            state.sent.append(msg)

    class FakeSMTPSSL(FakeSMTP):
        def __init__(self, host, port, timeout=None):
            super().__init__(host, port, timeout)
            state.ssl.append(port)

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(mailer.smtplib, "SMTP_SSL", FakeSMTPSSL)
    return state


# ── Content ───────────────────────────────────────────────────────────────────

def test_template_variables_from_a_free_request():
    v = alerts.build_alert(fake_booking())["variables"]
    assert v == {
        "1": "SHZ-2026-86",
        "2": "Demande libre",
        "3": "Cocody",
        "4": "⚡ urgent 2h, matin 8h–12h",
        "5": "Fuite d'eau sous l'évier",
    }


def test_variables_are_flat_and_truncated():
    long_text = "Fuite\td'eau   sous\nl'évier " + "x" * 300
    v = alerts.build_alert(fake_booking(
        notes=f"Demande du client : « {long_text} »",
        service_name="S" * 200,
    ))["variables"]
    for value in v.values():
        assert "\n" not in value and "\t" not in value and "     " not in value
    assert len(v["5"]) == alerts.MAX_DESCRIPTION and v["5"].endswith("…")
    assert v["5"].startswith("Fuite d'eau sous l'évier x")
    assert len(v["2"]) == alerts.MAX_SERVICE and v["2"].endswith("…")


def test_fallbacks_never_leave_a_variable_empty():
    v = alerts.build_alert(fake_booking(
        service_name="", client_location="", urgency=None,
        time_preference=None, notes=None,
    ))["variables"]
    assert v["2"] == "Service non précisé"
    assert v["3"] == "commune non précisée"
    assert v["4"] == "à définir"
    assert v["5"] == "(aucune description)"
    assert all(value.strip() for value in v.values())


def test_description_without_hero_text_uses_first_line_with_its_label():
    b = fake_booking(notes="Catégorie choisie : Ménage et nettoyage\nPrécisions du client : 3 pièces")
    assert alerts.build_alert(b)["variables"]["5"] == "Catégorie choisie : Ménage et nettoyage"


def test_urgency_labels_follow_the_buttons_the_client_clicked():
    # The form sends under_24h for « Cette semaine » — the alert must say so.
    b = fake_booking(urgency="under_24h", time_preference="afternoon")
    assert alerts.build_alert(b)["variables"]["4"].startswith("cette semaine, après-midi")


def test_rendered_body_matches_the_meta_text():
    v = alerts.build_alert(fake_booking())["variables"]
    assert alerts.render_template_body(v) == (
        "Nouvelle demande Shizu SHZ-2026-86 : Demande libre à Cocody, créneau "
        "⚡ urgent 2h, matin 8h–12h. Le client écrit : « Fuite d'eau sous l'évier ». "
        "Merci de la traiter depuis l'espace admin.")


# ── Recipients ────────────────────────────────────────────────────────────────

def test_recipient_lists_are_trimmed_deduped_and_fall_back(env):
    env.setenv("SHIZU_ADMIN_PHONES", " +2250700000010, ,+2250700000011,+2250700000010 ")
    assert alerts.admin_phones() == ["+2250700000010", "+2250700000011"]
    env.delenv("SHIZU_ADMIN_PHONES")
    env.setenv("SHIZU_ADMIN_PHONE", "+2250700000099")
    assert alerts.admin_phones() == ["+2250700000099"]
    env.setenv("SHIZU_ADMIN_EMAILS", "coo@shizu.test,ceo@shizu.test")
    assert alerts.admin_emails() == ["coo@shizu.test", "ceo@shizu.test"]


def test_no_recipient_is_an_error_not_a_silence(env, twilio, smtp, caplog):
    with caplog.at_level(logging.WARNING):
        result = alerts.notify_admin_new_booking(fake_booking())
    assert result == {"whatsapp": {}, "email": {}}
    assert any(r.levelno == logging.ERROR and "aucun destinataire" in r.getMessage()
               for r in caplog.records)


# ── Sends ─────────────────────────────────────────────────────────────────────

def test_each_recipient_gets_its_own_send(env, twilio, smtp):
    env.setenv("SHIZU_ADMIN_PHONES", "+2250700000010,+2250700000011")
    env.setenv("SHIZU_ADMIN_EMAILS", "coo@shizu.test,ceo@shizu.test")
    result = alerts.notify_admin_new_booking(fake_booking())

    assert result["whatsapp"] == {"+2250700000010": "sent", "+2250700000011": "sent"}
    assert [c["to"] for c in twilio.calls] == ["whatsapp:+2250700000010",
                                                "whatsapp:+2250700000011"]
    assert all(c["content_sid"] == "HX_admin" for c in twilio.calls)

    assert result["email"] == {"coo@shizu.test": "sent", "ceo@shizu.test": "sent"}
    assert [m["To"] for m in smtp.sent] == ["coo@shizu.test", "ceo@shizu.test"]
    msg = smtp.sent[0]
    assert msg["Subject"] == "Nouvelle demande SHZ-2026-86 — Demande libre à Cocody"
    body = msg.get_content()
    # The FULL description, every line — not the truncated template variable.
    assert "Demande du client : « Fuite d'eau sous l'évier »" in body
    assert "Précisions du client : Portail bleu, 2e étage" in body
    assert "+2250700000001" in body and "Cocody, Riviera 3" in body


def test_one_failing_recipient_never_stops_the_others(env, twilio, smtp, caplog):
    env.setenv("SHIZU_ADMIN_PHONES", "+2250700000010,+2250700000011")
    env.setenv("SHIZU_ADMIN_EMAILS", "coo@shizu.test,ceo@shizu.test")
    twilio.fail_to.add("+2250700000010")
    smtp.fail_to.add("coo@shizu.test")
    with caplog.at_level(logging.INFO):
        result = alerts.notify_admin_new_booking(fake_booking())

    assert result["whatsapp"] == {"+2250700000010": "failed", "+2250700000011": "sent"}
    assert result["email"] == {"coo@shizu.test": "failed", "ceo@shizu.test": "sent"}
    msgs = [r.getMessage() for r in caplog.records]
    # One log line per recipient, failures at ERROR.
    for who in ("+2250700000010", "+2250700000011", "coo@shizu.test", "ceo@shizu.test"):
        assert sum(("SHZ-2026-86" in m and who in m and "ALERTE" in m) for m in msgs) == 1
    assert any(r.levelno == logging.ERROR and "e-mail coo@shizu.test : NON envoyé" in r.getMessage()
               for r in caplog.records)


def test_template_pending_is_logged_and_email_still_goes(env, twilio, smtp, monkeypatch, caplog):
    monkeypatch.setattr(notif, "_TEMPLATE_SIDS", {})   # Meta has not approved it yet
    env.setenv("SHIZU_ADMIN_PHONES", "+2250700000010")
    env.setenv("SHIZU_ADMIN_EMAILS", "coo@shizu.test")
    with caplog.at_level(logging.WARNING):
        result = alerts.notify_admin_new_booking(fake_booking())

    assert result == {"whatsapp": {"+2250700000010": "pending"},
                      "email": {"coo@shizu.test": "sent"}}
    assert twilio.calls == []
    assert any("template en attente" in r.getMessage() and "+2250700000010" in r.getMessage()
               for r in caplog.records)


def test_booking_id_rides_the_status_callback(env, twilio, smtp):
    env.setenv("TWILIO_STATUS_CALLBACK_URL", "https://example.test/status")
    env.setenv("SHIZU_ADMIN_PHONES", "+2250700000010")
    alerts.notify_admin_new_booking(fake_booking())
    assert twilio.calls[0]["status_callback"].endswith(f"?k={KEY}&b=86")


# ── Mailer ────────────────────────────────────────────────────────────────────

def test_mailer_port_465_uses_implicit_tls(env, smtp):
    env.setenv("SMTP_PORT", "465")
    assert mailer.send_email("coo@shizu.test", "s", "b") is True
    assert smtp.ssl == [465] and smtp.starttls == 0


def test_mailer_other_port_uses_starttls(env, smtp):
    assert mailer.send_email("coo@shizu.test", "s", "b") is True
    assert smtp.ssl == [] and smtp.starttls == 1


def test_mailer_not_configured_logs_and_returns_false(monkeypatch, smtp, caplog):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    with caplog.at_level(logging.INFO):
        assert mailer.send_email("coo@shizu.test", "Sujet", "corps secret") is False
    assert smtp.sent == []
    assert any("SMTP NOT CONFIGURED" in r.getMessage() for r in caplog.records)
    assert not any("corps secret" in r.getMessage() for r in caplog.records)


def test_mailer_failure_logs_traceback(env, smtp, caplog):
    smtp.fail_to.add("coo@shizu.test")
    with caplog.at_level(logging.ERROR):
        assert mailer.send_email("coo@shizu.test", "s", "b") is False
    rec = [r for r in caplog.records if "EMAIL send failed" in r.getMessage()]
    assert len(rec) == 1 and rec[0].exc_info is not None


# ── create_booking wiring ─────────────────────────────────────────────────────

@pytest.fixture()
def api(tmp_path):
    from shizuverse.models import db, ClientBooking
    from shizuverse.api.bookings import bookings_bp
    from shizuverse.limiter import limiter

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
    yield SimpleNamespace(app=application, client=application.test_client(),
                          db=db, ClientBooking=ClientBooking)
    with application.app_context():
        db.drop_all()


BOOKING_PAYLOAD = {
    "client_name": "Awa Koné",
    "client_phone": "0700000001",
    "client_location": "Cocody, Riviera 3",
    "appointment_date": (datetime.utcnow() + timedelta(days=2)).replace(microsecond=0).isoformat(),
    "service_name": "Demande libre",
    "urgency": "urgent_2h",
    "time_preference": "morning",
    "notes": "Demande du client : « Fuite d'eau sous l'évier »",
}


@pytest.fixture()
def background(monkeypatch):
    """Keep a handle on every background task create_booking starts, so a test
    can wait for it to finish (production code never waits)."""
    import shizuverse.utils.background as bg
    started = []
    real = bg.run_in_background

    def tracking(fn, *args, **kwargs):
        t = real(fn, *args, **kwargs)
        started.append(t)
        return t

    monkeypatch.setattr(bg, "run_in_background", tracking)
    return started


def test_create_booking_alerts_the_admin_after_the_commit(api, monkeypatch, background):
    seen = []

    def spy(snapshot):
        # Runs AFTER the commit, on a plain snapshot — not the ORM object.
        with api.app.app_context():
            in_base = api.db.session.get(api.ClientBooking, snapshot.id) is not None
        seen.append((snapshot.id, in_base, type(snapshot).__name__, snapshot.notes))

    monkeypatch.setattr(alerts, "notify_admin_new_booking", spy)
    resp = api.client.post("/api/bookings/", json=BOOKING_PAYLOAD)
    assert resp.status_code == 201
    assert len(background) == 1
    background[0].join(timeout=5)
    assert seen == [(resp.get_json()["id"], True, "SimpleNamespace",
                     BOOKING_PAYLOAD["notes"])]


def test_create_booking_does_not_wait_for_a_slow_alert(api, monkeypatch, background):
    """A dead SMTP server used to hold the response up to the proxy timeout:
    the client saw an error for a booking that existed, and retried."""
    import threading
    import time
    release, finished = threading.Event(), threading.Event()

    def slow_alert(snapshot):
        release.wait(timeout=10)          # stands in for a hung SMTP / Twilio call
        finished.set()

    monkeypatch.setattr(alerts, "notify_admin_new_booking", slow_alert)
    t0 = time.monotonic()
    resp = api.client.post("/api/bookings/", json=BOOKING_PAYLOAD)
    elapsed = time.monotonic() - t0

    assert resp.status_code == 201
    assert elapsed < 2, f"the response waited {elapsed:.1f}s for the alert"
    assert not finished.is_set(), "the alert is still running after the response"
    release.set()
    background[0].join(timeout=5)
    assert finished.is_set()


def test_create_booking_survives_an_exploding_alert(api, monkeypatch, background, caplog):
    def boom(snapshot):
        raise RuntimeError("alert exploded")

    monkeypatch.setattr(alerts, "notify_admin_new_booking", boom)
    with caplog.at_level(logging.ERROR):
        resp = api.client.post("/api/bookings/", json=BOOKING_PAYLOAD)
        background[0].join(timeout=5)

    assert resp.status_code == 201
    with api.app.app_context():
        assert api.db.session.get(api.ClientBooking, resp.get_json()["id"]) is not None
    # Raised in the background: logged there, with its traceback — not lost.
    rec = [r for r in caplog.records if "background task failed" in r.getMessage()]
    assert len(rec) == 1 and rec[0].exc_info is not None
    assert "admin-alert-" in rec[0].getMessage()


def test_snapshot_copies_every_field_the_alert_reads():
    b = fake_booking()
    snap = alerts.alert_snapshot(b)
    assert alerts.build_alert(snap) == alerts.build_alert(b)
    assert alerts._email_content(snap, alerts.build_alert(snap)) == \
        alerts._email_content(b, alerts.build_alert(b))


# ── Timeouts ──────────────────────────────────────────────────────────────────

def test_twilio_client_has_an_explicit_timeout(env, monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, *a, **k):
            captured.update(k)

    fake = types.ModuleType("twilio.rest")
    fake.Client = FakeClient
    monkeypatch.setitem(sys.modules, "twilio.rest", fake)
    notif._twilio_client()
    assert captured["http_client"].timeout == notif.TWILIO_TIMEOUT_SECONDS == 10


def test_smtp_timeout_is_short(env, monkeypatch):
    seen = []

    class RecordingSMTP:
        def __init__(self, host, port, timeout=None):
            seen.append(timeout)
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def starttls(self): pass
        def login(self, *a): pass
        def send_message(self, msg): pass

    monkeypatch.setattr(mailer.smtplib, "SMTP", RecordingSMTP)
    assert mailer.send_email("coo@shizu.test", "s", "b") is True
    assert seen == [10]
