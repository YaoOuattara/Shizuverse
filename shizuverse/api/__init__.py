from flask import Blueprint
from .services import services_bp
from .appointments.appointments import appointments_bp
from .admin import admin_bp, provider_bp, client_bp
from .bookings import bookings_bp
from .quote import quote_bp
from .providers.providers import providers_bp
from .reviews import reviews_bp
from .waitlist import waitlist_bp

api_bp = Blueprint("api", __name__)
api_bp.register_blueprint(services_bp, url_prefix="/services")
api_bp.register_blueprint(appointments_bp, url_prefix="/appointments")
api_bp.register_blueprint(admin_bp, url_prefix="/admin")
api_bp.register_blueprint(provider_bp, url_prefix="/provider")
api_bp.register_blueprint(client_bp, url_prefix="/client")
api_bp.register_blueprint(bookings_bp, url_prefix="/bookings")
api_bp.register_blueprint(quote_bp, url_prefix="/quote")
api_bp.register_blueprint(providers_bp, url_prefix="/providers")
api_bp.register_blueprint(reviews_bp, url_prefix="/reviews")
api_bp.register_blueprint(waitlist_bp, url_prefix="/waitlist")

__all__ = ["api_bp"]
