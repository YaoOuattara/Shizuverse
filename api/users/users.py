from flask import Blueprint, request, jsonify
from models import db
from models.user import User

users_bp = Blueprint('users', __name__)

@users_bp.route('/', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{"id": u.id, "email": u.email, "type": u.user_type} for u in users])

