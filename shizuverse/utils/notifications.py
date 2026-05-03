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


def notify_provider_assigned(
    *, client_name: str, client_phone: str,
    booking_ref: str, provider_name: str,
    date: str, commune: str,
) -> bool:
    msg = (
        f"🔍 Bonne nouvelle {client_name} ! Un prestataire a été trouvé pour votre mission #{booking_ref}. "
        f"{provider_name} interviendra le {date} à {commune}. "
        f"Nous vous confirmons les détails sous peu."
    )
    return send_whatsapp(client_phone, msg)


def notify_provider_started(
    *, client_name: str, client_phone: str, provider_name: str,
) -> bool:
    shizu_wa = os.environ.get("NEXT_PUBLIC_SHIZU_WHATSAPP", "").replace("+", "").strip()
    wa_link = f"wa.me/{shizu_wa}" if shizu_wa else "wa.me/2250700000000"
    msg = (
        f"🔧 {provider_name} a démarré votre mission ! "
        f"En cas de problème, contactez Shizu immédiatement: {wa_link}. "
        f"Nous restons disponibles pour vous."
    )
    return send_whatsapp(client_phone, msg)


def notify_review_received(
    *, provider_phone: str, client_name: str,
    rating: int, comment_preview: str,
) -> bool:
    preview = comment_preview[:80].rstrip() + ("…" if len(comment_preview) > 80 else "")
    msg = (
        f"⭐ Nouvel avis ! {client_name} vous a donné {rating}/5 : '{preview}'. "
        f"Merci pour votre excellent travail avec Shizu !"
    )
    return send_whatsapp(provider_phone, msg)


def notify_booking_cancelled_client(
    *, client_name: str, client_phone: str,
    booking_ref: str, reason: str,
) -> bool:
    shizu_wa = os.environ.get("NEXT_PUBLIC_SHIZU_WHATSAPP", "").replace("+", "").strip()
    wa_link = f"wa.me/{shizu_wa}" if shizu_wa else "wa.me/2250700000000"
    display_reason = reason.strip() or "Non précisée"
    msg = (
        f"❌ Votre réservation #{booking_ref} a été annulée. "
        f"Raison: {display_reason}. "
        f"Pour toute question contactez-nous: {wa_link}"
    )
    return send_whatsapp(client_phone, msg)


def notify_booking_cancelled_provider(
    *, provider_phone: str, booking_ref: str, date: str,
) -> bool:
    msg = (
        f"❌ La mission #{booking_ref} du {date} a été annulée par le client. "
        f"Votre tableau de bord a été mis à jour: www.shizu.pro/fr/provider"
    )
    return send_whatsapp(provider_phone, msg)


def notify_registration_submitted(*, provider_name: str, provider_phone: str) -> bool:
    msg = (
        f"👋 Bonjour {provider_name} ! Nous avons bien reçu votre candidature Shizu. "
        f"Notre équipe vérifie votre profil sous 48h et vous contactera sur ce numéro. "
        f"En attendant, complétez votre profil: www.shizu.pro/fr/provider/profile"
    )
    return send_whatsapp(provider_phone, msg)


def notify_payment_instructions(
    *, client_name: str, client_phone: str,
    booking_ref: str, amount: int,
) -> bool:
    """Sent when admin sets a quote and requests payment from the client."""
    amt_fmt = f"{amount:,}".replace(",", " ")
    wave   = os.environ.get("SHIZU_WAVE_NUMBER", "").strip()
    orange = os.environ.get("SHIZU_ORANGE_NUMBER", "").strip()
    mtn    = os.environ.get("SHIZU_MTN_NUMBER", "").strip()
    methods = []
    if wave:   methods.append(f"Wave: {wave}")
    if orange: methods.append(f"Orange Money: {orange}")
    if mtn:    methods.append(f"MTN MoMo: {mtn}")
    methods_str = " | ".join(methods) if methods else "contactez Shizu"
    msg = (
        f"💳 {client_name}, votre devis pour la réservation #{booking_ref} est de {amt_fmt} FCFA. "
        f"Réglez via Mobile Money ({methods_str}) puis envoyez la capture à Shizu. "
        f"Merci !"
    )
    return send_whatsapp(client_phone, msg)


def notify_payment_confirmed(
    *, client_name: str, client_phone: str, booking_ref: str, amount: int,
) -> bool:
    """Sent when admin records payment as confirmed/paid."""
    amt_fmt = f"{amount:,}".replace(",", " ")
    msg = (
        f"✅ Paiement de {amt_fmt} FCFA reçu pour la réservation #{booking_ref}. "
        f"Merci {client_name} ! Votre prestataire Shizu est confirmé. "
        f"Bonne mission !"
    )
    return send_whatsapp(client_phone, msg)


def notify_new_booking_request(
    *, provider_phone: str, service_type: str,
    commune: str, date: str, time_preference: str,
) -> bool:
    pref_map = {
        "morning": "matin 8h–12h",
        "afternoon": "après-midi 12h–17h",
        "evening": "soirée 17h–20h",
        "anytime": "flexible",
    }
    pref_label = pref_map.get(time_preference, time_preference or "flexible")
    msg = (
        f"🔔 Nouvelle demande ! {service_type} à {commune} le {date} ({pref_label}). "
        f"Connectez-vous pour accepter: www.shizu.pro/fr/provider"
    )
    return send_whatsapp(provider_phone, msg)
