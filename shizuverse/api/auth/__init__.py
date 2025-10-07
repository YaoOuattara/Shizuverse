from flask import Blueprint
from flasgger.utils import swag_from
from .controller import login as login_controller  # Rename on import to avoid collision

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/', methods=['GET'])
def index():
    return {"message": "Auth service is live"}

@auth_bp.route('/login', methods=['POST'])
@swag_from('../../docs/auth/login.yml')
def login():
    return login_controller()
