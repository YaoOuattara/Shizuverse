from flask import Blueprint
from .services import services_bp
from .appointments.appointments import appointments_bp
from .admin import admin_bp, provider_bp
from .bookings import bookings_bp

api_bp = Blueprint("api", __name__)
api_bp.register_blueprint(services_bp, url_prefix="/services")
api_bp.register_blueprint(appointments_bp, url_prefix="/appointments")
api_bp.register_blueprint(admin_bp, url_prefix="/admin")
api_bp.register_blueprint(provider_bp, url_prefix="/provider")
api_bp.register_blueprint(bookings_bp, url_prefix="/bookings")

__all__ = ["api_bp"]
