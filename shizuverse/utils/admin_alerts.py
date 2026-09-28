"""
Admin alert on every new booking request — e-mail + WhatsApp template.

Why it exists: the site promises « Confirmé sous 2h », but nothing told the
admin a request had arrived — they found it only by opening the back-office.

Two channels, each independent, one send per recipient:
  - e-mail (SMTP, utils.mailer) — works right away, no Meta approval needed;
  - WhatsApp template shizu_admin_new_booking_fr — business-initiated, so it
    MUST be a template (a free-form message only reaches someone who wrote to
    us in the last 24h). Until Meta approves it and its SID is in
    WHATSAPP_TEMPLATE_SIDS, every send logs « template en attente » instead of
    failing silently.

Recipients (comma-separated lists, set on the host, never in the repo):
  SHIZU_ADMIN_PHONES  — falls back to SHIZU_ADMIN_PHONE (single number)
  SHIZU_ADMIN_EMAILS

One recipient failing never stops the others, and every recipient gets its own
log line. Nothing here raises for a delivery problem; the caller still wraps
the call, because a booking must never be undone by its alert.

Reads only the booking object passed in — no database access — so
scripts/send_test_admin_alert.py can run it against a fake booking.
"""
import logging
import os
import re

from shizuverse.utils.booking_ref import booking_ref as make_booking_ref
from shizuverse.utils.mailer import send_email
from shizuverse.utils.notifications import is_template_registered, send_whatsapp_template

logger = logging.getLogger(__name__)

TEMPLATE_KEY = "shizu_admin_new_booking_fr"

# Word-for-word text of the template submitted to Meta — used only for the
# "Twilio not configured" log (the SID owns the real text). {{n}} ↔ "n".
TEMPLATE_BODY = ("Nouvelle demande Shizu {{1}} : {{2}} à {{3}}, créneau {{4}}. "
                 "Le client écrit : « {{5}} ». Merci de la traiter depuis l'espace admin.")


def render_template_body(variables: dict) -> str:
    """TEMPLATE_BODY with each {{n}} replaced by variables["n"]."""
    body = TEMPLATE_BODY
    for pos, value in variables.items():
        body = body.replace("{{" + pos + "}}", value)
    return body

# Truncation limits for the template variables. The template body stays well
# under Meta's 1024 characters and the message reads on a lock screen.
MAX_SERVICE = 60
MAX_COMMUNE = 40
MAX_SLOT = 60
MAX_DESCRIPTION = 120

# Labels follow the buttons the CLIENT clicked in BookingForm, not the raw
# values: the form sends under_24h for « Cette semaine » and normal for
# « 3+ jours » (BookingForm.tsx, handleSubmit).
_URGENCY_LABELS = {
    "urgent_2h": "⚡ urgent 2h",
    "same_day":  "aujourd'hui",
    "under_24h": "cette semaine",
    "normal":    "dans 3 jours ou plus",
}

# Spans lines on purpose: the hero text is single-line in the UI, but ?desc=
# can carry a newline, and the request must not be cut at it.
_CLIENT_REQUEST_RE = re.compile(r"^Demande du client : « (.*?) »[ \t]*$", re.M | re.S)


# ── Recipients ────────────────────────────────────────────────────────────────

def _split_list(raw: str) -> list:
    """'a, b,,a' → ['a', 'b'] — trimmed, empties dropped, order kept, deduped."""
    seen, out = set(), []
    for item in (raw or "").split(","):
        item = item.strip()
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def admin_phones() -> list:
    return (_split_list(os.environ.get("SHIZU_ADMIN_PHONES", ""))
            or _split_list(os.environ.get("SHIZU_ADMIN_PHONE", "")))


def admin_emails() -> list:
    return _split_list(os.environ.get("SHIZU_ADMIN_EMAILS", ""))


# ── Content ───────────────────────────────────────────────────────────────────

def flatten(value, max_len: int = None) -> str:
    """One line, single spaces, optionally truncated with « … ».

    Meta rejects a template variable holding a newline, a tab or more than four
    consecutive spaces — every variable goes through here.
    """
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if max_len and len(text) > max_len:
        text = text[:max_len - 1].rstrip() + "…"
    return text


def client_description(notes) -> str:
    """The client's own request, as the admin should read it first.

    notes is composed by BookingForm, one labelled line per source. The line
    « Demande du client : « … » » is the text typed in the hero — preferred.
    Otherwise the first non-empty line (a chosen category, the client's
    précisions…), label included so the admin knows what it is.
    """
    m = _CLIENT_REQUEST_RE.search(notes or "")
    if m:
        return m.group(1).strip()
    lines = [l.strip() for l in (notes or "").splitlines() if l.strip()]
    return lines[0] if lines else ""


def slot_label(booking) -> str:
    """« ⚡ urgent 2h, matin 8h–12h » — urgency then time of day."""
    from shizuverse.routes.admin import _SLOT_LABELS   # lazy: see notifications._slot_fallback
    parts = []
    urgency = (getattr(booking, "urgency", None) or "").strip()
    if urgency:
        parts.append(_URGENCY_LABELS.get(urgency, urgency))
    pref = (getattr(booking, "time_preference", None)
            or getattr(booking, "time_slot", None) or "").strip()
    if pref:
        label = _SLOT_LABELS.get(pref, {}).get("fr", pref)
        parts.append(label[:1].lower() + label[1:])
    return ", ".join(parts)


def build_alert(booking) -> dict:
    """Everything both channels need, with fallbacks — never an empty variable."""
    ref = make_booking_ref(booking)
    location = (getattr(booking, "client_location", None) or "").strip()
    commune = location.split(",")[0].strip()
    description = client_description(getattr(booking, "notes", None))
    variables = {
        "1": flatten(ref),
        "2": flatten(getattr(booking, "service_name", None), MAX_SERVICE) or "Service non précisé",
        "3": flatten(commune, MAX_COMMUNE) or "commune non précisée",
        "4": flatten(slot_label(booking), MAX_SLOT) or "à définir",
        "5": flatten(description, MAX_DESCRIPTION) or "(aucune description)",
    }
    return {"ref": ref, "location": location, "variables": variables}


def _email_content(booking, alert: dict, subject_prefix: str = "") -> tuple:
    v = alert["variables"]
    subject = f"{subject_prefix}Nouvelle demande {v['1']} — {v['2']} à {v['3']}"
    apt = getattr(booking, "appointment_date", None)
    lines = [
        f"Nouvelle demande Shizu — {v['1']}",
        "",
        f"Service        : {v['2']}",
        f"Lieu           : {alert['location'] or 'non précisé'}",
        f"Créneau        : {v['4']}",
        f"Date souhaitée : {apt.strftime('%d/%m/%Y') if apt else 'non précisée'}",
        f"Client         : {getattr(booking, 'client_name', None) or '—'}"
        f" — {getattr(booking, 'client_phone', None) or '—'}",
        f"Langue         : {getattr(booking, 'locale', None) or 'fr'}",
        "",
        "Description du client (complète) :",
        (getattr(booking, "notes", None) or "(aucune description)").strip(),
        "",
        "À traiter depuis l'espace admin, onglet Réservations.",
    ]
    return subject, "\n".join(lines)


# ── Send ──────────────────────────────────────────────────────────────────────

def notify_admin_new_booking(booking, *, subject_prefix: str = "") -> dict:
    """Alert every configured admin recipient about a new booking.

    Returns {"whatsapp": {phone: "sent"|"failed"|"pending"},
             "email": {address: "sent"|"failed"}} — for tests and the test
    script. Delivery problems are logged, never raised.
    """
    alert = build_alert(booking)
    ref = alert["ref"]
    phones, emails = admin_phones(), admin_emails()
    result = {"whatsapp": {}, "email": {}}

    if not phones and not emails:
        logger.error("ALERTE NOUVELLE DEMANDE %s : aucun destinataire configuré "
                     "(SHIZU_ADMIN_PHONES / SHIZU_ADMIN_EMAILS) — l'admin n'est PAS "
                     "prévenu.", ref)
        return result
    if not emails:
        logger.warning("ALERTE NOUVELLE DEMANDE %s : SHIZU_ADMIN_EMAILS vide — "
                       "pas d'e-mail.", ref)
    if not phones:
        logger.warning("ALERTE NOUVELLE DEMANDE %s : SHIZU_ADMIN_PHONES vide — "
                       "pas de WhatsApp.", ref)

    # ── E-mail — one send per recipient ────────────────────────────────────
    subject, body = _email_content(booking, alert, subject_prefix)
    for addr in emails:
        ok = send_email(addr, subject, body)
        result["email"][addr] = "sent" if ok else "failed"
        if ok:
            logger.info("ALERTE NOUVELLE DEMANDE %s → e-mail %s : envoyé", ref, addr)
        else:
            logger.error("ALERTE NOUVELLE DEMANDE %s → e-mail %s : NON envoyé", ref, addr)

    # ── WhatsApp template — one send per recipient ─────────────────────────
    booking_id = getattr(booking, "id", None)
    booking_id = booking_id if isinstance(booking_id, int) else None
    variables = alert["variables"]
    template_ready = is_template_registered(TEMPLATE_KEY)
    for phone in phones:
        if not template_ready:
            result["whatsapp"][phone] = "pending"
            logger.warning("ALERTE NOUVELLE DEMANDE %s → WhatsApp %s : template en "
                           "attente — '%s' n'a pas encore de SID dans "
                           "WHATSAPP_TEMPLATE_SIDS (validation Meta). Non envoyé.",
                           ref, phone, TEMPLATE_KEY)
            continue
        ok = send_whatsapp_template(
            phone, TEMPLATE_KEY, variables,
            log_body=render_template_body(variables),
            booking_id=booking_id,
        )
        result["whatsapp"][phone] = "sent" if ok else "failed"
        if ok:
            logger.info("ALERTE NOUVELLE DEMANDE %s → WhatsApp %s : envoyé", ref, phone)
        else:
            logger.error("ALERTE NOUVELLE DEMANDE %s → WhatsApp %s : NON envoyé", ref, phone)

    return result
