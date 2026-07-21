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


# Single source of truth lives in utils.phone (kept as an alias for callers here).
from shizuverse.utils.phone import normalize_phone as _normalize_phone


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



# ═════════════════════════════════════════════════════════════════════════════
# Bilingual messaging (FR / EN)
# ═════════════════════════════════════════════════════════════════════════════
#
# The CLIENT is addressed in booking.locale ('fr' or 'en').
# The PROVIDER is ALWAYS addressed in French — providers are local and
# francophone. Provider wrappers below take no `locale` argument on purpose,
# so a mission can never go out in English to an Ivorian provider.
#
# All client-facing copy lives in CLIENT_TEMPLATES (and the locale-keyed label
# dicts) — one place to edit, no if/else scattered across the functions.


def _norm_locale(locale) -> str:
    """Graceful degradation: only 'en' is honoured; anything else → 'fr'
    (missing, unknown, or malformed values all fall back to French)."""
    return "en" if str(locale or "").strip().lower().startswith("en") else "fr"


def _fmt_amount(amount) -> str:
    """Space-separated thousands, e.g. 25000 → '25 000'."""
    return f"{int(amount):,}".replace(",", " ")


def _shizu_wa_link() -> str:
    """wa.me link to Shizu support from env. Returns '' when the number is
    unset — an absent link is safer than a wrong number sent to real clients."""
    shizu_wa = os.environ.get("NEXT_PUBLIC_SHIZU_WHATSAPP", "").replace("+", "").strip()
    if not shizu_wa:
        logger.error("NEXT_PUBLIC_SHIZU_WHATSAPP is unset — no Shizu support link available")
        return ""
    return f"wa.me/{shizu_wa}"


# ── Client-facing templates: {message_id: {locale: format_string}} ────────────
CLIENT_TEMPLATES = {
    "booking_created": {
        "fr": ("Bonjour {client_name} ! Votre demande Shizu a été reçue. "
               "Référence: #{booking_ref}. "
               "Nous vous confirmons un prestataire sous 24h. 📋"),
        "en": ("Hello {client_name}! Your Shizu request has been received. "
               "Reference: #{booking_ref}. "
               "We'll confirm a provider within 24h. 📋"),
    },
    "booking_confirmed_client": {
        "fr": ("✅ Bonne nouvelle {client_name} ! Votre réservation #{booking_ref} est confirmée. "
               "Prestataire: {provider_name}. "
               "Date: {date} à {time}. Shizu.pro"),
        "en": ("✅ Good news {client_name}! Your booking #{booking_ref} is confirmed. "
               "Provider: {provider_name}. "
               "Date: {date} at {time}. Shizu.pro"),
    },
    "booking_completed": {
        "fr": ("✅ Mission terminée ! Merci d'avoir choisi Shizu. "
               "Laissez un avis pour {provider_name}: {review_url}. À bientôt !"),
        "en": ("✅ Mission complete! Thank you for choosing Shizu. "
               "Leave a review for {provider_name}: {review_url}. See you soon!"),
    },
    "provider_assigned": {
        "fr": ("🔍 Bonne nouvelle {client_name} ! Un prestataire a été trouvé pour votre mission #{booking_ref}. "
               "{provider_name} interviendra le {date} à {commune}. "
               "Nous vous confirmons les détails sous peu."),
        "en": ("🔍 Good news {client_name}! We've found a provider for your mission #{booking_ref}. "
               "{provider_name} will come on {date} in {commune}. "
               "We'll confirm the details shortly."),
    },
    "provider_started": {
        "fr": ("🔧 {provider_name} a démarré votre mission ! "
               "En cas de problème, contactez Shizu immédiatement: {wa_link}. "
               "Nous restons disponibles pour vous."),
        "en": ("🔧 {provider_name} has started your mission! "
               "If anything goes wrong, contact Shizu right away: {wa_link}. "
               "We're here for you."),
    },
    "booking_cancelled_client": {
        "fr": ("❌ Votre réservation #{booking_ref} a été annulée. "
               "Raison: {reason}. "
               "Pour toute question contactez-nous: {wa_link}"),
        "en": ("❌ Your booking #{booking_ref} has been cancelled. "
               "Reason: {reason}. "
               "For any questions, contact us: {wa_link}"),
    },
    "payment_confirmed": {
        "fr": ("✅ Paiement de {amount} FCFA reçu pour la réservation #{booking_ref}. "
               "Merci {client_name} ! Votre prestataire Shizu est confirmé. "
               "Bonne mission !"),
        "en": ("✅ Payment of {amount} FCFA received for booking #{booking_ref}. "
               "Thank you {client_name}! Your Shizu provider is confirmed. "
               "Enjoy your service!"),
    },
    "booking_rescheduled_client": {
        "fr": ("📅 Votre réservation #{booking_ref} a été reprogrammée. "
               "Nouvelle date : {new_date}{slot_part}. "
               "Une question ? Contactez-nous : {wa_link}"),
        "en": ("📅 Your booking #{booking_ref} has been rescheduled. "
               "New date: {new_date}{slot_part}. "
               "Any question? Contact us: {wa_link}"),
    },
    # "Reason not specified" fallback for cancellations.
    "reason_unspecified": {"fr": "Non précisée", "en": "Not specified"},
}


def _render_client(message_id: str, locale, **kwargs) -> str:
    """Pick the client template for the resolved locale and fill placeholders."""
    loc = _norm_locale(locale)
    return CLIENT_TEMPLATES[message_id][loc].format(**kwargs)


# Human-readable payment-tier labels (payment_rules engine values), per locale.
_TIER_LABELS = {
    "fr": {
        "after_service": "Paiement à la fin de la prestation.",
        "deposit_30":    "Acompte de 30% à la confirmation, solde à la fin.",
        "full_prepay":   "Paiement intégral avant le début de la prestation.",
    },
    "en": {
        "after_service": "Payment once the service is completed.",
        "deposit_30":    "30% deposit on confirmation, balance on completion.",
        "full_prepay":   "Full payment before the service begins.",
    },
}

# Reusable locale-keyed fragments for the (more complex) quote message.
_QUOTE_FRAGMENTS = {
    "fr": {
        "opener": "💳 {client_name}, votre devis Shizu pour la réservation #{booking_ref}{svc_part} est de {amount} FCFA.",
        "link":   "Accepter ou refuser : {url}",
        "mobile_money": "Réglez via Mobile Money ({methods}) puis envoyez la capture à Shizu. Merci !",
        "contact_shizu": "contactez Shizu",
    },
    "en": {
        "opener": "💳 {client_name}, your Shizu quote for booking #{booking_ref}{svc_part} is {amount} FCFA.",
        "link":   "Accept or decline: {url}",
        "mobile_money": "Pay via Mobile Money ({methods}) then send the screenshot to Shizu. Thank you!",
        "contact_shizu": "contact Shizu",
    },
}


# ═════════════════════════════════════════════════════════════════════════════
# CLIENT-facing wrappers — language follows booking.locale
# ═════════════════════════════════════════════════════════════════════════════

def notify_booking_created(*, client_name: str, client_phone: str, booking_ref: str,
                           locale: str = "fr") -> bool:
    msg = _render_client("booking_created", locale,
                         client_name=client_name, booking_ref=booking_ref)
    return send_whatsapp(client_phone, msg)


def notify_booking_confirmed_client(
    *, client_name: str, client_phone: str,
    booking_ref: str, provider_name: str,
    date: str, time: str, locale: str = "fr",
) -> bool:
    msg = _render_client("booking_confirmed_client", locale,
                         client_name=client_name, booking_ref=booking_ref,
                         provider_name=provider_name, date=date, time=time)
    return send_whatsapp(client_phone, msg)


def notify_booking_completed(
    *, client_phone: str, client_name: str,
    provider_name: str, booking_id: int, locale: str = "fr",
) -> bool:
    loc = _norm_locale(locale)
    review_url = f"www.shizu.pro/{loc}/review/{booking_id}"
    msg = _render_client("booking_completed", loc,
                         provider_name=provider_name, review_url=review_url)
    return send_whatsapp(client_phone, msg)


def notify_provider_assigned(
    *, client_name: str, client_phone: str,
    booking_ref: str, provider_name: str,
    date: str, commune: str, locale: str = "fr",
) -> bool:
    """Sent TO THE CLIENT when a provider has been found (despite the name)."""
    msg = _render_client("provider_assigned", locale,
                         client_name=client_name, booking_ref=booking_ref,
                         provider_name=provider_name, date=date, commune=commune)
    return send_whatsapp(client_phone, msg)


def notify_provider_started(
    *, client_name: str, client_phone: str, provider_name: str,
    locale: str = "fr",
) -> bool:
    msg = _render_client("provider_started", locale,
                         provider_name=provider_name, wa_link=_shizu_wa_link())
    return send_whatsapp(client_phone, msg)


def notify_booking_cancelled_client(
    *, client_name: str, client_phone: str,
    booking_ref: str, reason: str, locale: str = "fr",
) -> bool:
    loc = _norm_locale(locale)
    display_reason = reason.strip() or CLIENT_TEMPLATES["reason_unspecified"][loc]
    msg = _render_client("booking_cancelled_client", loc,
                         booking_ref=booking_ref, reason=display_reason,
                         wa_link=_shizu_wa_link())
    return send_whatsapp(client_phone, msg)


def notify_booking_rescheduled_client(
    *, client_name: str, client_phone: str, booking_ref: str,
    new_date: str, new_slot: str = "", locale: str = "fr",
) -> bool:
    """Sent TO THE CLIENT when an admin reschedules the booking (locale-aware)."""
    slot_part = f" ({new_slot})" if new_slot else ""
    msg = _render_client("booking_rescheduled_client", locale,
                         booking_ref=booking_ref, new_date=new_date,
                         slot_part=slot_part, wa_link=_shizu_wa_link())
    return send_whatsapp(client_phone, msg)


def notify_payment_confirmed(
    *, client_name: str, client_phone: str, booking_ref: str, amount: int,
    locale: str = "fr",
) -> bool:
    """Sent when admin records payment as confirmed/paid."""
    msg = _render_client("payment_confirmed", locale,
                         client_name=client_name, booking_ref=booking_ref,
                         amount=_fmt_amount(amount))
    return send_whatsapp(client_phone, msg)


def notify_payment_instructions(
    *, client_name: str, client_phone: str,
    booking_ref: str, amount: int,
    service_name: str = None, payment_tier: str = None, note: str = None,
    quote_token: str = None, locale: str = "fr",
) -> bool:
    """Sent when admin sets a quote. Includes a magic link to accept/decline.
    THE most critical client message — language follows booking.locale."""
    loc = _norm_locale(locale)
    frag = _QUOTE_FRAGMENTS[loc]

    svc_part = f" ({service_name})" if service_name else ""
    parts = [frag["opener"].format(
        client_name=client_name, booking_ref=booking_ref,
        svc_part=svc_part, amount=_fmt_amount(amount),
    )]

    tier_label = _TIER_LABELS[loc].get(payment_tier)
    if tier_label:
        parts.append(tier_label)
    if note and note.strip():
        parts.append(note.strip())

    # Magic link — base URL from env only (never hardcoded); path uses the
    # client's locale so the devis page opens in the right language.
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if quote_token and base:
        url = f"{base}/{loc}/devis/{quote_token}"
        parts.append(frag["link"].format(url=url))
    else:
        wave   = os.environ.get("SHIZU_WAVE_NUMBER", "").strip()
        orange = os.environ.get("SHIZU_ORANGE_NUMBER", "").strip()
        mtn    = os.environ.get("SHIZU_MTN_NUMBER", "").strip()
        methods = [m for m in (
            f"Wave: {wave}" if wave else "",
            f"Orange Money: {orange}" if orange else "",
            f"MTN MoMo: {mtn}" if mtn else "",
        ) if m]
        methods_str = " | ".join(methods) if methods else frag["contact_shizu"]
        parts.append(frag["mobile_money"].format(methods=methods_str))

    return send_whatsapp(client_phone, " ".join(parts))


# ═════════════════════════════════════════════════════════════════════════════
# PROVIDER-facing wrappers — ALWAYS French (providers are local & francophone).
# Do NOT add a `locale` argument to any function below.
# ═════════════════════════════════════════════════════════════════════════════

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


def notify_payment_recorded(
    *, provider_phone: str, booking_ref: str, provider_payout: int,
) -> bool:
    payout_fmt = _fmt_amount(provider_payout)
    msg = (
        f"💰 Paiement enregistré pour la mission #{booking_ref}. "
        f"Montant: {payout_fmt} FCFA. "
        f"Versement en cours de traitement."
    )
    return send_whatsapp(provider_phone, msg)


def notify_payout_sent(*, provider_phone: str, provider_payout: int) -> bool:
    payout_fmt = _fmt_amount(provider_payout)
    msg = (
        f"✅ Votre versement de {payout_fmt} FCFA a été envoyé. "
        f"Merci pour votre travail avec Shizu !"
    )
    return send_whatsapp(provider_phone, msg)


def notify_provider_new_mission(
    *, provider_phone: str, service_name: str,
    date: str, commune: str,
    time_slot: str = None, provider_payout: int = None,
) -> bool:
    """Sent TO THE PROVIDER when a mission is assigned to them.
    Includes their payout (85% of the quote) when the amount is known."""
    when = date + (f" ({time_slot})" if time_slot else "")
    parts = [
        f"🧰 Nouvelle mission Shizu : {service_name} le {when} à {commune}."
    ]
    if provider_payout:
        parts.append(f"Votre rémunération : {_fmt_amount(provider_payout)} FCFA.")
    parts.append("Confirmez votre disponibilité auprès de Shizu.")
    return send_whatsapp(provider_phone, " ".join(parts))


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


def notify_booking_rescheduled_provider(
    *, provider_phone: str, booking_ref: str, new_date: str, new_slot: str = "",
) -> bool:
    """Sent TO THE PROVIDER (always FR) when a mission is rescheduled."""
    slot_part = f" ({new_slot})" if new_slot else ""
    msg = (
        f"📅 La mission #{booking_ref} a été reprogrammée. "
        f"Nouvelle date : {new_date}{slot_part}. "
        f"Merci de noter le changement."
    )
    return send_whatsapp(provider_phone, msg)


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
