from flask import Blueprint, request, jsonify
from models import db
from models.appointment import Appointment
from datetime import datetime

appointments_bp = Blueprint('appointments', __name__)

@appointments_bp.route('/', methods=['POST'])
def create_appointment():
    data = request.json
    appointment = Appointment(
        client_id=data['client_id'],
        provider_id=data['provider_id'],
        service_id=data['service_id'],
        appointment_date=datetime.fromisoformat(data['appointment_date']),
        notes=data.get('notes')
    )
    db.session.add(appointment)
    db.session.commit()
    return jsonify({"id": appointment.id}), 201
