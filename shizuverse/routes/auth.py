from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from shizuverse.models import User, db
from shizuverse.limiter import limiter

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('user_type')  # 'client' or 'provider'
    preferred_language = data.get('preferred_language', 'fr')

    if not all([email, password, user_type]):
        return jsonify({'error': 'Missing required fields'}), 400

    if user_type not in ('client', 'provider'):
        return jsonify({'error': 'Invalid user type'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    phone = (data.get('phone') or data.get('phone_number') or '').strip()
    if phone and User.query.filter_by(phone=phone).first():
        return jsonify({'error': 'Ce numéro de téléphone est déjà utilisé'}), 409

    user = User(email=email, user_type=user_type, preferred_language=preferred_language)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully'}), 201


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({'error': 'Missing email or password'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    login_user(user)
    return jsonify({'message': 'Logged in successfully', 'user_type': user.user_type}), 200


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200


@auth_bp.route('/status', methods=['GET'])
def status():
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'id': current_user.id,
            'email': current_user.email,
            'user_type': current_user.user_type,
            'preferred_language': current_user.preferred_language
        })
    return jsonify({'authenticated': False}), 200

