"""Public magic-link quote endpoints — no account required.

Access is gated solely by the unguessable per-booking token. Each response
exposes ONLY the target booking's quote data — never other bookings nor
private provider data.
"""
from datetime import datetime

from flask import Blueprint, request, jsonify

from shizuverse.models import db
from shizuverse.models.client_booking import ClientBooking
from shizuverse.models.booking_event import BookingEvent
from shizuverse.limiter import limiter

quote_bp = Blueprint("quote", __name__)

DECLINE_REASONS = {"trop_cher", "plus_disponible", "trouve_ailleurs", "autre"}
FINAL_STATES = ("accepted", "declined")


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
    if b.status in FINAL_STATES:
        return jsonify({"error": "already_decided", "status": b.status}), 409

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
    if b.status in FINAL_STATES:
        return jsonify({"error": "already_decided", "status": b.status}), 409

    prev = b.status
    b.status = "accepted"   # existing VALID_STATUSES value
    db.session.add(BookingEvent(
        booking_id=b.id, event_type="quote_accepted",
        from_status=prev, to_status="accepted",
        actor_id=None, note="Devis accepté par le client",
    ))

    # Lock the amount AT acceptance — from here it is immutable (dispute unlock
    # only). Guarded so a prior manual lock isn't duplicated/overwritten.
    if not b.amount_locked:
        b.amount_locked = True
        b.amount_locked_at = datetime.utcnow()
        db.session.add(BookingEvent(
            booking_id=b.id, event_type="amount_locked",
            from_status="accepted", to_status="accepted",
            actor_id=None, note="Verrouillé à l'acceptation du devis par le client",
        ))

    db.session.commit()
    return jsonify({"success": True, "status": "accepted", "amount_locked": b.amount_locked})


@quote_bp.route("/<token>/decline", methods=["POST"])
@limiter.limit("10 per hour")
def decline_quote(token):
    b, err = _resolve(token)
    if err:
        return err
    if b.status in FINAL_STATES:
        return jsonify({"error": "already_decided", "status": b.status}), 409

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
