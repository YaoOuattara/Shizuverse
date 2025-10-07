from flask import Blueprint, request, jsonify
from flasgger import swag_from
from models import db
from models.user import User
from flask_login import login_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
@swag_from('../../docs/auth/login.yml')  # ✅ External file reference
def login():
    data = request.json
    user = User.query.filter_by(email=data.get('email')).first()

    if user and user.check_password(data.get('password')):
        login_user(user)
        return jsonify({
            "message": "Logged in",
            "user_id": user.id,
            "user_type": user.user_type
        }), 200

    return jsonify({"error": "Invalid credentials"}), 401

