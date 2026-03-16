from flask import Blueprint, jsonify, request, current_app
from functools import wraps
from shizuverse.models import db, User
from shizuverse.models.appointment import Appointment
from shizuverse.models.client_booking import ClientBooking
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service
from datetime import datetime, timedelta
import jwt
import os

admin_bp = Blueprint('admin', __name__)


def require_admin_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        token = auth_header[7:]
        try:
            jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/login', methods=['POST'])
def admin_login():
    data = request.get_json() or {}
    password = data.get('password', '')
    expected = os.environ.get('ADMIN_PASSWORD', 'admin')
    if password != expected:
        return jsonify({'error': 'Invalid password'}), 401
    payload = {
        'sub': 'admin',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=30),
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return jsonify({'token': token})


@admin_bp.route('/bookings', methods=['GET'])
@require_admin_token
def get_bookings():
    status = request.args.get('status')
    query = ClientBooking.query
    if status:
        query = query.filter_by(status=status)
    bookings = query.order_by(ClientBooking.appointment_date.desc()).all()
    result = []
    for b in bookings:
        result.append({
            'id': str(b.id),
            'clientName': b.client_name,
            'clientPhone': b.client_phone,
            'serviceName': b.service_name,
            'serviceSlug': b.service_slug,
            'date': b.appointment_date.isoformat(),
            'status': b.status,
            'location': b.client_location,
            'notes': b.notes or '',
            'providerName': b.provider_name or '',
            'providerPhone': b.provider_phone or '',
            'createdAt': b.created_at.isoformat() if b.created_at else '',
        })
    return jsonify({'bookings': result, 'count': len(result)})

@admin_bp.route('/bookings/<int:booking_id>/assign', methods=['PUT'])
@require_admin_token
def assign_booking(booking_id):
    booking = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json() or {}
    provider_name = data.get('provider_name', '').strip()
    provider_phone = data.get('provider_phone', '').strip()
    if not provider_name:
        return jsonify({'error': 'provider_name required'}), 400
    booking.provider_name = provider_name
    booking.provider_phone = provider_phone
    booking.status = 'assigned'
    db.session.commit()
    return jsonify({
        'id': booking.id,
        'status': booking.status,
        'provider_name': booking.provider_name,
        'provider_phone': booking.provider_phone,
    })

@admin_bp.route('/bookings/<int:booking_id>/status', methods=['PATCH', 'PUT'])
@require_admin_token
def update_booking_status(booking_id):
    VALID = ['pending', 'under_review', 'assigned', 'confirmed', 'completed', 'cancelled']
    booking = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json() or {}
    new_status = data.get('status', '').strip()
    if not new_status or new_status not in VALID:
        return jsonify({'error': f'Invalid status. Use: {VALID}'}), 400
    booking.status = new_status
    if new_status == 'under_review':
        booking.reviewed_by = 'admin'
    db.session.commit()
    return jsonify({'id': booking.id, 'status': booking.status})

@admin_bp.route('/providers', methods=['GET'])
@require_admin_token
def get_providers():
    status = request.args.get('status')
    providers = ServiceProvider.query.all()
    seen = set()
    result = []
    for sp in providers:
        if sp.user_id in seen:
            continue
        seen.add(sp.user_id)
        result.append({
            'id': sp.id,
            'user_id': sp.user_id,
            'name': sp.company_name or (sp.user.username if sp.user else 'Unknown'),
            'email': sp.user.email if sp.user else '',
            'verified': sp.verified,
            'address': sp.address,
            'created_at': sp.created_at.isoformat() if sp.created_at else None,
        })
    return jsonify(result)

@admin_bp.route('/providers/<int:provider_id>/verify', methods=['PATCH'])
@require_admin_token
def verify_provider(provider_id):
    sp = ServiceProvider.query.get_or_404(provider_id)
    sp.verified = True
    db.session.commit()
    return jsonify({'success': True})

@admin_bp.route('/services', methods=['GET'])
@require_admin_token
def get_services():
    services = Service.query.all()
    result = []
    for s in services:
        result.append({
            'id': s.id,
            'name': s.name,
            'category': s.category if hasattr(s, 'category') else '',
            'price': s.price if hasattr(s, 'price') else 0,
            'duration': s.duration_minutes if hasattr(s, 'duration_minutes') else 0,
            'active': s.active if hasattr(s, 'active') else True,
        })
    return jsonify(result)

provider_bp = Blueprint('provider', __name__)


def require_provider_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            if payload.get('type') != 'provider':
                return jsonify({'error': 'Invalid token type'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


@provider_bp.route('/login', methods=['POST'])
def provider_login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return jsonify({'error': 'email and password required'}), 400
    user = User.query.filter_by(email=email, user_type='provider').first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401
    sp = ServiceProvider.query.filter_by(user_id=user.id).first()
    payload = {
        'sub': str(user.id),
        'type': 'provider',
        'provider_id': sp.id if sp else None,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=24),
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return jsonify({
        'token': token,
        'provider': {
            'id': sp.id if sp else None,
            'user_id': user.id,
            'name': sp.company_name if sp else email.split('@')[0],
            'email': user.email,
            'verified': sp.verified if sp else False,
        }
    })


@provider_bp.route('/register', methods=['POST'])
def provider_register():
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    phone = (data.get('phone') or '').strip()
    password = data.get('password', '')
    bio = (data.get('bio') or '').strip()
    service_names = data.get('services') or []

    if not full_name or not phone or not password:
        return jsonify({'error': 'full_name, phone, and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'password must be at least 6 characters'}), 400

    # Use phone as synthetic email so User.email constraint is satisfied
    synthetic_email = f"{phone.replace(' ', '').replace('+', '')}@shizu.ci"
    if User.query.filter_by(email=synthetic_email).first():
        return jsonify({'error': 'A provider with this phone number already exists'}), 409

    user = User(email=synthetic_email, user_type='provider', preferred_language='fr')
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # get user.id before commit

    # Match submitted service names against the services table (case-insensitive)
    matched_services = []
    for sname in service_names:
        svc = Service.query.filter(Service.name.ilike(f'%{sname}%')).first()
        if svc:
            matched_services.append(svc)

    # Need at least one ServiceProvider row for login to return provider_id
    if not matched_services:
        fallback = Service.query.filter_by(is_active=True).first()
        if fallback:
            matched_services = [fallback]

    sp = None
    for i, svc in enumerate(matched_services):
        sp_row = ServiceProvider(
            user_id=user.id,
            service_id=svc.id,
            company_name=full_name,
            phone_number=phone,
            bio=bio,
            verified=False,
            verification_status='submitted',
            submitted_at=datetime.utcnow(),
        )
        db.session.add(sp_row)
        if i == 0:
            sp = sp_row

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Registration received. Our team will review your profile.',
        'provider_id': sp.id if sp else None,
        'login_email': synthetic_email,
    }), 201


@provider_bp.route('/bookings', methods=['GET'])
def get_provider_bookings():
    provider_id = request.args.get('provider_id', type=int)
    query = Appointment.query
    if provider_id:
        query = query.filter_by(provider_id=provider_id)
    appointments = query.order_by(Appointment.appointment_date.desc()).all()
    result = []
    for a in appointments:
        result.append({
            'id': a.id,
            'customerId': a.client_id,
            'customerName': a.client.username if a.client else 'Unknown',
            'customerEmail': a.client.email if a.client else '',
            'serviceName': a.service.name if a.service else 'Unknown',
            'serviceType': a.service.category if a.service and hasattr(a.service, 'category') else '',
            'providerId': a.provider_id,
            'date': a.appointment_date.strftime('%Y-%m-%d') if a.appointment_date else '',
            'time': a.appointment_date.strftime('%H:%M') if a.appointment_date else '',
            'duration': a.service.duration_minutes if a.service and hasattr(a.service, 'duration_minutes') else 60,
            'price': a.service.price if a.service and hasattr(a.service, 'price') else 0,
            'status': a.status,
            'notes': a.notes,
            'requestedAt': a.created_at.isoformat() if hasattr(a, 'created_at') and a.created_at else None,
        })
    return jsonify(result)

@provider_bp.route('/bookings/<int:booking_id>/status', methods=['PATCH'])
def update_provider_booking_status(booking_id):
    data = request.get_json()
    appointment = Appointment.query.get_or_404(booking_id)
    new_status = data.get('status')
    if new_status not in ('confirmed', 'completed', 'cancelled'):
        return jsonify({'error': 'Invalid status'}), 400
    appointment.status = new_status
    db.session.commit()
    return jsonify({'success': True, 'status': appointment.status})

@admin_bp.route('/stats', methods=['GET'])
@require_admin_token
def get_stats():
    total = Appointment.query.count()
    pending = Appointment.query.filter_by(status='pending').count()
    confirmed = Appointment.query.filter_by(status='confirmed').count()
    completed = Appointment.query.filter_by(status='completed').count()
    cancelled = Appointment.query.filter_by(status='cancelled').count()
    providers = ServiceProvider.query.count()
    return jsonify({
        'total_bookings': total,
        'pending': pending,
        'confirmed': confirmed,
        'completed': completed,
        'cancelled': cancelled,
        'total_providers': providers,
    })
