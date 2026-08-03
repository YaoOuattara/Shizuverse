"""
Wrappers switched from free-form to approved templates (LOT 1).

Why these tests exist: a free-form WhatsApp only reaches someone who wrote to
us in the last 24h, so every business-initiated notification sent that way is
silently undelivered in production. Switching to a template fixes delivery, but
introduces two new ways to fail silently — a wrong template KEY (send_whatsapp_
template logs and returns False) and a wrong VARIABLE COUNT/ORDER (Meta rejects
with 63028). Both are invisible without assertions, so each switched wrapper is
pinned here on: the exact key, the exact positional variables, and booking_id
propagation into the statusCallback URL.

Usage:
    pytest tests/test_notification_templates.py -v
"""
import json
import sys
import types
from datetime import datetime

import pytest

CALLBACK_URL = "https://shizu-verse.onrender.com/api/webhooks/twilio/status"

# Every key the code can build, so a send is never refused for a MISSING SID —
# these tests check what the code sends, not the registry's contents.
ALL_KEYS = [
    "shizu_devis_fr", "shizu_devis_en",
    "shizu_booking_created_fr", "shizu_booking_created_en",
    "shizu_provider_assigned_fr", "shizu_provider_assigned_en",
    "shizu_booking_confirmed_fr", "shizu_booking_confirmed_en",
    "shizu_payment_confirmed_fr", "shizu_payment_confirmed_en",
    "shizu_booking_completed_fr", "shizu_booking_completed_en",
    "shizu_deposit_received_fr", "shizu_deposit_received_en",
    "shizu_provider_started_fr", "shizu_provider_started_en",
    "shizu_booking_cancelled_client_fr", "shizu_booking_cancelled_client_en",
    "shizu_booking_rescheduled_client_fr", "shizu_booking_rescheduled_client_en",
    "shizu_booking_cancelled_provider_fr", "shizu_booking_rescheduled_provider_fr",
    "shizu_payment_recorded_fr", "shizu_payout_sent_fr", "shizu_review_received_fr",
    "shizu_provider_rejected_fr", "shizu_provider_registration_fr",
    "shizu_provider_approved_fr", "shizu_provider_new_mission_fr",
    "shizu_provider_booking_confirmed_fr",
]


@pytest.fixture()
def twilio(monkeypatch):
    """Capture what would reach Twilio: content_sid, variables, status_callback."""
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok_test")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    monkeypatch.setenv("TWILIO_STATUS_CALLBACK_URL", CALLBACK_URL)
    monkeypatch.setenv("NEXT_PUBLIC_SHIZU_WHATSAPP", "+2250554018989")

    import shizuverse.utils.notifications as n
    monkeypatch.setattr(n, "_TEMPLATE_SIDS", {k: f"HX_{k}" for k in ALL_KEYS})

    calls = []

    class FakeMessages:
        def create(self, **kw):
            calls.append(kw)
            return types.SimpleNamespace(sid=f"SM_{len(calls)}")

    class FakeClient:
        def __init__(self, *a, **k):
            self.messages = FakeMessages()

    fake = types.ModuleType("twilio.rest")
    fake.Client = FakeClient
    monkeypatch.setitem(sys.modules, "twilio.rest", fake)

    def last():
        assert calls, "aucun envoi capturé — le wrapper a refusé d'envoyer"
        return calls[-1]

    return types.SimpleNamespace(
        calls=calls,
        last=last,
        key=lambda: last()["content_sid"].replace("HX_", ""),
        vars=lambda: json.loads(last()["content_variables"]),
        callback=lambda: last().get("status_callback", ""),
    )


# ── Client wrappers switched to templates ────────────────────────────────────

def test_provider_started_uses_template_and_two_vars(twilio):
    from shizuverse.utils.notifications import notify_provider_started
    assert notify_provider_started(
        client_name="Awa", client_phone="+2250707050154",
        provider_name="Koffi Plomberie", locale="fr", booking_id=80,
    ) is True
    assert twilio.key() == "shizu_provider_started_fr"
    assert twilio.vars() == {"1": "Awa", "2": "Koffi Plomberie"}
    assert twilio.callback().endswith("&b=80")


def test_provider_started_english_key(twilio):
    from shizuverse.utils.notifications import notify_provider_started
    notify_provider_started(client_name="Awa", client_phone="+2250707050154",
                            provider_name="Koffi", locale="en")
    assert twilio.key() == "shizu_provider_started_en"


def test_booking_cancelled_client_drops_reason(twilio):
    from shizuverse.utils.notifications import notify_booking_cancelled_client
    assert notify_booking_cancelled_client(
        client_name="Awa", client_phone="+2250707050154",
        booking_ref="SHZ-2026-80", reason="client indisponible",
        locale="fr", booking_id=80,
    ) is True
    assert twilio.key() == "shizu_booking_cancelled_client_fr"
    # The reason has no slot in the approved template — accepted loss.
    assert twilio.vars() == {"1": "Awa", "2": "SHZ-2026-80"}
    assert twilio.callback().endswith("&b=80")


def test_booking_rescheduled_client_four_vars(twilio):
    from shizuverse.utils.notifications import notify_booking_rescheduled_client
    assert notify_booking_rescheduled_client(
        client_name="Awa", client_phone="+2250707050154",
        booking_ref="SHZ-2026-80", new_date="mardi 4 août 2026",
        new_slot="Après-midi 12h–17h", locale="fr", booking_id=80,
    ) is True
    assert twilio.key() == "shizu_booking_rescheduled_client_fr"
    assert twilio.vars() == {"1": "Awa", "2": "SHZ-2026-80",
                             "3": "mardi 4 août 2026", "4": "Après-midi 12h–17h"}


def test_rescheduled_client_empty_slot_falls_back_and_still_sends(twilio):
    """An empty {{4}} would have the whole send refused — the fallback prevents it."""
    from shizuverse.utils.notifications import notify_booking_rescheduled_client
    assert notify_booking_rescheduled_client(
        client_name="Awa", client_phone="+2250707050154",
        booking_ref="SHZ-2026-80", new_date="mardi 4 août 2026",
        new_slot="", locale="fr",
    ) is True, "un créneau vide ne doit PAS bloquer l'envoi"
    assert twilio.vars()["4"] == "Flexible"


def test_rescheduled_client_empty_slot_english_fallback(twilio):
    from shizuverse.utils.notifications import notify_booking_rescheduled_client
    from shizuverse.routes.admin import _SLOT_LABELS
    notify_booking_rescheduled_client(
        client_name="Awa", client_phone="+2250707050154",
        booking_ref="SHZ-2026-80", new_date="Tuesday 4 August 2026",
        new_slot="", locale="en",
    )
    assert twilio.vars()["4"] == _SLOT_LABELS["anytime"]["en"], \
        "pas de mot français dans un message anglais"


# ── Le repli de créneau doit LIRE _SLOT_LABELS, jamais le recopier ───────────

def test_slot_fallback_is_never_hardcoded():
    """Source-level guard: a literal label here would be a second definition of
    a vocabulary that already has one home, and the two would drift.

    Docstrings are stripped before scanning — the prose explaining WHY not to
    hardcode a label naturally quotes the label itself.
    """
    import ast
    import inspect
    import textwrap
    import shizuverse.utils.notifications as n
    watched = ("_slot_fallback",
               "notify_booking_rescheduled_client",
               "notify_booking_rescheduled_provider")
    for name in watched:
        fn = ast.parse(textwrap.dedent(inspect.getsource(getattr(n, name)))).body[0]
        if ast.get_docstring(fn):
            fn.body = fn.body[1:]
        code_only = ast.unparse(fn)
        for literal in ("Flexible", "Anytime"):
            assert literal not in code_only, (
                f"{name} code en dur '{literal}' — doit lire _SLOT_LABELS['anytime']"
            )


@pytest.mark.parametrize("locale,lang", [("fr", "fr"), ("en", "en")])
def test_client_fallback_follows_slot_labels(twilio, monkeypatch, locale, lang):
    """Change the single source and the message must follow.

    This is what proves there is no copy: if anyone reintroduces a literal, the
    sentinel below stops appearing and the test fails.
    """
    import shizuverse.routes.admin as admin_mod
    from shizuverse.utils.notifications import notify_booking_rescheduled_client
    patched = dict(admin_mod._SLOT_LABELS)
    patched["anytime"] = {"fr": "SENTINELLE_FR", "en": "SENTINELLE_EN"}
    monkeypatch.setattr(admin_mod, "_SLOT_LABELS", patched)

    notify_booking_rescheduled_client(
        client_name="Awa", client_phone="+2250707050154",
        booking_ref="SHZ-2026-80", new_date="d", new_slot="", locale=locale,
    )
    assert twilio.vars()["4"] == f"SENTINELLE_{lang.upper()}"


def test_provider_fallback_follows_slot_labels_and_stays_french(twilio, monkeypatch):
    """T-19: the provider fallback reads the FR entry whatever the client speaks."""
    import shizuverse.routes.admin as admin_mod
    from shizuverse.utils.notifications import notify_booking_rescheduled_provider
    patched = dict(admin_mod._SLOT_LABELS)
    patched["anytime"] = {"fr": "SENTINELLE_FR", "en": "SENTINELLE_EN"}
    monkeypatch.setattr(admin_mod, "_SLOT_LABELS", patched)

    notify_booking_rescheduled_provider(
        provider_phone="+2250544332211", booking_ref="SHZ-2026-80",
        new_date="d", new_slot="",
    )
    assert twilio.vars()["3"] == "SENTINELLE_FR"


# ── Provider wrappers switched to templates (T-19: always _fr) ───────────────

def test_payout_sent_amount_then_date(twilio):
    from shizuverse.utils.notifications import notify_payout_sent
    assert notify_payout_sent(
        provider_phone="+2250544332211", provider_payout=25000,
        payout_date="mardi 4 août 2026", booking_id=80,
    ) is True
    assert twilio.key() == "shizu_payout_sent_fr"
    # {{1}} amount, {{2}} date — and NO booking reference in this template.
    assert twilio.vars() == {"1": "25 000", "2": "mardi 4 août 2026"}
    assert twilio.callback().endswith("&b=80")


def test_review_received_ref_then_rating(twilio):
    from shizuverse.utils.notifications import notify_review_received
    assert notify_review_received(
        provider_phone="+2250544332211", booking_ref="SHZ-2026-80",
        rating=5, booking_id=80,
    ) is True
    assert twilio.key() == "shizu_review_received_fr"
    assert twilio.vars() == {"1": "SHZ-2026-80", "2": "5"}


def test_rescheduled_provider_three_vars(twilio):
    from shizuverse.utils.notifications import notify_booking_rescheduled_provider
    assert notify_booking_rescheduled_provider(
        provider_phone="+2250544332211", booking_ref="SHZ-2026-80",
        new_date="mardi 4 août 2026", new_slot="Matin 8h–12h", booking_id=80,
    ) is True
    assert twilio.key() == "shizu_booking_rescheduled_provider_fr"
    assert twilio.vars() == {"1": "SHZ-2026-80", "2": "mardi 4 août 2026",
                             "3": "Matin 8h–12h"}


def test_rescheduled_provider_empty_slot_falls_back(twilio):
    from shizuverse.utils.notifications import notify_booking_rescheduled_provider
    assert notify_booking_rescheduled_provider(
        provider_phone="+2250544332211", booking_ref="SHZ-2026-80",
        new_date="mardi 4 août 2026", new_slot="",
    ) is True
    assert twilio.vars()["3"] == "Flexible"


def test_cancelled_provider_two_vars(twilio):
    from shizuverse.utils.notifications import notify_booking_cancelled_provider
    assert notify_booking_cancelled_provider(
        provider_phone="+2250544332211", booking_ref="SHZ-2026-80",
        date="mardi 4 août 2026", booking_id=80,
    ) is True
    assert twilio.key() == "shizu_booking_cancelled_provider_fr"
    assert twilio.vars() == {"1": "SHZ-2026-80", "2": "mardi 4 août 2026"}


# ── provider_approved aligned on a zero-variable template ────────────────────

def test_provider_approved_sends_no_variable(twilio):
    from shizuverse.utils.notifications import notify_provider_approved
    assert notify_provider_approved(
        provider_phone="+2250544332211", provider_name="Koffi Plomberie",
        approved_date="29/07/2026",
    ) is True
    assert twilio.key() == "shizu_provider_approved_fr"
    assert twilio.vars() == {}, "le template approuvé ne porte AUCUNE variable"


# ── T-19 : no provider wrapper ever builds an _en key ────────────────────────

def test_no_provider_wrapper_builds_an_en_key():
    import inspect
    import shizuverse.utils.notifications as n
    provider_wrappers = [
        "notify_booking_confirmed_provider", "notify_provider_approved",
        "notify_provider_new_mission", "notify_registration_submitted",
        "notify_payout_sent", "notify_review_received",
        "notify_booking_rescheduled_provider", "notify_booking_cancelled_provider",
        "notify_dispute_opened_provider", "notify_dispute_no_payment_provider",
        "notify_dispute_released_provider",
    ]
    for name in provider_wrappers:
        src = inspect.getsource(getattr(n, name))
        assert '_{loc}' not in src, f"{name} construit une clé dynamique — viole T-19"
        assert 'locale' not in inspect.signature(getattr(n, name)).parameters, \
            f"{name} accepte une locale — viole T-19"


# ── Dead wrappers removed ────────────────────────────────────────────────────

def test_dead_wrappers_are_gone():
    import shizuverse.utils.notifications as n
    assert not hasattr(n, "notify_payment_recorded"), "code mort : aucun appelant"
    assert not hasattr(n, "notify_new_booking_request"), \
        "code mort : encodait le pool ouvert fermé par T-26"


# ── provider_rejected stays free-form on purpose ─────────────────────────────

def test_provider_rejected_still_free_form_and_carries_the_reason(twilio):
    """Locked decision: the template has no slot for the AI-generated reason."""
    from shizuverse.utils.notifications import notify_provider_rejected
    assert notify_provider_rejected(
        provider_phone="+2250544332211",
        reason="photo de profil illisible",
    ) is True
    call = twilio.last()
    assert "content_sid" not in call, "doit rester en free-form"
    assert "photo de profil illisible" in call["body"], \
        "le motif doit atteindre le prestataire — c'est tout l'intérêt du message"


# ── booking_id propagation on the already-templated wrappers ─────────────────

@pytest.mark.parametrize("call", [
    lambda n: n.notify_booking_confirmed_client(
        client_name="Awa", client_phone="+225070705015", booking_ref="R",
        provider_name="P", date="d", time="t", locale="fr", booking_id=80),
    lambda n: n.notify_provider_assigned(
        client_name="Awa", client_phone="+225070705015", booking_ref="R",
        provider_name="P", date="d", commune="Cocody", locale="fr", booking_id=80),
    lambda n: n.notify_payment_confirmed(
        client_name="Awa", client_phone="+225070705015", booking_ref="R",
        amount=25000, locale="fr", booking_id=80),
    lambda n: n.notify_deposit_received(
        client_name="Awa", client_phone="+225070705015", booking_ref="R",
        amount=10000, amount_due=15000, locale="fr", booking_id=80),
    lambda n: n.notify_payment_instructions(
        client_name="Awa", client_phone="+225070705015", booking_ref="R",
        amount=25000, quote_token="tok", locale="fr", booking_id=80),
    lambda n: n.notify_booking_completed(
        client_phone="+225070705015", client_name="Awa", provider_name="P",
        booking_id=80, locale="fr"),
    lambda n: n.notify_booking_confirmed_provider(
        provider_phone="+2250544332211", booking_ref="R", client_name="Awa",
        service="S", date="d", time="t", commune="Cocody", booking_id=80),
    lambda n: n.notify_provider_new_mission(
        provider_phone="+2250544332211", booking_ref="R", service_name="S",
        date="d", commune="Cocody", provider_payout=20000, booking_id=80),
])
def test_booking_id_reaches_the_status_callback(twilio, call):
    """Without ?b=, the outbound row is attached by guessing the phone number —
    which put a devis on booking 78 instead of the right file."""
    import shizuverse.utils.notifications as n
    assert call(n) is True
    assert twilio.callback().endswith("&b=80"), twilio.callback()


# ── Micro-lot: booking_created log body matches the production text ──────────

def test_booking_created_log_body_matches_production():
    from shizuverse.utils.notifications import _render_client
    fr = _render_client("booking_created", "fr", client_name="Awa",
                        booking_ref="SHZ-2026-80")
    assert fr == ("Bonjour Awa, votre demande Shizu a bien été reçue. "
                  "Référence : SHZ-2026-80. Le délai de confirmation de votre "
                  "prestataire n'excédera pas deux heures.")
    en = _render_client("booking_created", "en", client_name="Awa",
                        booking_ref="SHZ-2026-80")
    assert en == ("Hello Awa, your Shizu request has been received. "
                  "Reference: SHZ-2026-80. Your provider will be confirmed "
                  "within two hours at most.")


# ── Long date helper ────────────────────────────────────────────────────────

def test_format_long_date_matches_template_expectation():
    from shizuverse.utils.dates import format_long_date
    d = datetime(2026, 8, 4, 14, 30)
    assert format_long_date(d, "fr") == "mardi 4 août 2026"
    assert format_long_date(d, "en") == "Tuesday 4 August 2026"
    assert format_long_date(None) == ""
    # Unknown locale degrades to French, like _norm_locale everywhere else.
    assert format_long_date(d, "xx") == "mardi 4 août 2026"


# ── Les trois derniers log_body réalignés sur les textes approuvés ───────────

def test_realigned_log_bodies_match_the_approved_texts():
    """Textes lus depuis l'API Content, recopiés mot pour mot. Seule divergence
    consciente : l'espace finale du corps approuvé de provider_started_fr n'est
    PAS reproduite — c'est du log, pas de l'envoi, et un caractère invisible
    casse les greps (commenté dans CLIENT_TEMPLATES)."""
    from shizuverse.utils.notifications import _render_client

    assert _render_client("provider_started", "fr",
                          client_name="Awa", provider_name="Koffi") == \
        ("Bonjour Awa, Koffi a démarré votre mission Shizu. "
         "En cas de problème, contactez-nous immédiatement.")
    assert _render_client("provider_started", "en",
                          client_name="Awa", provider_name="Koffi") == \
        ("Hello Awa, Koffi has started your Shizu service. "
         "If anything goes wrong, contact us right away.")

    assert _render_client("booking_cancelled_client", "fr",
                          client_name="Awa", booking_ref="SHZ-2026-80") == \
        ("Bonjour Awa, votre réservation SHZ-2026-80 a été annulée. Notre "
         "équipe vous contacte pour le point et des propositions de solutions.")
    assert _render_client("booking_cancelled_client", "en",
                          client_name="Awa", booking_ref="SHZ-2026-80") == \
        ("Hello Awa, your booking SHZ-2026-80 has been cancelled. Our team "
         "will contact you with an update and proposed solutions.")

    assert _render_client("booking_rescheduled_client", "fr",
                          client_name="Awa", booking_ref="SHZ-2026-80",
                          new_date="mardi 4 août 2026", slot="Matin 8h–12h") == \
        ("Bonjour Awa, votre réservation SHZ-2026-80 a été reprogrammée. "
         "Nouvelle date : mardi 4 août 2026, Matin 8h–12h. Le prestataire "
         "vous contactera avant son arrivée.")
    assert _render_client("booking_rescheduled_client", "en",
                          client_name="Awa", booking_ref="SHZ-2026-80",
                          new_date="Tuesday 4 August 2026", slot="Morning 8am–12pm") == \
        ("Hello Awa, your booking SHZ-2026-80 has been rescheduled. New date: "
         "Tuesday 4 August 2026, Morning 8am–12pm. The provider will contact "
         "you before arriving.")
