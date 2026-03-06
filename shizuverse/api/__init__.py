from flask import Blueprint
from .services import services_bp
from .appointments.appointments import appointments_bp

api_bp = Blueprint("api", __name__)
api_bp.register_blueprint(services_bp, url_prefix="/services")
api_bp.register_blueprint(appointments_bp, url_prefix="/appointments")

__all__ = ["api_bp"]
