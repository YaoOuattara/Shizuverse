from flask import jsonify
from shizuverse.models.user import User

def get_all_users():
    users = User.query.all()
    return jsonify({
        "users": [
            {"id": user.id, "email": user.email, "user_type": user.user_type}
            for user in users
        ]
    })
