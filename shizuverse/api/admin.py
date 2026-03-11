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
        'exp': datetime.utcnow() + timedelta(hours=8),
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
            'createdAt': b.created_at.isoformat() if b.created_at else '',
        })
    return jsonify({'bookings': result, 'count': len(result)})

@admin_bp.route('/bookings/<int:booking_id>/status', methods=['PATCH'])
@require_admin_token
def update_booking_status(booking_id):
    data = request.get_json()
    appointment = Appointment.query.get_or_404(booking_id)
    appointment.status = data.get('status', appointment.status)
    db.session.commit()
    return jsonify({'success': True, 'status': appointment.status})

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
