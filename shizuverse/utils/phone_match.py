"""Attach an incoming WhatsApp number to the right person and the right file.

Resolution order is PROVIDER first, then client, and that order is deliberate:
a provider who writes is always writing about the mission that was assigned to
them, whereas a client writes about their own booking. When a number is both
(a provider who also books as a client — the test number is exactly this), the
provider file wins and the ambiguity is logged AND stored, never collapsed
silently.
"""
import logging

from shizuverse.models import db, ClientBooking
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.utils.phone import normalize_phone

logger = logging.getLogger(__name__)

# A file is "live" while it can still be discussed. Both status vocabularies of
# the codebase are covered on purpose (the public flow writes 'requested', the
# admin flow writes 'under_review'/'assigned'/'confirmed'): a message must never
# fail to attach because of which endpoint last touched the booking.
LIVE_STATUSES = (
    'requested', 'pending', 'under_review', 'assigned',
    'accepted', 'confirmed', 'in_progress', 'pending_payment',
)


def _most_recent(query):
    """Prefer a live file; fall back to the most recent one of any status.

    A message about a booking finished yesterday must still land somewhere —
    returning None would send it to the unmatched queue for no good reason.
    """
    live = (query.filter(ClientBooking.status.in_(LIVE_STATUSES))
                 .order_by(ClientBooking.created_at.desc()).first())
    if live:
        return live
    return query.order_by(ClientBooking.created_at.desc()).first()


def _bookings_matching_phone(column, canonical):
    """Bookings whose phone column equals `canonical` once normalized.

    Rows created since T-22 are already stored normalized, so the exact match
    below covers them and uses the index. Older rows may hold a raw value
    ("07 07 05 01 54", "+225 07…"), which is why we also sweep candidates by
    their last 8 digits and normalize both sides — the same both-sides rule as
    provider_login (api/admin.py). The sweep is bounded: it only runs when the
    exact match found nothing.
    """
    exact = ClientBooking.query.filter(column == canonical)
    if db.session.query(exact.exists()).scalar():
        return exact

    tail = canonical[-8:]
    if not tail:
        return exact
    candidates = ClientBooking.query.filter(column.like(f"%{tail}%")).all()
    ids = [b.id for b in candidates if normalize_phone(b.client_phone or '') == canonical
           or normalize_phone(b.provider_phone or '') == canonical]
    if not ids:
        return exact  # empty query, caller handles None
    return ClientBooking.query.filter(ClientBooking.id.in_(ids))


def resolve_phone(raw_phone):
    """Map an inbound WhatsApp number to (booking_id, provider_id, matched_role).

    Never raises and never returns a partial guess: an unknown number yields
    (None, None, 'none') so the message is still stored, visible in the
    unmatched queue, rather than dropped.
    """
    canonical = normalize_phone((raw_phone or '').strip())
    if not canonical:
        return None, None, 'none'

    # ── Provider side ────────────────────────────────────────────────────────
    # phone_number is normalized AND validated at boot (app.py startup pass), so
    # an exact match is enough here.
    provider = ServiceProvider.query.filter_by(phone_number=canonical).first()
    provider_booking = None
    if provider is not None:
        provider_booking = _most_recent(
            _bookings_matching_phone(ClientBooking.provider_phone, canonical)
        )

    # ── Client side ──────────────────────────────────────────────────────────
    client_booking = _most_recent(
        _bookings_matching_phone(ClientBooking.client_phone, canonical)
    )

    is_provider = provider is not None
    is_client = client_booking is not None

    if is_provider and is_client:
        logger.warning(
            "[whatsapp-match] %s correspond aux DEUX rôles — prestataire retenu. "
            "Prestataire: id=%s user_id=%s «%s» (mission rattachée: %s) | "
            "Client: réservation #%s «%s» (%s). Le message est rattaché à la "
            "mission prestataire ; matched_role='both' conserve l'ambiguïté.",
            canonical, provider.id, provider.user_id,
            provider.company_name or '—',
            provider_booking.id if provider_booking else 'aucune',
            client_booking.id, client_booking.client_name, client_booking.status,
        )
        booking = provider_booking or client_booking
        return (booking.id if booking else None), provider.id, 'both'

    if is_provider:
        return (provider_booking.id if provider_booking else None), provider.id, 'provider'

    if is_client:
        return client_booking.id, None, 'client'

    logger.info("[whatsapp-match] %s ne correspond à aucun client ni prestataire "
                "— message conservé sans rattachement", canonical)
    return None, None, 'none'
