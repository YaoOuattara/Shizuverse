import os
from flask import Blueprint
from flasgger.utils import swag_from
from .controller import get_appointments

appointments_bp = Blueprint('appointments', __name__)

@appointments_bp.route('/', methods=['GET'])
def index():
    return {"message": "Appointments service is live"}

@appointments_bp.route('/all', methods=['GET'])
@swag_from(os.path.join(os.path.dirname(__file__), '../../docs/appointments/all.yaml'))
def all():
    return get_appointments()
