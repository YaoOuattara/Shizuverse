"""Public magic-link quote endpoints — no account required.

Access is gated solely by the unguessable per-booking token. Each response
exposes ONLY the target booking's quote data — never other bookings nor
private provider data.
"""
import os
import logging
from datetime import datetime

from flask import Blueprint, request, jsonify

from shizuverse.models import db
from shizuverse.models.client_booking import ClientBooking
from shizuverse.models.booking_event import BookingEvent
from shizuverse.limiter import limiter

logger = logging.getLogger(__name__)

quote_bp = Blueprint("quote", __name__)

DECLINE_REASONS = {"trop_cher", "plus_disponible", "trouve_ailleurs", "autre"}


def _payment_methods() -> dict:
    """Shizu's Mobile Money numbers from env — ONLY the keys that are actually
    set. In production these vars exist but are currently EMPTY, so an empty
    dict is the nominal case (the client is told to contact Shizu). No hardcoded
    numbers, no fake fallback."""
    raw = {
        "wave":   os.environ.get("SHIZU_WAVE_NUMBER", "").strip(),
        "orange": os.environ.get("SHIZU_ORANGE_NUMBER", "").strip(),
        "mtn":    os.environ.get("SHIZU_MTN_NUMBER", "").strip(),
    }
    return {k: v for k, v in raw.items() if v}


def _is_decided(b) -> bool:
    """A quote is single-use. Acceptance locks the amount (and moves the
    booking to under_review for assignment), so 'accepted' can't be keyed on
    status anymore — we key on amount_locked. Decline sets status='declined'."""
    return b.status == "declined" or bool(b.amount_locked)


def _decision(b) -> str:
    """Which terminal decision was taken (for the client 'already handled' UI)."""
    return "declined" if b.status == "declined" else "accepted"


def _already_decided_response(b):
    """The 409 body for an already-decided quote — single source of truth shared
    by GET and POST /accept. When the decision was ACCEPTED, re-expose the same
    payment instructions the client saw at acceptance (the link stays
    consultable; double-clicks on a slow connection land here too). DECLINED
    stays minimal and unchanged."""
    decision = _decision(b)
    payload = {"error": "already_decided", "decision": decision}
    if decision == "accepted":
        apt = b.appointment_date
        payload.update({
            "amount_xof": b.amount_xof,
            "payment_tier": b.payment_tier,
            "deposit_amount": b.deposit_amount,
            "payment_methods": _payment_methods(),
            "service_name": b.service_name,
            "appointment_date": apt.isoformat() if apt else None,
            "time_slot": b.time_slot or b.time_preference,
            "commune": (b.client_location or "").split(",")[0].strip(),
        })
    return jsonify(payload), 409


def _resolve(token: str):
    """Return (booking, None) or (None, (response, status))."""
    b = ClientBooking.query.filter_by(quote_token=token).first()
    if b is None:
        return None, (jsonify({"error": "not_found"}), 404)
    exp = b.quote_token_expires_at
    if exp and exp < datetime.utcnow():
        return None, (jsonify({"error": "expired"}), 410)
    return b, None


@quote_bp.route("/<token>", methods=["GET"])
@limiter.limit("10 per hour")
def get_quote(token):
    b, err = _resolve(token)
    if err:
        return err
    if _is_decided(b):
        # After acceptance the client can no longer reload the live quote, so the
        # one-time payment instructions would be lost. The shared helper re-exposes
        # them (declined stays untouched).
        return _already_decided_response(b)

    apt = b.appointment_date
    return jsonify({
        "service_name": b.service_name,
        "amount_xof": b.amount_xof,
        "payment_tier": b.payment_tier,
        "deposit_amount": b.deposit_amount,
        "quote_note": b.quote_note,
        "appointment_date": apt.isoformat() if apt else None,
        "time_slot": b.time_slot or b.time_preference,
        "commune": (b.client_location or "").split(",")[0].strip(),
        "status": b.status,
    })


@quote_bp.route("/<token>/accept", methods=["POST"])
@limiter.limit("10 per hour")
def accept_quote(token):
    b, err = _resolve(token)
    if err:
        return err
    if _is_decided(b):
        # Double-click on a slow connection lands here — return the full payment
        # instructions too (same payload as GET), it's exactly when the client
        # is waiting for them.
        return _already_decided_response(b)

    prev = b.status
    # Move to under_review (not 'accepted'): this is the status the admin UI can
    # act on — its assign block is gated on amount_locked, satisfied just below.
    b.status = "under_review"
    db.session.add(BookingEvent(
        booking_id=b.id, event_type="quote_accepted",
        from_status=prev, to_status="under_review",
        actor_id=None, note="Devis accepté par le client",
    ))

    # Lock the amount AT acceptance — from here it is immutable (dispute unlock
    # only). Guarded so a prior manual lock isn't duplicated/overwritten.
    if not b.amount_locked:
        b.amount_locked = True
        b.amount_locked_at = datetime.utcnow()
        db.session.add(BookingEvent(
            booking_id=b.id, event_type="amount_locked",
            from_status="under_review", to_status="under_review",
            actor_id=None, note="Verrouillé à l'acceptation du devis par le client",
        ))

    db.session.commit()

    # Payment instructions travel back with the acceptance so the client sees
    # them immediately. An empty methods dict is nominal today; only warn when
    # money IS due (any tier other than after_service) yet no number is set —
    # never let this block the acceptance.
    methods = _payment_methods()
    if not methods and b.payment_tier != "after_service":
        logger.warning("[quote] devis %s accepté sans moyen de paiement "
                       "configuré (SHIZU_WAVE/ORANGE/MTN vides)", b.id)

    return jsonify({
        "success": True,
        "status": b.status,
        "amount_locked": b.amount_locked,
        "payment_tier": b.payment_tier,
        "amount_xof": b.amount_xof,
        "deposit_amount": b.deposit_amount,
        "payment_methods": methods,
    })


@quote_bp.route("/<token>/decline", methods=["POST"])
@limiter.limit("10 per hour")
def decline_quote(token):
    b, err = _resolve(token)
    if err:
        return err
    if _is_decided(b):
        return jsonify({"error": "already_decided", "decision": _decision(b)}), 409

    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    if reason not in DECLINE_REASONS:
        return jsonify({"error": "invalid_reason", "allowed": sorted(DECLINE_REASONS)}), 400
    comment = (data.get("comment") or "").strip()[:500] or None

    prev = b.status
    b.status = "declined"   # existing VALID_STATUSES value
    # Store on the booking (structured) + as an event (visible in admin detail).
    b.decline_reason = comment or reason
    note = f"Motif: {reason}" + (f" — {comment}" if comment else "")
    db.session.add(BookingEvent(
        booking_id=b.id, event_type="quote_declined",
        from_status=prev, to_status="declined",
        actor_id=None, note=note,
    ))
    db.session.commit()
    return jsonify({"success": True, "status": "declined"})
