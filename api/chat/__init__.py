from flask import Blueprint
from .controller import get_all_users

users_bp = Blueprint('chat', __name__)

@users_bp.route('/', methods=['GET'])
def index():
    return {"message": "Chat service is live"}
