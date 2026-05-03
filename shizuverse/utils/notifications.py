"""
WhatsApp notification utility (feature-flagged via env vars).

To activate: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
Until then every call logs the would-be message and returns False — the main
operation is NEVER affected by notification failures.
"""
import os
import logging

logger = logging.getLogger(__name__)


def is_twilio_enabled() -> bool:
    """Return True only when all three Twilio env vars are present and non-empty."""
    return all([
        os.environ.get("TWILIO_ACCOUNT_SID"),
        os.environ.get("TWILIO_AUTH_TOKEN"),
        os.environ.get("TWILIO_WHATSAPP_FROM"),
    ])


def _normalize_phone(phone: str) -> str:
    """Best-effort E.164 normalization for CI numbers."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("00225"):
        return "+" + p[2:]
    if p.startswith("+"):
        return p
    if p.startswith("225") and len(p) >= 12:
        return "+" + p
    if p.startswith("0") and len(p) == 10:
        return "+225" + p[1:]
    return p


def send_whatsapp(to_phone: str, message: str) -> bool:
    """
    Send a WhatsApp message via Twilio.

    Returns True on success, False on any failure or when Twilio is not
    configured.  Never raises — notification failure must not break the
    caller's main operation.
    """
    if not to_phone or not to_phone.strip():
        logger.warning("WHATSAPP: empty phone — skipped")
        return False

    normalized = _normalize_phone(to_phone.strip())

    if not is_twilio_enabled():
        logger.info(
            "TWILIO NOT CONFIGURED — would send to %s: %s",
            normalized,
            message,
        )
        return False

    try:
        from twilio.rest import Client  # imported lazily so app starts without twilio installed

        client = Client(
            os.environ["TWILIO_ACCOUNT_SID"],
            os.environ["TWILIO_AUTH_TOKEN"],
        )
        from_wa = os.environ["TWILIO_WHATSAPP_FROM"]  # e.g. "whatsapp:+14155238886"
        to_wa = f"whatsapp:{normalized}"

        msg = client.messages.create(body=message, from_=from_wa, to=to_wa)
        logger.info("WHATSAPP sent to %s — SID %s", normalized, msg.sid)
        return True

    except Exception as exc:  # noqa: BLE001
        logger.error("WHATSAPP send failed to %s: %s", normalized, exc)
        return False


# ── Convenience wrappers (all keyword-argument-only for safety) ───────────────

def notify_booking_created(*, client_name: str, client_phone: str, booking_ref: str) -> bool:
    msg = (
        f"Bonjour {client_name} ! Votre demande Shizu a été reçue. "
        f"Référence: #{booking_ref}. "
        f"Nous vous confirmons un prestataire sous 24h. 📋"
    )
    return send_whatsapp(client_phone, msg)


def notify_booking_confirmed_client(
    *, client_name: str, client_phone: str,
    booking_ref: str, provider_name: str,
    date: str, time: str,
) -> bool:
    msg = (
        f"✅ Bonne nouvelle {client_name} ! Votre réservation #{booking_ref} est confirmée. "
        f"Prestataire: {provider_name}. "
        f"Date: {date} à {time}. Shizu.pro"
    )
    return send_whatsapp(client_phone, msg)


def notify_booking_confirmed_provider(
    *, provider_phone: str, client_name: str,
    service: str, date: str, time: str, commune: str,
) -> bool:
    msg = (
        f"🔔 Nouvelle mission confirmée ! "
        f"Client: {client_name}. Service: {service}. "
        f"Date: {date} à {time}. Commune: {commune}. "
        f"Contactez le client si besoin."
    )
    return send_whatsapp(provider_phone, msg)


def notify_provider_approved(*, provider_phone: str) -> bool:
    msg = (
        "🎉 Félicitations ! Votre profil Shizu a été approuvé. "
        "Vous pouvez maintenant recevoir des demandes. "
        "Connectez-vous: www.shizu.pro/fr/provider"
    )
    return send_whatsapp(provider_phone, msg)


def notify_provider_rejected(*, provider_phone: str, reason: str) -> bool:
    msg = (
        f"Bonjour, votre profil Shizu n'a pas pu être validé pour la raison suivante: {reason}. "
        f"Vous pouvez modifier votre profil et soumettre à nouveau: "
        f"www.shizu.pro/fr/provider/profile"
    )
    return send_whatsapp(provider_phone, msg)


def notify_booking_completed(
    *, client_phone: str, client_name: str,
    provider_name: str, booking_id: int,
) -> bool:
    msg = (
        f"✅ Mission terminée ! Merci d'avoir choisi Shizu. "
        f"Laissez un avis pour {provider_name}: "
        f"www.shizu.pro/fr/review/{booking_id}. À bientôt !"
    )
    return send_whatsapp(client_phone, msg)


def notify_payment_recorded(
    *, provider_phone: str, booking_ref: str, provider_payout: int,
) -> bool:
    payout_fmt = f"{provider_payout:,}".replace(",", " ")
    msg = (
        f"💰 Paiement enregistré pour la mission #{booking_ref}. "
        f"Montant: {payout_fmt} FCFA. "
        f"Versement en cours de traitement."
    )
    return send_whatsapp(provider_phone, msg)


def notify_payout_sent(*, provider_phone: str, provider_payout: int) -> bool:
    payout_fmt = f"{provider_payout:,}".replace(",", " ")
    msg = (
        f"✅ Votre versement de {payout_fmt} FCFA a été envoyé. "
        f"Merci pour votre travail avec Shizu !"
    )
    return send_whatsapp(provider_phone, msg)
