from flask import Blueprint, request, jsonify, current_app
from shizuverse.models import db
from shizuverse.models.client_booking import ClientBooking, VALID_STATUSES
from shizuverse.models.service_models import Service
from datetime import datetime

bookings_bp = Blueprint("bookings", __name__)


# ── GET /api/bookings/ ────────────────────────────────────────────────────────
# Query params: client_phone, status, limit (default 50)
@bookings_bp.route("/", methods=["GET"])
def list_bookings():
    # accept both ?phone= (public lookup) and ?client_phone= (legacy)
    phone  = request.args.get("phone") or request.args.get("client_phone")
    ref    = (request.args.get("ref") or "").strip().lstrip("#").upper()
    status = request.args.get("status")
    limit  = min(int(request.args.get("limit", 50)), 200)

    if not phone:
        return jsonify({"count": 0, "items": []}), 200

    # Security: require a valid booking reference that belongs to this phone.
    # Format: SHZ-YYYY-ID  (e.g. SHZ-2025-32)
    # If ref is absent or doesn't match → return empty, never an error.
    if not ref:
        return jsonify({"count": 0, "items": []}), 200

    try:
        parts = ref.split("-")
        booking_id = int(parts[2]) if len(parts) >= 3 else None
    except (ValueError, IndexError):
        booking_id = None

    if not booking_id:
        return jsonify({"count": 0, "items": []}), 200

    verify = ClientBooking.query.filter_by(id=booking_id, client_phone=phone).first()
    if not verify:
        return jsonify({"count": 0, "items": []}), 200

    # Reference validated — return all bookings for this phone
    query = ClientBooking.query.filter_by(client_phone=phone)
    if status:
        if status not in VALID_STATUSES:
            return jsonify({"error": f"Invalid status. Must be one of: {VALID_STATUSES}"}), 400
        query = query.filter_by(status=status)

    bookings = query.order_by(ClientBooking.appointment_date.desc()).limit(limit).all()
    return jsonify({"count": len(bookings), "items": [b.to_dict() for b in bookings]}), 200


def check_booking_anomaly(phone: str) -> dict:
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(hours=24)
    recent_count = ClientBooking.query.filter(
        ClientBooking.client_phone == phone,
        ClientBooking.created_at >= cutoff
    ).count()
    if recent_count >= 3:
        return {"flagged": True, "reason": f"{recent_count} bookings in 24h"}
    return {"flagged": False}


# ── POST /api/bookings/ ───────────────────────────────────────────────────────
# Body: { client_name, client_phone, client_location, service_id|service_slug|service_name,
#         appointment_date (ISO 8601), notes? }
@bookings_bp.route("/", methods=["POST"])
def create_booking():
    data = request.get_json(silent=True) or {}

    required = ["client_name", "client_phone", "client_location", "appointment_date"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {missing}"}), 400

    if not data.get("service_id") and not data.get("service_slug") and not data.get("service_name"):
        return jsonify({"error": "Provide at least one of: service_id, service_slug, service_name"}), 400

    # Resolve service
    service = None
    service_name = data.get("service_name", "")
    service_slug = data.get("service_slug", "")

    if data.get("service_id"):
        service = Service.query.get(data["service_id"])
        if not service:
            return jsonify({"error": "Service not found"}), 404
        service_name = service_name or service.name
        service_slug = service_slug or ""

    # Parse date — strip timezone info so comparison with utcnow() is always naive
    try:
        apt_date = datetime.fromisoformat(data["appointment_date"])
        if apt_date.tzinfo is not None:
            from datetime import timezone
            apt_date = apt_date.astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        return jsonify({"error": "Invalid appointment_date. Use ISO 8601 (e.g. 2025-06-15T10:00:00)"}), 400

    if apt_date < datetime.utcnow():
        return jsonify({"error": "appointment_date must be in the future"}), 400

    client_phone = data["client_phone"].strip()
    anomaly = check_booking_anomaly(client_phone)
    if anomaly["flagged"]:
        print(f"[ANOMALY] {anomaly['reason']} - {client_phone}")

    from shizuverse.utils.payment_rules import get_payment_tier
    prior_bookings = ClientBooking.query.filter_by(client_phone=client_phone).count()
    initial_tier = get_payment_tier(None, prior_bookings)

    booking = ClientBooking(
        client_name=data["client_name"].strip(),
        client_phone=client_phone,
        client_location=data["client_location"].strip(),
        service_id=service.id if service else None,
        service_name=service_name.strip(),
        service_slug=service_slug.strip(),
        appointment_date=apt_date,
        notes=data.get("notes", "").strip() or None,
        urgency=(data.get("urgency") or "").strip() or None,
        time_preference=(data.get("time_preference") or "").strip() or None,
        time_slot=(data.get("time_slot") or "").strip() or None,
        payment_tier=initial_tier,
        deposit_amount=0,
        cancellation_policy='full_refund',  # no deposit yet, so always full refund
    )
    db.session.add(booking)
    db.session.commit()

    # WhatsApp: notify client their request was received
    try:
        from shizuverse.utils.notifications import notify_booking_created
        notify_booking_created(
            client_name=booking.client_name,
            client_phone=booking.client_phone,
            booking_ref=str(booking.id),
        )
    except Exception as e:
        current_app.logger.error(f"[create_booking] Unexpected error: {e}", exc_info=True)

    # WhatsApp: ping approved active providers in the matching commune
    try:
        from shizuverse.utils.notifications import notify_new_booking_request
        from shizuverse.models.service_provider import ServiceProvider
        commune = (booking.client_location or '').split(',')[0].strip()
        apt = booking.appointment_date
        date_str = apt.strftime('%d/%m/%Y') if apt else ''

        candidates = ServiceProvider.query.filter(
            ServiceProvider.verification_status == 'approved',
            ServiceProvider.provider_status == 'active',
        ).all()

        seen_users: set = set()
        zone_matched = []
        all_active = []
        for sp in candidates:
            if sp.user_id in seen_users or not sp.phone_number:
                continue
            seen_users.add(sp.user_id)
            if commune and sp.address and commune.lower() in sp.address.lower():
                zone_matched.append(sp)
            else:
                all_active.append(sp)

        for sp in (zone_matched or all_active):
            notify_new_booking_request(
                provider_phone=sp.phone_number,
                service_type=booking.service_name,
                commune=commune,
                date=date_str,
                time_preference=booking.time_preference or '',
            )
    except Exception as e:
        current_app.logger.error(f"[create_booking] Unexpected error: {e}", exc_info=True)

    return jsonify(booking.to_dict()), 201


# ── POST /api/bookings/<id>/payment-declared ─────────────────────────────────
# Client declares they have made a payment — awaits admin confirmation.
@bookings_bp.route("/<int:booking_id>/payment-declared", methods=["POST"])
def payment_declared(booking_id):
    booking = ClientBooking.query.get_or_404(booking_id)

    if booking.payment_status == 'paid':
        return jsonify({"error": "Paiement déjà confirmé pour cette réservation"}), 400

    booking.payment_status = 'pending'   # 'pending' = awaiting admin confirmation
    booking.status = 'pending_payment'

    from shizuverse.models.booking_event import BookingEvent
    event = BookingEvent(
        booking_id=booking_id,
        event_type='payment_declared',
        from_status=booking.status,
        to_status='pending_payment',
        note='Client a déclaré le paiement',
    )
    db.session.add(event)
    db.session.commit()

    # WhatsApp: alert admin that client declared payment
    try:
        import os
        from shizuverse.utils.notifications import send_whatsapp
        admin_phone = os.environ.get('SHIZU_ADMIN_PHONE') or os.environ.get('NEXT_PUBLIC_SHIZU_WHATSAPP', '')
        deposit_amt = booking.deposit_amount or booking.amount_xof or 0
        if admin_phone:
            send_whatsapp(
                admin_phone,
                f"💳 {booking.client_name} a déclaré avoir effectué le paiement pour la "
                f"réservation #{booking_id} ({deposit_amt:,} FCFA). "
                f"Vérifiez et confirmez."
            )
    except Exception as e:
        current_app.logger.error(f"[payment_declared] Unexpected error: {e}", exc_info=True)

    return jsonify({"message": "Paiement déclaré — en attente de confirmation Shizu"})


# ── PUT /api/bookings/<id>/ ───────────────────────────────────────────────────
# Body: { status }
@bookings_bp.route("/<int:booking_id>/", methods=["PUT"])
def update_booking(booking_id):
    booking = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json(silent=True) or {}

    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "status is required"}), 400
    if new_status not in VALID_STATUSES:
        return jsonify({"error": f"Invalid status. Must be one of: {VALID_STATUSES}"}), 400

    booking.status = new_status
    db.session.commit()
    return jsonify(booking.to_dict()), 200


# ── DELETE /api/bookings/<id>/ ────────────────────────────────────────────────
@bookings_bp.route("/<int:booking_id>/", methods=["DELETE"])
def cancel_booking(booking_id):
    booking = ClientBooking.query.get_or_404(booking_id)

    if booking.status not in ("pending", "confirmed"):
        return jsonify({"error": f"Cannot cancel a booking with status '{booking.status}'"}), 400

    booking.status = "cancelled"
    db.session.commit()
    return jsonify(booking.to_dict()), 200

