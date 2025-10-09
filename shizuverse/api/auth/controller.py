from flask import request, jsonify
from shizuverse.models.user import User
from flask_login import login_user
from werkzeug.security import check_password_hash

def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    if user and user.check_password(data['password']):
        login_user(user)
        return jsonify({"message": "Logged in", "user_id": user.id}), 200
    return jsonify({"error": "Invalid credentials"}), 401


