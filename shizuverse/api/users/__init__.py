from flask import Blueprint
from .controller import get_all_users

users_bp = Blueprint('users', __name__)

@users_bp.route('/', methods=['GET'])
def index():
    return {"message": "Users endpoint is live"}

@users_bp.route('/all', methods=['GET'])
def all_users():
    return get_all_users()
