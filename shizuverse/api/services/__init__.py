from flask import Blueprint
from .controller import get_appointments

services_bp = Blueprint('services', __name__)

@services_bp.route('/', methods=['GET'])
def index():
    return {"message": "Services endpoint is live"}

@services_bp.route('/appointments', methods=['GET'])
def appointments():
    return get_appointments()
