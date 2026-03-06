from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from shizuverse.models import db
from shizuverse.models.appointment import Appointment
from shizuverse.models.service_models import Service
from datetime import datetime

appointments_bp = Blueprint("appointments", __name__)


def appointment_to_dict(a):
    return {
        "id": a.id,
        "client_id": a.client_id,
        "provider_id": a.provider_id,
        "service_id": a.service_id,
        "service_name": a.service.name if a.service else None,
        "appointment_date": a.appointment_date.isoformat(),
        "status": a.status,
        "notes": a.notes,
        "duration_minutes": a.duration_minutes,
        "created_at": a.created_at.isoformat(),
    }


# ── CLIENT: create booking ────────────────────────────────────────────────────
@appointments_bp.route("/", methods=["POST"])
@login_required
def create_appointment():
    if current_user.user_type != "client":
        return jsonify({"error": "Only clients can create bookings"}), 403

    data = request.get_json()
    required = ["provider_id", "service_id", "appointment_date"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        apt_date = datetime.fromisoformat(data["appointment_date"])
    except ValueError:
        return jsonify({"error": "Invalid date format. Use ISO 8601."}), 400

    if apt_date < datetime.utcnow():
        return jsonify({"error": "Appointment date must be in the future"}), 400

    service = Service.query.get(data["service_id"])
    if not service:
        return jsonify({"error": "Service not found"}), 404

    appointment = Appointment(
        client_id=current_user.id,
        provider_id=data["provider_id"],
        service_id=data["service_id"],
        appointment_date=apt_date,
        notes=data.get("notes"),
        duration_minutes=data.get("duration_minutes", service.duration_minutes if hasattr(service, "duration_minutes") else None),
        status="pending",
    )
    db.session.add(appointment)
    db.session.commit()
    return jsonify(appointment_to_dict(appointment)), 201


# ── CLIENT: list my bookings ──────────────────────────────────────────────────
@appointments_bp.route("/my", methods=["GET"])
@login_required
def my_appointments():
    status_filter = request.args.get("status")
    query = Appointment.query.filter_by(client_id=current_user.id)
    if status_filter:
        query = query.filter_by(status=status_filter)
    appointments = query.order_by(Appointment.appointment_date.desc()).all()
    return jsonify([appointment_to_dict(a) for a in appointments]), 200


# ── CLIENT: cancel booking ────────────────────────────────────────────────────
@appointments_bp.route("/<int:apt_id>/cancel", methods=["POST"])
@login_required
def cancel_appointment(apt_id):
    apt = Appointment.query.get_or_404(apt_id)
    if apt.client_id != current_user.id:
        return jsonify({"error": "Not your booking"}), 403
    if apt.status not in ("pending", "confirmed"):
        return jsonify({"error": f"Cannot cancel a {apt.status} booking"}), 400
    apt.status = "cancelled"
    db.session.commit()
    return jsonify(appointment_to_dict(apt)), 200


# ── CLIENT: reschedule booking ────────────────────────────────────────────────
@appointments_bp.route("/<int:apt_id>/reschedule", methods=["POST"])
@login_required
def reschedule_appointment(apt_id):
    apt = Appointment.query.get_or_404(apt_id)
    if apt.client_id != current_user.id:
        return jsonify({"error": "Not your booking"}), 403
    if apt.status not in ("pending", "confirmed"):
        return jsonify({"error": f"Cannot reschedule a {apt.status} booking"}), 400

    data = request.get_json()
    new_date = data.get("appointment_date")
    if not new_date:
        return jsonify({"error": "appointment_date required"}), 400
    try:
        apt.appointment_date = datetime.fromisoformat(new_date)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    if apt.appointment_date < datetime.utcnow():
        return jsonify({"error": "New date must be in the future"}), 400

    apt.status = "pending"
    db.session.commit()
    return jsonify(appointment_to_dict(apt)), 200


# ── PROVIDER: list incoming bookings ─────────────────────────────────────────
@appointments_bp.route("/incoming", methods=["GET"])
@login_required
def incoming_appointments():
    if current_user.user_type != "provider":
        return jsonify({"error": "Providers only"}), 403
    status_filter = request.args.get("status")
    query = Appointment.query.filter_by(provider_id=current_user.id)
    if status_filter:
        query = query.filter_by(status=status_filter)
    appointments = query.order_by(Appointment.appointment_date.asc()).all()
    return jsonify([appointment_to_dict(a) for a in appointments]), 200


# ── PROVIDER: confirm booking ─────────────────────────────────────────────────
@appointments_bp.route("/<int:apt_id>/confirm", methods=["POST"])
@login_required
def confirm_appointment(apt_id):
    apt = Appointment.query.get_or_404(apt_id)
    if apt.provider_id != current_user.id:
        return jsonify({"error": "Not your booking"}), 403
    if apt.status != "pending":
        return jsonify({"error": f"Cannot confirm a {apt.status} booking"}), 400
    apt.status = "confirmed"
    db.session.commit()
    return jsonify(appointment_to_dict(apt)), 200


# ── PROVIDER: reject booking ──────────────────────────────────────────────────
@appointments_bp.route("/<int:apt_id>/reject", methods=["POST"])
@login_required
def reject_appointment(apt_id):
    apt = Appointment.query.get_or_404(apt_id)
    if apt.provider_id != current_user.id:
        return jsonify({"error": "Not your booking"}), 403
    if apt.status != "pending":
        return jsonify({"error": f"Cannot reject a {apt.status} booking"}), 400
    apt.status = "cancelled"
    db.session.commit()
    return jsonify(appointment_to_dict(apt)), 200


# ── PROVIDER: complete booking ────────────────────────────────────────────────
@appointments_bp.route("/<int:apt_id>/complete", methods=["POST"])
@login_required
def complete_appointment(apt_id):
    apt = Appointment.query.get_or_404(apt_id)
    if apt.provider_id != current_user.id:
        return jsonify({"error": "Not your booking"}), 403
    if apt.status != "confirmed":
        return jsonify({"error": f"Cannot complete a {apt.status} booking"}), 400
    apt.status = "completed"
    db.session.commit()
    return jsonify(appointment_to_dict(apt)), 200


# ── SHARED: get single booking ────────────────────────────────────────────────
@appointments_bp.route("/<int:apt_id>", methods=["GET"])
@login_required
def get_appointment(apt_id):
    apt = Appointment.query.get_or_404(apt_id)
    if apt.client_id != current_user.id and apt.provider_id != current_user.id:
        return jsonify({"error": "Access denied"}), 403
    return jsonify(appointment_to_dict(apt)), 200
