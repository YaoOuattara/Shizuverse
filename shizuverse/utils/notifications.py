"""
WhatsApp notification utility (feature-flagged via env vars).

To activate: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
Until then every call logs the would-be message and returns False — the main
operation is NEVER affected by notification failures.
"""
import os
import json
import logging

logger = logging.getLogger(__name__)


def _load_template_sids() -> dict:
    """Parse the WHATSAPP_TEMPLATE_SIDS registry ({template_key: 'HX...'}) once,
    at module load. A missing var yields an empty registry; malformed JSON logs
    a clear error and yields an empty registry — it must NEVER crash the boot.
    No SID is ever hardcoded."""
    raw = os.environ.get("WHATSAPP_TEMPLATE_SIDS", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError) as exc:
        logger.error("WHATSAPP_TEMPLATE_SIDS is not valid JSON — no templates "
                     "loaded (all template sends will fail): %s", exc)
        return {}
    if not isinstance(parsed, dict):
        logger.error("WHATSAPP_TEMPLATE_SIDS must be a JSON object "
                     "{template_key: SID} — got %s; no templates loaded.",
                     type(parsed).__name__)
        return {}
    return parsed


# Registry of approved Meta templates → Twilio Content SIDs. Parsed once.
_TEMPLATE_SIDS = _load_template_sids()


def is_twilio_enabled() -> bool:
    """Return True only when all three Twilio env vars are present and non-empty."""
    return all([
        os.environ.get("TWILIO_ACCOUNT_SID"),
        os.environ.get("TWILIO_AUTH_TOKEN"),
        os.environ.get("TWILIO_WHATSAPP_FROM"),
    ])


def _status_callback_kwargs(template_key: str = None, *, booking_id=None) -> dict:
    """Twilio delivery-status callback, OPT-IN via TWILIO_STATUS_CALLBACK_URL.

    Returns {} when the variable is unset, so messages.create() is called with
    exactly the arguments it received before this existed — sending behaviour
    is strictly unchanged until the URL is configured.

    Two things ride in the query string because Twilio's status payload carries
    neither, and because putting them here keeps this module free of any
    database import:
      ?k=  the template key (the callback never reports which template was used)
      &b=  the booking id. This one is a CORRECTION: the webhook used to resolve
           the outbound row's booking from the recipient's phone, but that
           resolver is built for INBOUND traffic and always prefers the provider
           mission when a number holds both roles — so a message about booking
           80 could land on booking 78. On the way out we already know the
           booking; there is no reason to guess it on the way back.
    """
    url = os.environ.get("TWILIO_STATUS_CALLBACK_URL", "").strip()
    if not url:
        return {}
    from urllib.parse import quote
    if template_key:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}k={quote(template_key)}"
    if booking_id is not None:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}b={quote(str(booking_id))}"
    return {"status_callback": url}


# Single source of truth lives in utils.phone (kept as an alias for callers here).
from shizuverse.utils.phone import normalize_phone as _normalize_phone
# Payment-tier thresholds live in payment_rules — never re-implement them here.
from shizuverse.utils.payment_rules import get_payment_tier as _get_payment_tier


def send_whatsapp(to_phone: str, message: str, *, booking_id=None) -> bool:
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

        msg = client.messages.create(body=message, from_=from_wa, to=to_wa,
                                     **_status_callback_kwargs(booking_id=booking_id))
        logger.info("WHATSAPP sent to %s — SID %s", normalized, msg.sid)
        return True

    except Exception as exc:  # noqa: BLE001
        logger.error("WHATSAPP send failed to %s: %s", normalized, exc)
        return False


def send_whatsapp_template(to_phone: str, template_key: str, variables: dict,
                           log_body: str = None, *, booking_id=None) -> bool:
    """Send an approved WhatsApp *template* (business-initiated) via Twilio.

    Free-form send_whatsapp is only allowed inside the 24h customer-service
    window; every one of our wrappers is business-initiated, so once the WABA
    is live only templates go through. The template is referenced by its Twilio
    Content SID, looked up from the WHATSAPP_TEMPLATE_SIDS registry.

    `variables` are POSITIONAL: keys "1", "2", "3"… mapped to the {{1}}, {{2}}…
    placeholders of the approved template, values must be non-empty strings.

    `log_body` (optional) is the realigned approved text rendered by the wrapper.
    It is used ONLY for the "Twilio not configured" log so it reflects what would
    really be sent; it never reaches Twilio (the SID owns the real text).

    Returns True on success, False on any failure (unregistered template, empty
    variable, Twilio not configured, send error). Never raises — notification
    failure must not break the caller's main operation. Never silently falls
    back to free-form send_whatsapp.
    """
    if not to_phone or not to_phone.strip():
        logger.warning("WHATSAPP TEMPLATE '%s': empty phone — skipped", template_key)
        return False

    content_sid = _TEMPLATE_SIDS.get(template_key)
    if not content_sid:
        logger.error("WHATSAPP TEMPLATE: no SID registered for '%s' — not sent. "
                     "Check WHATSAPP_TEMPLATE_SIDS.", template_key)
        return False

    # A single empty/None variable makes Meta reject the whole send — refuse it
    # here rather than let Twilio fail, and never send a partial template.
    for pos, value in (variables or {}).items():
        if value is None or str(value).strip() == "":
            logger.error("WHATSAPP TEMPLATE '%s': variable %r is empty/None — "
                         "not sent.", template_key, pos)
            return False

    normalized = _normalize_phone(to_phone.strip())

    if not is_twilio_enabled():
        logger.info(
            "TWILIO NOT CONFIGURED — would send template '%s' (SID %s) to %s: %s",
            template_key, content_sid, normalized, log_body if log_body else variables,
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

        msg = client.messages.create(
            content_sid=content_sid,
            content_variables=json.dumps(variables),
            from_=from_wa,
            to=to_wa,
            **_status_callback_kwargs(template_key, booking_id=booking_id),
        )
        logger.info("WHATSAPP TEMPLATE '%s' sent to %s — SID %s",
                    template_key, normalized, msg.sid)
        return True

    except Exception as exc:  # noqa: BLE001
        logger.error("WHATSAPP TEMPLATE '%s' send failed to %s: %s",
                     template_key, normalized, exc)
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


def _slot_fallback(locale) -> str:
    """Label used when a reschedule carries no time slot.

    Reads the EXISTING slot vocabulary instead of hardcoding a string: an empty
    {{n}} would make Meta reject the whole send, and a literal "Flexible" here
    would be a second definition of a label that already lives in _SLOT_LABELS —
    it would drift the day the wording changes. Same reason the phone
    normalization and the pricing thresholds each have exactly one home.

    Imported lazily on purpose: routes.admin imports THIS module lazily inside
    its handlers, so a module-level import here would turn a latent cycle into a
    real one.
    """
    loc = _norm_locale(locale)
    from shizuverse.routes.admin import _SLOT_LABELS
    return _SLOT_LABELS["anytime"][loc]


def _shizu_wa_link() -> str:
    """wa.me link to Shizu support from env. Returns '' when the number is
    unset — an absent link is safer than a wrong number sent to real clients."""
    shizu_wa = os.environ.get("NEXT_PUBLIC_SHIZU_WHATSAPP", "").replace("+", "").strip()
    if not shizu_wa:
        logger.error("NEXT_PUBLIC_SHIZU_WHATSAPP is unset — no Shizu support link available")
        return ""
    return f"wa.me/{shizu_wa}"


# ── Client-facing templates: {message_id: {locale: format_string}} ────────────
# These no longer drive the send (the Twilio Content SID owns the real text);
# they are realigned word-for-word to the approved Meta templates so the
# "Twilio not configured" logs reflect exactly what would go out. No emoji —
# the approved texts carry none.
CLIENT_TEMPLATES = {
    # Copied verbatim from the text actually received in production.
    "booking_created": {
        "fr": ("Bonjour {client_name}, votre demande Shizu a bien été reçue. "
               "Référence : {booking_ref}. Le délai de confirmation de votre "
               "prestataire n'excédera pas deux heures."),
        "en": ("Hello {client_name}, your Shizu request has been received. "
               "Reference: {booking_ref}. Your provider will be confirmed "
               "within two hours at most."),
    },
    "booking_confirmed_client": {
        "fr": ("Bonjour {client_name}, votre réservation {booking_ref} est "
               "confirmée. Prestataire : {provider_name}. Date : {date} à {time}. "
               "Le prestataire vous contactera avant son arrivée."),
        "en": ("Hello {client_name}, your booking {booking_ref} is confirmed. "
               "Provider: {provider_name}. Date: {date} at {time}. The provider "
               "will contact you before arriving."),
    },
    "booking_completed": {
        "fr": ("Bonjour, votre mission Shizu avec {provider_name} est terminée. "
               "Votre avis nous aide à maintenir la qualité du service."),
        "en": ("Hello, your Shizu mission with {provider_name} is complete. "
               "Your feedback helps us maintain service quality."),
    },
    "provider_assigned": {
        "fr": ("Bonjour {client_name}, un prestataire a été trouvé pour votre "
               "réservation {booking_ref}. {provider_name} interviendra le {date} "
               "à {commune}. Vous recevrez la confirmation dès qu'il aura validé "
               "le créneau."),
        "en": ("Hello {client_name}, a provider has been found for your booking "
               "{booking_ref}. {provider_name} will come on {date} in {commune}. "
               "You will receive confirmation once they validate the time slot."),
    },
    "payment_confirmed": {
        "fr": ("Bonjour {client_name}, nous avons reçu votre paiement de {amount} "
               "FCFA pour la réservation {booking_ref}. Votre prestation est "
               "confirmée."),
        "en": ("Hello {client_name}, we have received your payment of {amount} "
               "FCFA for booking {booking_ref}. Your service is confirmed."),
    },
    "payment_instructions": {
        "fr": ("Bonjour {client_name}, votre devis Shizu pour la réservation "
               "{booking_ref} s'élève à {amount} FCFA. {tier_label} Vous pouvez "
               "l'accepter ou le refuser depuis le lien ci-dessous."),
        "en": ("Hello {client_name}, your Shizu quote for booking {booking_ref} "
               "is {amount} FCFA. {tier_label} You can accept or decline it using "
               "the link below."),
    },
    # ── Still free-form (send_whatsapp) until their templates ship — emoji
    #    removed for consistency, wording otherwise unchanged. ──
    "provider_started": {
        "fr": ("{provider_name} a démarré votre mission. "
               "En cas de problème, contactez Shizu immédiatement : {wa_link}. "
               "Nous restons disponibles pour vous."),
        "en": ("{provider_name} has started your mission. "
               "If anything goes wrong, contact Shizu right away: {wa_link}. "
               "We're here for you."),
    },
    "booking_cancelled_client": {
        "fr": ("Votre réservation {booking_ref} a été annulée. "
               "Raison : {reason}. "
               "Pour toute question contactez-nous : {wa_link}"),
        "en": ("Your booking {booking_ref} has been cancelled. "
               "Reason: {reason}. "
               "For any questions, contact us: {wa_link}"),
    },
    "booking_rescheduled_client": {
        "fr": ("Votre réservation {booking_ref} a été reprogrammée. "
               "Nouvelle date : {new_date}{slot_part}. "
               "Une question ? Contactez-nous : {wa_link}"),
        "en": ("Your booking {booking_ref} has been rescheduled. "
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

# ═════════════════════════════════════════════════════════════════════════════
# CLIENT-facing wrappers — language follows booking.locale
# ═════════════════════════════════════════════════════════════════════════════

def notify_booking_created(*, client_name: str, client_phone: str, booking_ref: str,
                           locale: str = "fr", booking_id: int = None) -> bool:
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": booking_ref}
    body = _render_client("booking_created", loc,
                          client_name=client_name, booking_ref=booking_ref)
    return send_whatsapp_template(client_phone, f"shizu_booking_created_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_booking_confirmed_client(
    *, client_name: str, client_phone: str,
    booking_ref: str, provider_name: str,
    date: str, time: str, locale: str = "fr", booking_id: int = None,
) -> bool:
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": booking_ref, "3": provider_name,
                 "4": date, "5": time}
    body = _render_client("booking_confirmed_client", loc,
                          client_name=client_name, booking_ref=booking_ref,
                          provider_name=provider_name, date=date, time=time)
    return send_whatsapp_template(client_phone, f"shizu_booking_confirmed_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_booking_completed(
    *, client_phone: str, client_name: str,
    provider_name: str, booking_id: int, locale: str = "fr",
) -> bool:
    loc = _norm_locale(locale)
    # {{2}} is the review button's URL variable — the bare booking_id; the SID
    # carries the https://…/{loc}/review/ prefix.
    variables = {"1": provider_name, "2": str(booking_id)}
    body = _render_client("booking_completed", loc, provider_name=provider_name)
    return send_whatsapp_template(client_phone, f"shizu_booking_completed_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_provider_assigned(
    *, client_name: str, client_phone: str,
    booking_ref: str, provider_name: str,
    date: str, commune: str, locale: str = "fr", booking_id: int = None,
) -> bool:
    """Sent TO THE CLIENT when a provider has been found (despite the name)."""
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": booking_ref, "3": provider_name,
                 "4": date, "5": commune}
    body = _render_client("provider_assigned", loc,
                          client_name=client_name, booking_ref=booking_ref,
                          provider_name=provider_name, date=date, commune=commune)
    return send_whatsapp_template(client_phone, f"shizu_provider_assigned_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_provider_started(
    *, client_name: str, client_phone: str, provider_name: str,
    locale: str = "fr", booking_id: int = None,
) -> bool:
    """Sent TO THE CLIENT when the provider arrives on site.

    Approved template positions: {{1}} client name, {{2}} provider name.
    """
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": provider_name}
    # log_body only — CLIENT_TEMPLATES still holds the pre-template wording (the
    # approved v2 text was not provided); the Content SID owns what really goes out.
    body = _render_client("provider_started", loc,
                          provider_name=provider_name, wa_link=_shizu_wa_link())
    return send_whatsapp_template(client_phone, f"shizu_provider_started_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_booking_cancelled_client(
    *, client_name: str, client_phone: str,
    booking_ref: str, reason: str = "", locale: str = "fr", booking_id: int = None,
) -> bool:
    """Sent TO THE CLIENT when a booking is cancelled.

    Approved template positions: {{1}} client name, {{2}} booking ref.
    `reason` has NO slot in the approved template and is deliberately not sent
    (accepted loss — the motive stays visible in the admin dashboard). Kept in
    the signature so callers don't have to change.
    """
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": booking_ref}
    display_reason = (reason or "").strip() or CLIENT_TEMPLATES["reason_unspecified"][loc]
    body = _render_client("booking_cancelled_client", loc,
                          booking_ref=booking_ref, reason=display_reason,
                          wa_link=_shizu_wa_link())
    return send_whatsapp_template(client_phone, f"shizu_booking_cancelled_client_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_booking_rescheduled_client(
    *, client_name: str, client_phone: str, booking_ref: str,
    new_date: str, new_slot: str = "", locale: str = "fr", booking_id: int = None,
) -> bool:
    """Sent TO THE CLIENT when an admin reschedules the booking (locale-aware).

    Approved template positions: {{1}} client name, {{2}} booking ref,
    {{3}} long date, {{4}} time slot.

    An empty {{4}} would make send_whatsapp_template refuse the whole send (Meta
    rejects empty variables), so a missing slot falls back to the existing
    'anytime' label, read from _SLOT_LABELS in the client's locale.
    """
    loc = _norm_locale(locale)
    slot = (new_slot or "").strip() or _slot_fallback(loc)
    variables = {"1": client_name, "2": booking_ref, "3": new_date, "4": slot}
    body = _render_client("booking_rescheduled_client", loc,
                          booking_ref=booking_ref, new_date=new_date,
                          slot_part=f" ({slot})", wa_link=_shizu_wa_link())
    return send_whatsapp_template(client_phone, f"shizu_booking_rescheduled_client_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_payment_confirmed(
    *, client_name: str, client_phone: str, booking_ref: str, amount: int,
    locale: str = "fr", booking_id: int = None,
) -> bool:
    """Sent when admin records payment as confirmed/paid.
    NB: approved order is {{1}} name, {{2}} amount, {{3}} ref — amount BEFORE ref."""
    loc = _norm_locale(locale)
    amount_fmt = _fmt_amount(amount)
    variables = {"1": client_name, "2": amount_fmt, "3": booking_ref}
    body = _render_client("payment_confirmed", loc,
                          client_name=client_name, booking_ref=booking_ref,
                          amount=amount_fmt)
    return send_whatsapp_template(client_phone, f"shizu_payment_confirmed_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_deposit_received(
    *, client_name: str, client_phone: str, booking_ref: str,
    amount: int, amount_due: int, locale: str = "fr", booking_id: int = None,
) -> bool:
    """Sent when a PARTIAL payment (deposit) is recorded — distinct from
    notify_payment_confirmed. Announcing "payment received, service confirmed"
    on a partial deposit would be a button that lies (decision D).

    TODO: awaiting the approved Meta template text/SID (shizu_deposit_received_{loc}).
    Until it's registered, send_whatsapp_template logs and returns False safely.
    Positional variables: {1} name, {2} booking_ref, {3} amount received,
    {4} remaining balance."""
    loc = _norm_locale(locale)
    amount_fmt = _fmt_amount(amount)
    due_fmt = _fmt_amount(amount_due)
    variables = {"1": client_name, "2": booking_ref, "3": amount_fmt, "4": due_fmt}
    # Provisional log body until the approved wording is provided.
    body = (
        f"Bonjour {client_name}, nous avons reçu votre acompte de {amount_fmt} FCFA "
        f"pour la réservation {booking_ref}. Solde restant : {due_fmt} FCFA."
        if loc == "fr" else
        f"Hello {client_name}, we have received your deposit of {amount_fmt} FCFA "
        f"for booking {booking_ref}. Remaining balance: {due_fmt} FCFA."
    )
    return send_whatsapp_template(client_phone, f"shizu_deposit_received_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_payment_instructions(
    *, client_name: str, client_phone: str,
    booking_ref: str, amount: int,
    service_name: str = None, payment_tier: str = None, note: str = None,
    quote_token: str = None, locale: str = "fr", booking_id: int = None,
) -> bool:
    """Sent when admin sets a quote — THE most critical client message.
    Goes out as the approved template shizu_devis_{loc}; the accept/decline link
    is the template's URL button, filled from quote_token ({{5}}).

    Note: `service_name` and `note` have no slot in the approved template and are
    intentionally not sent (kept only for signature compatibility)."""
    loc = _norm_locale(locale)

    # The devis is worthless without its accept/decline link. That link is the
    # template's URL button, built from quote_token alone (the SID already
    # carries the https://…/{loc}/devis/ prefix — FRONTEND_URL is no longer
    # used). No quote_token → do not send; never degrade to a Mobile-Money
    # fallback or any other message.
    if not quote_token:
        logger.error("notify_payment_instructions: booking %s has no quote_token "
                     "— devis not sent (no accept/decline link).", booking_ref)
        return False

    # A payment tier must always be shown ({{4}}); derive it from the amount
    # when the caller didn't pass one (canonical thresholds, never re-implemented).
    if not payment_tier:
        payment_tier = _get_payment_tier(amount)
    tier_label = _TIER_LABELS[loc].get(payment_tier, "")

    amount_fmt = _fmt_amount(amount)
    variables = {
        "1": client_name,
        "2": booking_ref,
        "3": amount_fmt,
        "4": tier_label,
        "5": quote_token,   # URL-button variable, not shown in the body
    }
    body = _render_client("payment_instructions", loc,
                          client_name=client_name, booking_ref=booking_ref,
                          amount=amount_fmt, tier_label=tier_label)
    return send_whatsapp_template(client_phone, f"shizu_devis_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


# ── Dispute wrappers, CLIENT side ────────────────────────────────────────────
# All three carry the same two positions: {{1}} client name, {{2}} booking ref.
# No amount and no reason: the approved templates have no slot for them, and a
# dispute message is a "we are handling it" signal, not a statement of account.
# log_body is our own wording — the approved v2 texts were not supplied, and the
# Content SID owns what actually goes out.

def notify_dispute_opened_client(
    *, client_name: str, client_phone: str, booking_ref: str,
    locale: str = "fr", booking_id: int = None,
) -> bool:
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": booking_ref}
    body = (
        f"Bonjour {client_name}, votre réservation {booking_ref} fait l'objet "
        f"d'un examen par notre équipe. Nous vous contactons rapidement pour "
        f"faire le point avec vous."
        if loc == "fr" else
        f"Hello {client_name}, your booking {booking_ref} is being reviewed by "
        f"our team. We will contact you shortly to go through it with you."
    )
    return send_whatsapp_template(client_phone, f"shizu_dispute_opened_client_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_dispute_refund_client(
    *, client_name: str, client_phone: str, booking_ref: str,
    locale: str = "fr", booking_id: int = None,
) -> bool:
    """Resolution 'refund_client' — the client is refunded."""
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": booking_ref}
    body = (
        f"Bonjour {client_name}, l'examen de votre réservation {booking_ref} est "
        f"terminé. Un remboursement a été décidé. Notre équipe vous contacte "
        f"pour le détail et le délai."
        if loc == "fr" else
        f"Hello {client_name}, the review of your booking {booking_ref} is "
        f"complete. A refund has been decided. Our team will contact you with "
        f"the details and timing."
    )
    return send_whatsapp_template(client_phone, f"shizu_dispute_refund_client_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


def notify_dispute_closed_client(
    *, client_name: str, client_phone: str, booking_ref: str,
    locale: str = "fr", booking_id: int = None,
) -> bool:
    """Resolution 'release_provider' — closed WITHOUT a refund for the client."""
    loc = _norm_locale(locale)
    variables = {"1": client_name, "2": booking_ref}
    body = (
        f"Bonjour {client_name}, l'examen de votre réservation {booking_ref} est "
        f"terminé et le dossier est clôturé. Pour toute question, notre équipe "
        f"reste disponible."
        if loc == "fr" else
        f"Hello {client_name}, the review of your booking {booking_ref} is "
        f"complete and the case is closed. Our team remains available for any "
        f"question."
    )
    return send_whatsapp_template(client_phone, f"shizu_dispute_closed_client_{loc}",
                                  variables, log_body=body, booking_id=booking_id)


# ═════════════════════════════════════════════════════════════════════════════
# PROVIDER-facing wrappers — ALWAYS French (providers are local & francophone).
# Do NOT add a `locale` argument to any function below.
# ═════════════════════════════════════════════════════════════════════════════

def notify_booking_confirmed_provider(
    *, provider_phone: str, booking_ref: str, client_name: str,
    service: str, date: str, time: str, commune: str, booking_id: int = None,
) -> bool:
    variables = {"1": booking_ref, "2": client_name, "3": service,
                 "4": date, "5": time, "6": commune}
    body = (
        f"Mission Shizu {booking_ref} confirmée. Client : {client_name}. "
        f"Service : {service}. Date : {date} à {time}. Commune : {commune}. "
        f"Les coordonnées du client sont disponibles dans votre tableau de bord."
    )
    return send_whatsapp_template(provider_phone,
                                  "shizu_provider_booking_confirmed_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_provider_approved(
    *, provider_phone: str, provider_name: str, approved_date: str,
) -> bool:
    """The approved template carries NO variable — its text is fully static.

    The code used to send {{1}} name and {{2}} date to a zero-placeholder
    template, a mismatch Twilio either ignores or rejects with 63028. Aligned on
    the template: nothing is sent. The provider loses nothing (neither the name
    nor the date appeared in the approved text). `provider_name` and
    `approved_date` are kept in the signature — callers are unchanged and both
    still feed the log body — until a re-personalised template ships.
    """
    variables = {}
    body = (
        f"Bonjour {provider_name}, votre profil prestataire Shizu a été approuvé "
        f"le {approved_date}. Vous pouvez désormais recevoir des demandes de "
        f"mission. Votre tableau de bord vous permet de suivre vos demandes, de "
        f"les accepter ou de les refuser, et de consulter votre carte prestataire."
    )
    return send_whatsapp_template(provider_phone, "shizu_provider_approved_fr",
                                  variables, log_body=body)


def notify_provider_rejected(*, provider_phone: str, reason: str) -> bool:
    """DELIBERATELY still free-form — do NOT migrate to a template.

    shizu_provider_rejected_fr exists in the registry but carries only {{1}} the
    provider name: it has no slot for the rejection reason. That reason is
    produced by the "smart rejection" AI feature (locked decision), and it is
    the whole point of the message — a provider must learn WHY so they can fix
    their profile and resubmit. Switching to the template would silently destroy
    that feature. Revisit only once a template with a reason slot is approved.
    """
    msg = (
        f"Bonjour, votre profil Shizu n'a pas pu être validé pour la raison suivante: {reason}. "
        f"Vous pouvez modifier votre profil et soumettre à nouveau: "
        f"www.shizu.pro/fr/provider/profile"
    )
    return send_whatsapp(provider_phone, msg)


def notify_payout_sent(
    *, provider_phone: str, provider_payout: int,
    payout_date: str, booking_id: int = None,
) -> bool:
    """Approved template positions: {{1}} amount, {{2}} date.

    The template carries NO booking reference — the provider is told an amount
    was sent, not which mission it settles. `payout_date` is the moment the admin
    marked the payout as sent (no payout_date column exists; BookingEvent already
    holds the audit trail and the two timestamps coincide).
    """
    payout_fmt = _fmt_amount(provider_payout)
    variables = {"1": payout_fmt, "2": payout_date}
    body = (
        f"Votre versement de {payout_fmt} FCFA a été envoyé le {payout_date}. "
        f"Merci pour votre travail avec Shizu !"
    )
    return send_whatsapp_template(provider_phone, "shizu_payout_sent_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_provider_new_mission(
    *, provider_phone: str, booking_ref: str, service_name: str,
    date: str, commune: str,
    time_slot: str = None, provider_payout: int = None, booking_id: int = None,
) -> bool:
    """Sent TO THE PROVIDER when a mission is assigned to them.
    The approved template makes the payout ({{5}}) mandatory: a mission with no
    known pay must NOT go out. `time_slot` is no longer a template variable
    ({{3}} is the date alone)."""
    if not provider_payout:
        logger.warning("notify_provider_new_mission: mission %s has no payout "
                       "— not sent (a mission is never announced without pay).",
                       booking_ref)
        return False

    payout_fmt = _fmt_amount(provider_payout)
    variables = {"1": booking_ref, "2": service_name, "3": date,
                 "4": commune, "5": payout_fmt}
    body = (
        f"Nouvelle mission Shizu {booking_ref} : {service_name}, le {date} à "
        f"{commune}. Votre rémunération : {payout_fmt} FCFA. Confirmez votre "
        f"disponibilité depuis votre tableau de bord."
    )
    return send_whatsapp_template(provider_phone, "shizu_provider_new_mission_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_review_received(
    *, provider_phone: str, booking_ref: str, rating: int, booking_id: int = None,
) -> bool:
    """Approved template positions: {{1}} booking ref, {{2}} rating.

    The client's name and the comment excerpt have no slot and are no longer
    sent (accepted loss — both stay readable in the admin dashboard).
    """
    variables = {"1": booking_ref, "2": str(rating)}
    body = (
        f"Nouvel avis sur la mission {booking_ref} : {rating}/5. "
        f"Merci pour votre excellent travail avec Shizu !"
    )
    return send_whatsapp_template(provider_phone, "shizu_review_received_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_booking_rescheduled_provider(
    *, provider_phone: str, booking_ref: str, new_date: str,
    new_slot: str = "", booking_id: int = None,
) -> bool:
    """Sent TO THE PROVIDER (always FR) when a mission is rescheduled.

    Approved template positions: {{1}} booking ref, {{2}} long date, {{3}} slot.
    An empty {{3}} would have the whole send refused (Meta rejects empty
    variables), so a missing slot falls back to the existing 'anytime' label —
    read in French, never in the client's locale (T-19).
    """
    slot = (new_slot or "").strip() or _slot_fallback("fr")
    variables = {"1": booking_ref, "2": new_date, "3": slot}
    body = (
        f"La mission #{booking_ref} a été reprogrammée. "
        f"Nouvelle date : {new_date} ({slot}). "
        f"Merci de noter le changement."
    )
    return send_whatsapp_template(provider_phone,
                                  "shizu_booking_rescheduled_provider_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_booking_cancelled_provider(
    *, provider_phone: str, booking_ref: str, date: str, booking_id: int = None,
) -> bool:
    """Approved template positions: {{1}} booking ref, {{2}} date."""
    variables = {"1": booking_ref, "2": date}
    body = (
        f"La mission #{booking_ref} du {date} a été annulée par le client. "
        f"Votre tableau de bord a été mis à jour: www.shizu.pro/fr/provider"
    )
    return send_whatsapp_template(provider_phone,
                                  "shizu_booking_cancelled_provider_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_registration_submitted(*, provider_name: str, provider_phone: str) -> bool:
    variables = {"1": provider_name}
    body = (
        f"Bonjour {provider_name}, nous avons bien reçu votre candidature "
        f"prestataire Shizu. Notre équipe vérifie votre profil sous 48 heures "
        f"et vous contactera sur ce numéro."
    )
    return send_whatsapp_template(provider_phone, "shizu_provider_registration_fr",
                                  variables, log_body=body)


# ── Dispute wrappers, PROVIDER side ──────────────────────────────────────────
# One position each: {{1}} booking ref. Literal _fr keys — no _en variant exists
# in the registry, and T-19 forbids addressing a provider in anything but French.

def notify_dispute_opened_provider(
    *, provider_phone: str, booking_ref: str, booking_id: int = None,
) -> bool:
    variables = {"1": booking_ref}
    body = (
        f"Mission Shizu {booking_ref} : un examen est en cours par notre équipe. "
        f"Le règlement est suspendu le temps de la vérification. Nous vous "
        f"contactons rapidement."
    )
    return send_whatsapp_template(provider_phone, "shizu_dispute_opened_provider_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_dispute_no_payment_provider(
    *, provider_phone: str, booking_ref: str, booking_id: int = None,
) -> bool:
    """Resolution 'refund_client' — the provider is NOT paid for this mission."""
    variables = {"1": booking_ref}
    body = (
        f"Mission Shizu {booking_ref} : l'examen est terminé. La mission est "
        f"clôturée sans règlement. Notre équipe vous contacte pour vous expliquer."
    )
    return send_whatsapp_template(provider_phone,
                                  "shizu_dispute_no_payment_provider_fr",
                                  variables, log_body=body, booking_id=booking_id)


def notify_dispute_released_provider(
    *, provider_phone: str, booking_ref: str, booking_id: int = None,
) -> bool:
    """Resolution 'release_provider' — the payout is released to the provider."""
    variables = {"1": booking_ref}
    body = (
        f"Mission Shizu {booking_ref} : l'examen est terminé. Votre règlement "
        f"est débloqué et sera traité normalement."
    )
    return send_whatsapp_template(provider_phone,
                                  "shizu_dispute_released_provider_fr",
                                  variables, log_body=body, booking_id=booking_id)


# notify_new_booking_request and notify_payment_recorded were REMOVED here.
# The first broadcast every new booking to the whole approved pool — the T-26
# short-circuit that let providers self-accept and skip the quote flow; its only
# caller has been commented out in api/bookings.py since then. The second had no
# caller at all. Dead code that encodes a closed bug is worse than no code: it
# invites someone to "re-enable" it. Git history keeps both if ever needed.
