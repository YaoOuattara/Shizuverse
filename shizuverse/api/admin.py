from flask import Blueprint, jsonify, request
from shizuverse.models.appointment import Appointment
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service
from shizuverse.models.user import User
from shizuverse.models.db import db
from datetime import datetime, timedelta

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/bookings', methods=['GET'])
def get_bookings():
    status = request.args.get('status')
    query = Appointment.query
    if status:
        query = query.filter_by(status=status)
    appointments = query.order_by(Appointment.appointment_date.desc()).all()
    result = []
    for a in appointments:
        result.append({
            'id': a.id,
            'client': a.client.username if a.client else 'Unknown',
            'provider': a.provider.username if a.provider else 'Unknown',
            'service': a.service.name if a.service else 'Unknown',
            'date': a.appointment_date.isoformat(),
            'status': a.status,
            'price': a.service.price if a.service and hasattr(a.service, 'price') else 0,
            'notes': a.notes,
        })
    return jsonify(result)

@admin_bp.route('/bookings/<int:booking_id>/status', methods=['PATCH'])
def update_booking_status(booking_id):
    data = request.get_json()
    appointment = Appointment.query.get_or_404(booking_id)
    appointment.status = data.get('status', appointment.status)
    db.session.commit()
    return jsonify({'success': True, 'status': appointment.status})

@admin_bp.route('/providers', methods=['GET'])
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
def verify_provider(provider_id):
    sp = ServiceProvider.query.get_or_404(provider_id)
    sp.verified = True
    db.session.commit()
    return jsonify({'success': True})

@admin_bp.route('/services', methods=['GET'])
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

@admin_bp.route('/stats', methods=['GET'])
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
