from flask import Blueprint, jsonify, request, current_app, g
from functools import wraps
from shizuverse.models import db, User
from shizuverse.models.appointment import Appointment
from shizuverse.models.client_booking import ClientBooking
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.service_models import Service, ServiceCategory
from shizuverse.models.waitlist import Waitlist
from datetime import datetime, timedelta
from sqlalchemy import func
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
    from sqlalchemy import inspect as sa_inspect, text as sa_text
    from shizuverse.models.service_models import ServiceSubcategory, ServiceCategory

    inspector = sa_inspect(db.engine)
    cat_cols  = {c['name'] for c in inspector.get_columns('service_categories')}
    svc_cols  = {c['name'] for c in inspector.get_columns('services')}
    has_cat_fr  = 'name_fr' in cat_cols
    has_svc_fr  = 'name_fr' in svc_cols

    services = Service.query.order_by(Service.subcategory_id, Service.id).all()
    result = []
    for s in services:
        # Resolve category name through subcategory relationship
        sub = ServiceSubcategory.query.get(s.subcategory_id) if s.subcategory_id else None
        cat = ServiceCategory.query.get(sub.category_id) if sub else None

        if cat and has_cat_fr:
            row = db.session.execute(
                sa_text("SELECT name_fr, name FROM service_categories WHERE id=:id"), {"id": cat.id}
            ).first()
            cat_name = (row[0] or row[1]) if row else (cat.name if cat else '')
        else:
            cat_name = cat.name if cat else ''

        svc_name = s.name
        if has_svc_fr:
            row = db.session.execute(
                sa_text("SELECT name_fr FROM services WHERE id=:id"), {"id": s.id}
            ).first()
            if row and row[0]:
                svc_name = row[0]

        result.append({
            'id': s.id,
            'name': svc_name,
            'category': cat_name,
            'active': s.is_active,
            'is_priority': s.is_priority,
            'featured': s.featured,
        })
    return jsonify(result)


@admin_bp.route('/services/<int:service_id>', methods=['PATCH'])
@require_admin_token
def patch_service(service_id):
    service = Service.query.get_or_404(service_id)
    data = request.get_json() or {}

    if 'is_active' in data:
        service.is_active = bool(data['is_active'])
    if 'is_priority' in data:
        service.is_priority = bool(data['is_priority'])
    if 'featured' in data:
        service.featured = bool(data['featured'])
    if 'name' in data and str(data['name']).strip():
        service.name = str(data['name']).strip()

    db.session.commit()
    return jsonify({'success': True, 'id': service.id, 'is_active': service.is_active})


@admin_bp.route('/services', methods=['POST'])
@require_admin_token
def create_service():
    from shizuverse.models.service_models import ServiceSubcategory, ServiceCategory
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    category_name = str(data.get('category', '')).strip()

    # Try to find best-matching subcategory by category name
    subcategory = None
    if category_name:
        cats = ServiceCategory.query.all()
        for cat in cats:
            if category_name.lower() in cat.name.lower() or cat.name.lower() in category_name.lower():
                sub = ServiceSubcategory.query.filter_by(category_id=cat.id).first()
                if sub:
                    subcategory = sub
                    break

    if not subcategory:
        subcategory = ServiceSubcategory.query.first()

    if not subcategory:
        return jsonify({'error': 'No subcategory available to assign service'}), 400

    service = Service(
        name=name,
        is_active=bool(data.get('is_active', True)),
        is_priority=False,
        featured=False,
        professional_required=None,
        subcategory_id=subcategory.id,
    )
    db.session.add(service)
    db.session.commit()

    cat = ServiceCategory.query.get(subcategory.category_id) if subcategory else None
    return jsonify({
        'id': service.id,
        'name': service.name,
        'category': cat.name if cat else category_name,
        'active': service.is_active,
        'is_priority': service.is_priority,
        'featured': service.featured,
    }), 201


@admin_bp.route('/services/<int:service_id>', methods=['DELETE'])
@require_admin_token
def delete_service(service_id):
    service = Service.query.get_or_404(service_id)
    db.session.delete(service)
    db.session.commit()
    return jsonify({'success': True, 'id': service_id})


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
    phone = (data.get('phone') or '').strip().replace(' ', '').replace('+', '')
    password = data.get('password', '')
    if not phone or not password:
        return jsonify({'error': 'phone and password required'}), 400
    # Look up by phone number stored on ServiceProvider
    sp = ServiceProvider.query.filter_by(phone_number=phone).first()
    if not sp:
        # Fallback: try synthetic email pattern
        synthetic_email = f"{phone}@shizu.ci"
        user = User.query.filter_by(email=synthetic_email, user_type='provider').first()
        if user:
            sp = ServiceProvider.query.filter_by(user_id=user.id).first()
    if not sp:
        return jsonify({'error': 'Invalid credentials'}), 401
    user = User.query.get(sp.user_id)
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401
    payload = {
        'sub': str(user.id),
        'type': 'provider',
        'provider_id': sp.id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=30),
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return jsonify({
        'token': token,
        'provider': {
            'id': sp.id,
            'user_id': user.id,
            'name': sp.company_name or phone,
            'phone': sp.phone_number or phone,
            'verification_status': sp.verification_status,
            'listed_status': sp.listed_status,
            'provider_status': sp.provider_status,
            'bio': sp.bio,
            'address': sp.address,
        }
    })


@provider_bp.route('/register', methods=['POST'])
def provider_register():
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    phone = (data.get('phone') or '').strip()
    password = data.get('password', '')
    bio = (data.get('bio') or '').strip()
    service_items = data.get('services') or []
    zones = data.get('zones') or []
    zones_str = ', '.join(str(z).strip() for z in zones if z) if zones else ''
    account_type = (data.get('account_type') or 'individual').strip()
    business_name = (data.get('company_name') or '').strip()
    rccm_number = (data.get('rccm_number') or '').strip() or None
    # Mobile money fields — accept correct names only
    mobile_money_operator = (data.get('mobile_money_operator') or '').strip() or None
    mobile_money_number   = (data.get('mobile_money_number') or '').strip() or None
    mobile_money_name     = (data.get('mobile_money_name') or '').strip() or None
    profile_photo_url     = (data.get('profile_photo_url') or '').strip() or None
    id_document_url       = (data.get('id_doc_url') or '').strip() or None

    if not full_name or not phone or not password:
        return jsonify({'error': 'full_name, phone, and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'password must be at least 6 characters'}), 400
    if account_type == 'company' and not business_name:
        return jsonify({'error': 'company_name is required for company accounts'}), 400

    # Use phone as synthetic email so User.email constraint is satisfied
    synthetic_email = f"{phone.replace(' ', '').replace('+', '')}@shizu.ci"
    if User.query.filter_by(email=synthetic_email).first():
        return jsonify({'error': 'A provider with this phone number already exists'}), 409

    user = User(email=synthetic_email, user_type='provider', preferred_language='fr')
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # get user.id before commit

    display_name = business_name if account_type == 'company' else full_name

    # Resolve service_items to actual Service rows.
    # Frontend sends category IDs (integers); fall back to name-matching for strings (test compat).
    matched_services = []
    seen_ids: set = set()

    for item in service_items:
        if isinstance(item, (int, float)) or (isinstance(item, str) and str(item).strip().isdigit()):
            # Category ID → find one active service per subcategory under that category
            cat = ServiceCategory.query.get(int(item))
            if cat:
                for sub in cat.subcategories:
                    svc = Service.query.filter_by(subcategory_id=sub.id, is_active=True).first()
                    if svc and svc.id not in seen_ids:
                        matched_services.append(svc)
                        seen_ids.add(svc.id)
        else:
            # Name-based match (backward compat / test suite sends strings)
            svc = Service.query.filter(Service.name.ilike(f'%{item}%')).first()
            if svc and svc.id not in seen_ids:
                matched_services.append(svc)
                seen_ids.add(svc.id)

    # Always need at least one ServiceProvider row for login to return provider_id
    if not matched_services:
        fallback = Service.query.filter_by(is_active=True).first()
        if fallback:
            matched_services = [fallback]

    sp = None
    for i, svc in enumerate(matched_services):
        sp_row = ServiceProvider(
            user_id=user.id,
            service_id=svc.id,
            company_name=display_name,
            phone_number=phone,
            bio=bio,
            address=zones_str or None,
            verified=False,
            verification_status='submitted',
            submitted_at=datetime.utcnow(),
            account_type=account_type,
            rccm_number=rccm_number,
            mobile_money_operator=mobile_money_operator,
            mobile_money_number=mobile_money_number,
            mobile_money_name=mobile_money_name,
            profile_photo_url=profile_photo_url,
            id_document_url=id_document_url,
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
@require_provider_token
def get_provider_bookings():
    # Decode JWT to identify the provider
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    provider_sp_id = payload.get('provider_id')
    sp = ServiceProvider.query.get(provider_sp_id) if provider_sp_id else None
    provider_company_name = sp.company_name if sp else None

    # New requests: all unassigned ClientBookings with status "requested" / "pending"
    open_requests = ClientBooking.query.filter(
        ClientBooking.status.in_(['requested', 'pending']),
    ).order_by(ClientBooking.appointment_date.asc()).all()

    # Provider's own bookings (confirmed / completed / cancelled)
    own_bookings = []
    if provider_company_name:
        own_bookings = ClientBooking.query.filter(
            ClientBooking.provider_name == provider_company_name,
            ClientBooking.status.notin_(['requested', 'pending']),
        ).order_by(ClientBooking.appointment_date.desc()).all()

    # Deduplicate (a booking may have been accepted by this provider already)
    seen_ids = set()
    result = []
    for b in open_requests + own_bookings:
        if b.id in seen_ids:
            continue
        seen_ids.add(b.id)
        result.append({
            'id': b.id,
            'customerName': b.client_name,
            'customerPhone': b.client_phone,
            'location': b.client_location,
            'serviceName': b.service_name,
            'date': b.appointment_date.strftime('%Y-%m-%d') if b.appointment_date else '',
            'time': b.appointment_date.strftime('%H:%M') if b.appointment_date else '',
            'duration': b.service.duration_minutes if b.service and hasattr(b.service, 'duration_minutes') else 60,
            'price': b.service.price if b.service and hasattr(b.service, 'price') else 0,
            'status': b.status,
            'payment_status': b.payment_status,
            'amount_xof': b.amount_xof,
            'notes': b.notes,
            'requestedAt': b.created_at.isoformat() if b.created_at else None,
        })
    return jsonify(result)


@provider_bp.route('/bookings/<int:booking_id>/start', methods=['PATCH'])
@require_provider_token
def start_provider_booking(booking_id):
    """Provider has arrived on site — sets status to in_progress."""
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    provider_sp_id = payload.get('provider_id')
    sp = ServiceProvider.query.get(provider_sp_id) if provider_sp_id else None

    booking = ClientBooking.query.get_or_404(booking_id)
    if booking.status not in ('confirmed', 'accepted'):
        return jsonify({'error': 'Booking must be confirmed before starting'}), 400

    booking.status = 'in_progress'
    from shizuverse.models.booking_event import BookingEvent
    event = BookingEvent(
        booking_id=booking_id,
        event_type='started',
        from_status='confirmed',
        to_status='in_progress',
        actor_phone=sp.phone_number if sp else None,
        note='Provider arrived on site',
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({'success': True, 'status': 'in_progress'})


@provider_bp.route('/bookings/<int:booking_id>/complete', methods=['PATCH'])
@require_provider_token
def complete_provider_booking(booking_id):
    """Provider has finished the mission — sets status to completed."""
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    provider_sp_id = payload.get('provider_id')
    sp = ServiceProvider.query.get(provider_sp_id) if provider_sp_id else None

    booking = ClientBooking.query.get_or_404(booking_id)
    if booking.status != 'in_progress':
        return jsonify({'error': 'Booking must be in_progress to complete'}), 400

    booking.status = 'completed'
    from shizuverse.models.booking_event import BookingEvent
    event = BookingEvent(
        booking_id=booking_id,
        event_type='completed',
        from_status='in_progress',
        to_status='completed',
        actor_phone=sp.phone_number if sp else None,
        note='Mission completed by provider',
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({'success': True, 'status': 'completed'})


@provider_bp.route('/bookings/<int:booking_id>/accept', methods=['PATCH'])
@require_provider_token
def accept_provider_booking(booking_id):
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    provider_sp_id = payload.get('provider_id')
    sp = ServiceProvider.query.get(provider_sp_id) if provider_sp_id else None

    booking = ClientBooking.query.get_or_404(booking_id)
    if booking.status not in ('requested', 'pending'):
        return jsonify({'error': 'Booking is not available to accept'}), 400

    booking.status = 'confirmed'
    booking.provider_name = sp.company_name if sp else None
    booking.provider_phone = sp.phone_number if sp else None
    booking.reviewed_by = 'provider'
    db.session.commit()
    return jsonify({'success': True, 'status': 'confirmed'})


@provider_bp.route('/bookings/<int:booking_id>/decline', methods=['PATCH'])
@require_provider_token
def decline_provider_booking(booking_id):
    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()

    booking = ClientBooking.query.get_or_404(booking_id)
    if booking.status not in ('requested', 'pending', 'confirmed'):
        return jsonify({'error': 'Cannot decline booking in current status'}), 400

    booking.status = 'cancelled'
    booking.decline_reason = reason
    booking.reviewed_by = 'provider'
    db.session.commit()
    return jsonify({'success': True, 'status': 'cancelled'})


@provider_bp.route('/bookings/<int:booking_id>/status', methods=['PATCH'])
def update_provider_booking_status(booking_id):
    """Legacy endpoint — kept for backwards compat."""
    data = request.get_json()
    booking = ClientBooking.query.get(booking_id)
    if not booking:
        appointment = Appointment.query.get_or_404(booking_id)
        new_status = data.get('status')
        if new_status not in ('confirmed', 'completed', 'cancelled'):
            return jsonify({'error': 'Invalid status'}), 400
        appointment.status = new_status
        db.session.commit()
        return jsonify({'success': True, 'status': appointment.status})
    new_status = data.get('status')
    if new_status not in ('confirmed', 'completed', 'cancelled'):
        return jsonify({'error': 'Invalid status'}), 400
    booking.status = new_status
    db.session.commit()
    return jsonify({'success': True, 'status': booking.status})


@provider_bp.route('/profile', methods=['GET'])
@require_provider_token
def get_provider_profile():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    provider_id = payload.get('provider_id')

    sp = ServiceProvider.query.get_or_404(provider_id)
    user = User.query.get(sp.user_id)

    # Collect all service names offered by this user across their ServiceProvider rows
    all_rows = ServiceProvider.query.filter_by(user_id=sp.user_id).all()
    services = []
    for row in all_rows:
        svc = Service.query.get(row.service_id) if row.service_id else None
        if svc and svc.name not in services:
            services.append(svc.name)

    return jsonify({
        'id': sp.id,
        'user_id': sp.user_id,
        'name': sp.company_name or (user.email.split('@')[0] if user else ''),
        'phone': sp.phone_number,
        'email': user.email if user else None,
        'bio': sp.bio,
        'address': sp.address,
        'profile_photo_url': sp.profile_photo_url,
        'id_document_url': sp.id_document_url,
        'experience_text': sp.experience_text,
        'experience_photo_url': sp.experience_photo_url,
        'mobile_money_number': sp.mobile_money_number,
        'mobile_money_name': sp.mobile_money_name,
        'mobile_money_operator': sp.mobile_money_operator,
        'verification_status': sp.verification_status,
        'listed_status': sp.listed_status,
        'provider_status': sp.provider_status,
        'rejection_reason': sp.rejection_reason,
        'rejection_note': sp.rejection_note,
        'submitted_at': sp.submitted_at.isoformat() if sp.submitted_at else None,
        'reviewed_at': sp.reviewed_at.isoformat() if sp.reviewed_at else None,
        'services': services,
    })


@provider_bp.route('/profile', methods=['PATCH'])
@require_provider_token
def update_provider_profile():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    provider_id = payload.get('provider_id')

    sp = ServiceProvider.query.get_or_404(provider_id)

    data = request.get_json() or {}

    # Simple text/URL fields — update only if key is present in request
    str_fields = [
        'bio',
        'profile_photo_url',
        'id_document_url',
        'experience_text',
        'experience_photo_url',
        'mobile_money_number',
        'mobile_money_name',
        'mobile_money_operator',
    ]
    for field in str_fields:
        if field in data:
            setattr(sp, field, (data[field] or '').strip() or None)

    # If any verification document is submitted, move status to "submitted"
    verification_triggers = {'id_document_url', 'experience_text', 'experience_photo_url', 'profile_photo_url'}
    if verification_triggers & set(data.keys()):
        if sp.verification_status in ('draft', 'rejected'):
            sp.verification_status = 'submitted'
            sp.submitted_at = datetime.utcnow()

    # Apply same profile fields to all other ServiceProvider rows for this user
    # (one user can have multiple rows, one per service offered)
    siblings = ServiceProvider.query.filter(
        ServiceProvider.user_id == sp.user_id,
        ServiceProvider.id != sp.id,
    ).all()
    for sib in siblings:
        for field in str_fields:
            if field in data:
                setattr(sib, field, getattr(sp, field))
        if verification_triggers & set(data.keys()):
            if sib.verification_status in ('draft', 'rejected'):
                sib.verification_status = sp.verification_status
                sib.submitted_at = sp.submitted_at

    db.session.commit()

    return jsonify({
        'success': True,
        'provider': {
            'id': sp.id,
            'bio': sp.bio,
            'profile_photo_url': sp.profile_photo_url,
            'id_document_url': sp.id_document_url,
            'experience_text': sp.experience_text,
            'experience_photo_url': sp.experience_photo_url,
            'mobile_money_number': sp.mobile_money_number,
            'mobile_money_name': sp.mobile_money_name,
            'mobile_money_operator': sp.mobile_money_operator,
            'verification_status': sp.verification_status,
            'submitted_at': sp.submitted_at.isoformat() if sp.submitted_at else None,
        }
    })


@provider_bp.route('/availability', methods=['PATCH'])
@require_provider_token
def update_provider_availability():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    provider_id = payload.get('provider_id')

    sp = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json() or {}

    if 'available_today' not in data:
        return jsonify({'error': 'available_today is required'}), 400

    available = bool(data['available_today'])
    sp.available_today = available

    # Sync to all ServiceProvider rows for this user so every service reflects the same flag
    siblings = ServiceProvider.query.filter(
        ServiceProvider.user_id == sp.user_id,
        ServiceProvider.id != sp.id,
    ).all()
    for sib in siblings:
        sib.available_today = available

    db.session.commit()
    return jsonify({'success': True, 'available_today': sp.available_today})


@admin_bp.route('/waitlist', methods=['GET'])
@require_admin_token
def get_waitlist():
    rows = (
        db.session.query(Waitlist.commune, func.count(Waitlist.id).label("count"))
        .group_by(Waitlist.commune)
        .order_by(func.count(Waitlist.id).desc())
        .all()
    )
    result = []
    for commune, count in rows:
        phones = [
            w.phone for w in
            Waitlist.query.filter_by(commune=commune).order_by(Waitlist.created_at.desc()).all()
        ]
        result.append({"commune": commune, "count": count, "phones": phones})
    return jsonify({"waitlist": result, "total": sum(r["count"] for r in result)})


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


# ── Client Blueprint ───────────────────────────────────────────────────────────

client_bp = Blueprint('client', __name__)


@client_bp.route('/register', methods=['POST'])
def client_register():
    """Register a new client (individual or company). Returns JWT client_token."""
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    phone = (data.get('phone') or '').strip()
    password = data.get('password', '')
    account_type = (data.get('account_type') or 'individual').strip()
    company_name = (data.get('company_name') or '').strip() or None

    if not full_name or not phone or not password:
        return jsonify({'error': 'full_name, phone, and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'password must be at least 6 characters'}), 400
    if account_type == 'company' and not company_name:
        return jsonify({'error': 'company_name is required for company accounts'}), 400

    synthetic_email = f"{phone.replace(' ', '').replace('+', '')}@client.shizu.ci"
    if User.query.filter_by(email=synthetic_email).first():
        return jsonify({'error': 'A client with this phone number already exists'}), 409

    user = User(
        email=synthetic_email,
        user_type='client',
        preferred_language='fr',
        account_type=account_type,
        company_name=company_name,
        full_name=full_name,
        phone=phone,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = jwt.encode({
        'sub': str(user.id),
        'type': 'client',
        'client_id': user.id,
        'name': full_name,
        'phone': phone,
        'account_type': account_type,
        'company_name': company_name,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=30),
    }, current_app.config['SECRET_KEY'], algorithm='HS256')

    return jsonify({
        'success': True,
        'token': token,
        'client': {
            'id': user.id,
            'name': full_name,
            'phone': phone,
            'account_type': account_type,
            'company_name': company_name,
        },
    }), 201


def require_client_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            if payload.get('type') != 'client':
                return jsonify({'error': 'Invalid token type'}), 401
            g.client_phone = payload.get('phone', '')
            g.client_id    = payload.get('client_id')
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


@client_bp.route('/login', methods=['POST'])
def client_login():
    """Authenticate a client by phone + password. Returns JWT client_token."""
    data     = request.get_json() or {}
    phone    = (data.get('phone') or '').strip()
    password = data.get('password', '')

    if not phone or not password:
        return jsonify({'error': 'phone and password are required'}), 400

    synthetic_email = f"{phone.replace(' ', '').replace('+', '')}@client.shizu.ci"
    user = User.query.filter_by(email=synthetic_email, user_type='client').first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Numéro de téléphone ou mot de passe invalide.'}), 401

    token = jwt.encode({
        'sub': str(user.id),
        'type': 'client',
        'client_id': user.id,
        'name': user.full_name,
        'phone': user.phone,
        'account_type': user.account_type,
        'company_name': user.company_name,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=30),
    }, current_app.config['SECRET_KEY'], algorithm='HS256')

    return jsonify({
        'success': True,
        'token': token,
        'client': {
            'id': user.id,
            'name': user.full_name,
            'phone': user.phone,
            'account_type': user.account_type,
            'company_name': user.company_name,
        },
    }), 200


@client_bp.route('/bookings', methods=['GET'])
@require_client_token
def get_client_bookings():
    """Return all bookings for the authenticated client (matched by phone)."""
    phone  = g.client_phone
    status = request.args.get('status')
    limit  = min(int(request.args.get('limit', 50)), 200)

    query = ClientBooking.query.filter_by(client_phone=phone)
    if status:
        if status not in ['requested', 'accepted', 'declined', 'in_progress',
                          'completed', 'cancelled', 'disputed']:
            return jsonify({'error': 'Invalid status'}), 400
        query = query.filter_by(status=status)

    bookings = query.order_by(ClientBooking.appointment_date.desc()).limit(limit).all()
    return jsonify({'count': len(bookings), 'items': [b.to_dict() for b in bookings]}), 200
