from flask import Blueprint
from .services import services_bp

api_bp = Blueprint("api", __name__)
api_bp.register_blueprint(services_bp, url_prefix="/services")

__all__ = ["api_bp"]

