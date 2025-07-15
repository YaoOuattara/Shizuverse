from flask import Blueprint

# Create a Blueprint object for the whole API
api_bp = Blueprint('api', __name__)

# Import and register sub-blueprints
from .api.auth import auth_bp
from .api.users import users_bp
from .api.services import services_bp
from .api.appointments import appointments_bp

# Register each sub-blueprint under a prefix
api_bp.register_blueprint(auth_bp, url_prefix='/auth')
api_bp.register_blueprint(users_bp, url_prefix='/users')
api_bp.register_blueprint(services_bp, url_prefix='/services')
api_bp.register_blueprint(appointments_bp, url_prefix='/appointments')

