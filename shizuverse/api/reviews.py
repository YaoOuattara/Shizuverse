from flask import Blueprint, request, jsonify
from shizuverse.models import db
from shizuverse.models.review import Review
from shizuverse.models.client_booking import ClientBooking
from shizuverse.models.service_provider import ServiceProvider

reviews_bp = Blueprint("reviews", __name__)


@reviews_bp.route("/", methods=["POST"])
def submit_review():
    data = request.get_json(silent=True) or {}

    booking_id = data.get("booking_id")
    rating = data.get("rating")

    if not booking_id or rating is None:
        return jsonify({"error": "booking_id and rating are required"}), 400

    if not isinstance(rating, int) or not (1 <= rating <= 5):
        return jsonify({"error": "rating must be an integer between 1 and 5"}), 400

    booking = ClientBooking.query.get(booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    existing = Review.query.filter_by(booking_id=booking_id).first()
    if existing:
        return jsonify({"error": "Review already submitted for this booking"}), 409

    punctuality = data.get("punctuality")
    respect = data.get("respect")

    # Resolve provider_id from the booking's assigned provider name
    provider_id = None
    if booking.provider_name:
        sp = ServiceProvider.query.filter_by(company_name=booking.provider_name).first()
        if sp:
            provider_id = sp.id

    review = Review(
        booking_id=booking_id,
        client_name=booking.client_name,
        client_phone=booking.client_phone,
        rating=rating,
        text=(data.get("comment") or "").strip() or None,
        service_slug=booking.service_slug or "",
        provider_id=provider_id,
        punctuality=bool(punctuality) if punctuality is not None else None,
        respect=bool(respect) if respect is not None else None,
        is_published=True,
    )
    db.session.add(review)
    db.session.commit()
    return jsonify({"success": True, "id": review.id}), 200
