"""Twilio inbound webhook + delivery statusCallback.

Two public endpoints, both signature-verified. Design rules, all load-bearing:

  * ALWAYS answer fast and successfully. Twilio times out at 15s and retries on
    a non-2xx — a retry storm on our own bug would be worse than a lost row. So
    every handler wraps its work in try/except and still returns 200/204.
  * NEVER let an incoming message break the app (same contract as
    utils/notifications).
  * The rate limit is EXPLICIT and generous. The global default (50/hour) would
    silently drop real messages: a 429 makes Twilio consider the delivery failed
    and the message is gone. The limit here exists only to stop a flood, never
    to shape normal traffic.
"""
import json
import logging

from flask import Blueprint, request

from shizuverse.limiter import limiter
from shizuverse.models import db
from shizuverse.models.whatsapp_message import WhatsAppMessage
from shizuverse.utils.phone_match import resolve_phone
from shizuverse.utils.phone import normalize_phone
from shizuverse.utils.twilio_signature import require_twilio_signature

logger = logging.getLogger(__name__)

webhooks_bp = Blueprint("webhooks", __name__)

# Empty TwiML: acknowledges the message without auto-replying. An auto-reply
# would consume the 24h window and confuse the client.
_EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
_TWIML_HEADERS = {"Content-Type": "application/xml"}

# ~10/minute sustained. Real traffic is nowhere near this; a flood is.
_WEBHOOK_LIMIT = "600 per hour"


def _strip_wa(value):
    """'whatsapp:+2250707050154' → '+2250707050154'. Twilio prefixes the channel."""
    v = (value or "").strip()
    return v[9:] if v.startswith("whatsapp:") else v


@webhooks_bp.route("/twilio/inbound", methods=["POST"])
@limiter.limit(_WEBHOOK_LIMIT)
@require_twilio_signature
def twilio_inbound():
    """A client or provider replied in the WhatsApp thread."""
    try:
        form = request.form.to_dict()
        sid = (form.get("MessageSid") or form.get("SmsMessageSid") or "").strip()
        if not sid:
            logger.warning("[whatsapp-in] payload sans MessageSid — ignoré : %s",
                           list(form.keys()))
            return _EMPTY_TWIML, 200, _TWIML_HEADERS

        # Twilio retries on timeout; the same SID must not create a second row.
        if WhatsAppMessage.query.filter_by(message_sid=sid).first():
            logger.info("[whatsapp-in] %s déjà enregistré (retry Twilio) — ignoré", sid)
            return _EMPTY_TWIML, 200, _TWIML_HEADERS

        from_raw = _strip_wa(form.get("From"))
        to_raw = _strip_wa(form.get("To"))
        booking_id, provider_id, matched_role = resolve_phone(from_raw)

        try:
            num_media = int(form.get("NumMedia") or 0)
        except (TypeError, ValueError):
            num_media = 0

        msg = WhatsAppMessage(
            message_sid=sid,
            direction="inbound",
            from_phone_raw=from_raw or None,
            to_phone_raw=to_raw or None,
            from_phone=normalize_phone(from_raw) if from_raw else None,
            to_phone=normalize_phone(to_raw) if to_raw else None,
            body=form.get("Body") or None,
            num_media=num_media,
            status="received",
            booking_id=booking_id,
            provider_id=provider_id,
            matched_role=matched_role,
            raw_payload=json.dumps(form, ensure_ascii=False),
        )
        db.session.add(msg)
        db.session.commit()

        logger.info("[whatsapp-in] %s de %s → rôle=%s réservation=%s%s",
                    sid, from_raw, matched_role, booking_id or "aucune",
                    f" ({num_media} média non téléchargé)" if num_media else "")

    except Exception as exc:  # noqa: BLE001
        # Rolling back and still answering 200 is deliberate: a 500 would make
        # Twilio retry the same broken request every few minutes.
        try:
            db.session.rollback()
        except Exception:  # noqa: BLE001
            pass
        logger.error("[whatsapp-in] message entrant PERDU — %s", exc, exc_info=True)

    return _EMPTY_TWIML, 200, _TWIML_HEADERS


@webhooks_bp.route("/twilio/status", methods=["POST"])
@limiter.limit(_WEBHOOK_LIMIT)
@require_twilio_signature
def twilio_status():
    """Delivery status of a message WE sent (sent/delivered/read/failed).

    Creates the outbound row on first callback and updates it on the next ones,
    keyed on MessageSid. The template key travels in the query string (?k=…)
    because the callback payload doesn't carry it — that keeps notifications.py
    free of any database coupling.
    """
    try:
        form = request.form.to_dict()
        sid = (form.get("MessageSid") or form.get("SmsSid") or "").strip()
        if not sid:
            logger.warning("[whatsapp-status] payload sans MessageSid — ignoré")
            return "", 204

        status = (form.get("MessageStatus") or form.get("SmsStatus") or "").strip() or None
        error_code = (form.get("ErrorCode") or "").strip() or None
        to_raw = _strip_wa(form.get("To"))
        from datetime import datetime

        msg = WhatsAppMessage.query.filter_by(message_sid=sid).first()
        if msg is None:
            # ?b= carries the booking the SENDER knew about. Prefer it over
            # resolve_phone: that resolver is built for inbound traffic and, on a
            # number holding both roles, always returns the provider mission —
            # which attached a message about booking 80 to booking 78. Guessing
            # is the fallback, never the default, and it says so in the log.
            raw_b = (request.args.get("b") or "").strip()
            booking_id = provider_id = matched_role = None
            if raw_b:
                try:
                    booking_id = int(raw_b)
                    provider_id = None
                    matched_role = "outbound"
                except (TypeError, ValueError):
                    logger.warning("[whatsapp-status] ?b=%r illisible pour %s — "
                                   "retour à la résolution par téléphone", raw_b, sid)
            if matched_role is None:
                booking_id, provider_id, matched_role = resolve_phone(to_raw)
                logger.warning(
                    "[whatsapp-status] %s rattaché PAR DEVINETTE (téléphone %s → "
                    "réservation %s, rôle=%s) : aucun ?b= reçu. L'appelant devrait "
                    "transmettre booking_id à l'envoi.",
                    sid, to_raw, booking_id or "aucune", matched_role,
                )
            msg = WhatsAppMessage(
                message_sid=sid,
                direction="outbound",
                from_phone_raw=_strip_wa(form.get("From")) or None,
                to_phone_raw=to_raw or None,
                to_phone=normalize_phone(to_raw) if to_raw else None,
                template_key=(request.args.get("k") or "").strip() or None,
                booking_id=booking_id,
                provider_id=provider_id,
                matched_role=matched_role,
                raw_payload=json.dumps(form, ensure_ascii=False),
            )
            db.session.add(msg)

        if status:
            msg.status = status
        if error_code:
            msg.error_code = error_code
        msg.status_updated_at = datetime.utcnow()
        db.session.commit()

        # A failed send is the whole point of this endpoint: it is what made the
        # provider-mission failure invisible until now. Log it loudly.
        if status in ("failed", "undelivered"):
            logger.error("[whatsapp-status] ÉCHEC d'envoi %s vers %s — statut=%s code=%s "
                         "template=%s", sid, to_raw, status, error_code or "—",
                         msg.template_key or "—")
        else:
            logger.info("[whatsapp-status] %s → %s", sid, status or "—")

    except Exception as exc:  # noqa: BLE001
        try:
            db.session.rollback()
        except Exception:  # noqa: BLE001
            pass
        logger.error("[whatsapp-status] statut non enregistré — %s", exc, exc_info=True)

    return "", 204
