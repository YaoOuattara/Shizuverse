from flask import Blueprint, request, jsonify, current_app, g
from functools import wraps
from datetime import datetime
import jwt as pyjwt
from shizuverse.models import db, User, ServiceProvider, ClientBooking, Notification
from shizuverse.models.booking_event import BookingEvent
from shizuverse.models.service_models import Service
from shizuverse.models.review import Review

admin_bp = Blueprint('admin_portal', __name__, url_prefix='/admin')

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        token = auth_header[7:]
        try:
            payload = pyjwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            g.admin_payload = payload
        except pyjwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


# ── Provider Applications ─────────────────────────────────────

@admin_bp.route('/providers/applications', methods=['GET'])
@admin_required
def get_applications():
    """All providers with verification_status = submitted, oldest first."""
    providers = ServiceProvider.query.filter_by(
        verification_status='submitted'
    ).order_by(ServiceProvider.submitted_at.asc()).all()

    return jsonify([{
        'id': p.id,
        'user_id': p.user_id,
        'company_name': p.company_name,
        'phone_number': p.phone_number,
        'bio': p.bio,
        'verified': p.verified,
        'verification_status': p.verification_status,
        'listed_status': p.listed_status,
        'provider_status': p.provider_status,
        'submitted_at': p.submitted_at.isoformat() if p.submitted_at else None,
        'created_at': p.created_at.isoformat() if p.created_at else None,
    } for p in providers])


@admin_bp.route('/providers/<int:provider_id>', methods=['GET'])
@admin_required
def get_provider_detail(provider_id):
    """Full provider profile for review."""
    p = ServiceProvider.query.get_or_404(provider_id)
    user = User.query.get(p.user_id)
    return jsonify({
        'id': p.id,
        'user_id': p.user_id,
        'email': user.email if user else None,
        'company_name': p.company_name,
        'phone_number': p.phone_number,
        'address': p.address,
        'bio': p.bio,
        'profile_picture': p.profile_picture,
        'verified': p.verified,
        'verification_status': p.verification_status,
        'listed_status': p.listed_status,
        'provider_status': p.provider_status,
        'rejection_reason': p.rejection_reason,
        'rejection_note': p.rejection_note,
        'submitted_at': p.submitted_at.isoformat() if p.submitted_at else None,
        'reviewed_at': p.reviewed_at.isoformat() if p.reviewed_at else None,
        'reviewed_by': p.reviewed_by,
        'created_at': p.created_at.isoformat() if p.created_at else None,
    })


@admin_bp.route('/providers/<int:provider_id>/approve', methods=['POST'])
@admin_required
def approve_provider(provider_id):
    """Approve a provider. Sets all 3 status fields and notifies. Beauty providers require id_document_url."""
    p = ServiceProvider.query.get_or_404(provider_id)
    if p.verification_status != 'submitted':
        return jsonify({'error': 'Provider is not in submitted state'}), 400

    # Beauty gate: check if any service contains "beaut" and require ID document
    all_rows = ServiceProvider.query.filter_by(user_id=p.user_id).all()
    services = []
    for row in all_rows:
        svc = Service.query.get(row.service_id) if row.service_id else None
        if svc:
            services.append(svc.name)
    is_beauty = any('beaut' in s.lower() for s in services)
    if is_beauty and not p.id_document_url:
        return jsonify({'error': 'Les prestataires beauté doivent télécharger une pièce d\'identité avant approbation.'}), 422

    p.verification_status = 'approved'
    p.listed_status = 'listed'
    p.provider_status = 'active'
    p.verified = True
    p.reviewed_at = datetime.utcnow()
    p.reviewed_by = None

    notification = Notification(
        user_id=p.user_id,
        type='provider_approved',
        content='Your profile has been approved. You are now listed on Shizu.'
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify({'message': 'Provider approved', 'provider_id': provider_id})


@admin_bp.route('/providers/<int:provider_id>/reject', methods=['POST'])
@admin_required
def reject_provider(provider_id):
    """Reject a provider with a required reason."""
    p = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json()
    reason = data.get('reason', '').strip()
    note = data.get('note', '').strip()

    if not reason:
        return jsonify({'error': 'Rejection reason is required'}), 400

    p.verification_status = 'rejected'
    p.rejection_reason = reason
    p.rejection_note = note if note else None
    p.reviewed_at = datetime.utcnow()
    p.reviewed_by = None

    notification = Notification(
        user_id=p.user_id,
        type='provider_rejected',
        content=f'Your application was not approved. Reason: {reason}'
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify({'message': 'Provider rejected', 'provider_id': provider_id})


@admin_bp.route('/providers/<int:provider_id>/suspend', methods=['POST'])
@admin_required
def suspend_provider(provider_id):
    p = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json()
    reason = data.get('reason', '').strip()

    p.verification_status = 'suspended'
    p.listed_status = 'unlisted'
    p.provider_status = 'paused'

    notification = Notification(
        user_id=p.user_id,
        type='provider_suspended',
        content=f'Your account has been suspended. Reason: {reason}' if reason else 'Your account has been suspended by an administrator.'
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify({'message': 'Provider suspended', 'provider_id': provider_id})


@admin_bp.route('/providers/<int:provider_id>/reinstate', methods=['POST'])
@admin_required
def reinstate_provider(provider_id):
    p = ServiceProvider.query.get_or_404(provider_id)
    p.verification_status = 'approved'
    p.listed_status = 'listed'
    p.provider_status = 'active'

    notification = Notification(
        user_id=p.user_id,
        type='provider_reinstated',
        content='Your account has been reinstated. You are now listed on Shizu.'
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify({'message': 'Provider reinstated', 'provider_id': provider_id})


@admin_bp.route('/providers/<int:provider_id>/listing', methods=['POST'])
@admin_required
def toggle_listing(provider_id):
    p = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json()
    action = data.get('action')

    if action not in ('list', 'unlist'):
        return jsonify({'error': 'action must be list or unlist'}), 400
    if p.verification_status != 'approved':
        return jsonify({'error': 'Provider must be approved to change listing'}), 400

    p.listed_status = 'listed' if action == 'list' else 'unlisted'
    db.session.commit()

    return jsonify({'message': f'Provider {action}ed', 'listed_status': p.listed_status})


@admin_bp.route('/providers/<int:provider_id>/activation', methods=['POST'])
@admin_required
def toggle_activation(provider_id):
    p = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json()
    action = data.get('action')

    if action not in ('activate', 'pause'):
        return jsonify({'error': 'action must be activate or pause'}), 400

    p.provider_status = 'active' if action == 'activate' else 'paused'
    db.session.commit()

    return jsonify({'message': f'Provider {action}d', 'provider_status': p.provider_status})


# ── Provider Service List Edit ────────────────────────────────

@admin_bp.route('/providers/<int:provider_id>/services', methods=['PATCH'])
@admin_required
def update_provider_services(provider_id):
    """Replace a provider's service list. Accepts {services: [name, ...]}."""
    data = request.get_json() or {}
    new_names = [s.strip() for s in (data.get('services') or []) if s.strip()]

    canonical = ServiceProvider.query.get_or_404(provider_id)
    user_id = canonical.user_id

    existing_rows = ServiceProvider.query.filter_by(user_id=user_id).all()
    existing_by_svc_id = {row.service_id: row for row in existing_rows}

    # Resolve names → service IDs (case-insensitive)
    new_svc_ids = set()
    for name in new_names:
        svc = Service.query.filter(Service.name.ilike(name)).first()
        if svc:
            new_svc_ids.add(svc.id)

    # Remove rows whose service is no longer in the list
    for svc_id, row in list(existing_by_svc_id.items()):
        if svc_id not in new_svc_ids:
            db.session.delete(row)

    # Add rows for newly added services
    for svc_id in new_svc_ids:
        if svc_id not in existing_by_svc_id:
            db.session.add(ServiceProvider(
                user_id=user_id,
                service_id=svc_id,
                company_name=canonical.company_name,
                phone_number=canonical.phone_number,
                bio=canonical.bio,
                address=canonical.address,
                verified=canonical.verified,
                verification_status=canonical.verification_status,
                account_type=getattr(canonical, 'account_type', None),
            ))

    db.session.commit()

    updated = ServiceProvider.query.filter_by(user_id=user_id).all()
    services = [row.service.name for row in updated if row.service]
    return jsonify({'success': True, 'services': services})


@admin_bp.route('/providers/<int:provider_id>/zones', methods=['PATCH'])
@admin_required
def update_provider_zones(provider_id):
    """Replace a provider's service zones. Accepts {zones: ["Cocody", "Plateau", ...]}."""
    data = request.get_json() or {}
    zones = [str(z).strip() for z in (data.get('zones') or []) if str(z).strip()]
    zones_str = ', '.join(zones) if zones else None

    sp = ServiceProvider.query.get_or_404(provider_id)
    # Apply to all ServiceProvider rows for this user so zones stay in sync
    all_rows = ServiceProvider.query.filter_by(user_id=sp.user_id).all()
    for row in all_rows:
        row.address = zones_str
    db.session.commit()

    return jsonify({'success': True, 'zones': zones, 'provider_id': provider_id})


# ── Provider Directory ────────────────────────────────────────

@admin_bp.route('/providers', methods=['GET'])
@admin_required
def get_all_providers():
    """Full provider list, deduplicated by user_id, with services and all profile fields."""
    q = ServiceProvider.query

    v = request.args.get('verification_status')
    l = request.args.get('listed_status')
    s = request.args.get('provider_status')

    if v: q = q.filter_by(verification_status=v)
    if l: q = q.filter_by(listed_status=l)
    if s: q = q.filter_by(provider_status=s)

    all_rows = q.order_by(ServiceProvider.created_at.desc()).all()

    # Deduplicate by user_id: keep first (most recent) row as canonical, collect all service names
    seen = {}  # user_id -> {'row': ..., 'user': ..., 'services': [...]}
    for row in all_rows:
        if row.user_id not in seen:
            user = User.query.get(row.user_id)
            svc = Service.query.get(row.service_id) if row.service_id else None
            seen[row.user_id] = {
                'row': row,
                'user': user,
                'services': [svc.name] if svc else [],
            }
        else:
            svc = Service.query.get(row.service_id) if row.service_id else None
            if svc and svc.name not in seen[row.user_id]['services']:
                seen[row.user_id]['services'].append(svc.name)

    result = []
    for data in seen.values():
        p = data['row']
        user = data['user']
        result.append({
            'id': p.id,
            'user_id': p.user_id,
            'company_name': p.company_name,
            'phone_number': p.phone_number,
            'email': user.email if user else None,
            'bio': p.bio,
            'address': p.address,
            'zones': [z.strip() for z in p.address.split(',') if z.strip()] if p.address else [],
            'verification_status': p.verification_status,
            'listed_status': p.listed_status,
            'provider_status': p.provider_status,
            'verified': p.verified,
            'rejection_reason': p.rejection_reason,
            'rejection_note': p.rejection_note,
            'reviewed_at': p.reviewed_at.isoformat() if p.reviewed_at else None,
            'submitted_at': p.submitted_at.isoformat() if p.submitted_at else None,
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'services': data['services'],
            'id_document_url': p.id_document_url,
        })

    return jsonify(result)


# ── Bookings ──────────────────────────────────────────────────

@admin_bp.route('/bookings', methods=['GET'])
@admin_required
def get_all_bookings():
    """Full booking list with optional status filters."""
    q = ClientBooking.query

    status = request.args.get('status')
    payment = request.args.get('payment_status')
    payout = request.args.get('payout_status')

    if status: q = q.filter_by(status=status)
    if payment: q = q.filter_by(payment_status=payment)
    if payout: q = q.filter_by(payout_status=payout)

    bookings = q.order_by(ClientBooking.created_at.desc()).all()
    return jsonify([b.to_dict() for b in bookings])


@admin_bp.route('/bookings/<int:booking_id>', methods=['GET'])
@admin_required
def get_booking_detail(booking_id):
    b = ClientBooking.query.get_or_404(booking_id)
    events = BookingEvent.query.filter_by(booking_id=booking_id).order_by(BookingEvent.created_at.asc()).all()
    data = b.to_dict()
    data['events'] = [{
        'id': e.id,
        'event_type': e.event_type,
        'from_status': e.from_status,
        'to_status': e.to_status,
        'actor_phone': e.actor_phone,
        'note': e.note,
        'created_at': e.created_at.isoformat()
    } for e in events]
    return jsonify(data)


@admin_bp.route('/bookings/<int:booking_id>/quote', methods=['POST'])
@admin_required
def set_booking_quote(booking_id):
    """Store a quoted price on the booking (sets amount_xof)."""
    b = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json() or {}
    amount = data.get('amount_xof')
    if amount is None or not isinstance(amount, (int, float)) or int(amount) <= 0:
        return jsonify({'error': 'amount_xof must be a positive number'}), 400
    b.amount_xof = int(amount)
    db.session.commit()
    return jsonify({'success': True, 'id': b.id, 'amount_xof': b.amount_xof})


@admin_bp.route('/bookings/<int:booking_id>/cancel', methods=['POST'])
@admin_required
def cancel_booking(booking_id):
    b = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json()

    if b.status in ('completed', 'cancelled', 'declined'):
        return jsonify({'error': f'Cannot cancel a booking with status {b.status}'}), 400

    reason = data.get('reason', '').strip()
    prev_status = b.status
    b.status = 'cancelled'
    b.cancellation_reason = reason if reason else None

    event = BookingEvent(
        booking_id=b.id,
        event_type='admin_cancel',
        from_status=prev_status,
        to_status='cancelled',
        actor_id=None,
        note=reason if reason else None
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({'message': 'Booking cancelled', 'booking_id': booking_id})


@admin_bp.route('/bookings/<int:booking_id>/finance', methods=['POST'])
@admin_required
def update_finance(booking_id):
    """Update payment_status, payout_status, and/or record final_amount with commission breakdown."""
    b = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json()

    payment = data.get('payment_status')
    payout = data.get('payout_status')
    final_amount = data.get('final_amount')

    valid_payment = ('unpaid', 'pending', 'paid', 'refunded')
    valid_payout = ('not_due', 'due', 'sent', 'failed')

    if payment and payment not in valid_payment:
        return jsonify({'error': f'Invalid payment_status: {payment}'}), 400
    if payout and payout not in valid_payout:
        return jsonify({'error': f'Invalid payout_status: {payout}'}), 400
    if payout == 'due' and b.payment_status != 'paid':
        return jsonify({'error': 'Cannot set payout to due until payment_status is paid'}), 400

    if final_amount is not None:
        fa = int(final_amount)
        b.final_amount = fa
        b.shizu_commission = round(fa * 0.15)
        b.provider_payout = fa - b.shizu_commission

    if payment:
        b.payment_status = payment
    if payout:
        b.payout_status = payout

    db.session.commit()
    return jsonify({
        'message': 'Finance status updated',
        'payment_status': b.payment_status,
        'payout_status': b.payout_status,
        'final_amount': b.final_amount,
        'shizu_commission': b.shizu_commission,
        'provider_payout': b.provider_payout,
    })


@admin_bp.route('/bookings/<int:booking_id>/dispute', methods=['POST'])
@admin_required
def resolve_dispute(booking_id):
    b = ClientBooking.query.get_or_404(booking_id)
    if b.status != 'disputed':
        return jsonify({'error': 'Booking is not in disputed state'}), 400

    data = request.get_json()
    resolution = data.get('resolution')

    if resolution not in ('complete', 'cancel'):
        return jsonify({'error': 'resolution must be complete or cancel'}), 400

    prev_status = b.status
    if resolution == 'complete':
        b.status = 'completed'
        if b.payment_status == 'paid':
            b.payout_status = 'due'
        note = 'Dispute resolved in provider favour'
    else:
        b.status = 'cancelled'
        if b.payment_status == 'paid':
            b.payment_status = 'refunded'
        note = 'Dispute resolved in client favour'

    event = BookingEvent(
        booking_id=b.id,
        event_type='dispute_resolved',
        from_status=prev_status,
        to_status=b.status,
        actor_id=None,
        note=note
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({'message': f'Dispute resolved: {resolution}', 'booking_id': booking_id})


# ── Finance Overview ──────────────────────────────────────────

# ── Reviews ───────────────────────────────────────────────────

@admin_bp.route('/reviews', methods=['GET'])
@admin_required
def get_all_reviews():
    """All reviews. Optional ?status=published|hidden|flagged filter."""
    status = request.args.get('status')

    q = Review.query
    # DB moderation_status values: 'pending' (default), 'approved', 'rejected', 'flagged'
    # Frontend display_status: 'published' = pending|approved, 'hidden' = rejected, 'flagged' = flagged
    if status == 'published':
        q = q.filter(Review.moderation_status.in_(['pending', 'approved']))
    elif status == 'hidden':
        q = q.filter_by(moderation_status='rejected')
    elif status == 'flagged':
        q = q.filter_by(moderation_status='flagged')

    reviews = q.order_by(Review.created_at.desc()).all()

    result = []
    for r in reviews:
        sp = ServiceProvider.query.get(r.provider_id) if r.provider_id else None
        ms = r.moderation_status
        display = 'flagged' if ms == 'flagged' else ('hidden' if ms == 'rejected' else 'published')
        result.append({
            'id': r.id,
            'booking_id': r.booking_id,
            'client_name': r.client_name,
            'rating': r.rating,
            'text': r.text or '',
            'service_slug': r.service_slug,
            'provider_name': sp.company_name if sp else '',
            'provider_id': r.provider_id,
            'moderation_status': ms,
            'display_status': display,
            'created_at': r.created_at.isoformat() if r.created_at else '',
        })

    return jsonify(result)


@admin_bp.route('/reviews/<int:review_id>/moderate', methods=['POST'])
@admin_required
def moderate_review(review_id):
    """Set review moderation status. Body: { status: published|hidden|flagged, reason?: str }"""
    r = Review.query.get_or_404(review_id)
    data = request.get_json() or {}
    status = data.get('status', '').strip()

    STATUS_MAP = {'published': 'approved', 'hidden': 'rejected', 'flagged': 'flagged'}
    if status not in STATUS_MAP:
        return jsonify({'error': f'Invalid status. Use: {list(STATUS_MAP.keys())}'}), 400

    r.moderation_status = STATUS_MAP[status]
    db.session.commit()

    return jsonify({'success': True, 'id': r.id, 'display_status': status, 'moderation_status': r.moderation_status})


# ── Dashboard Overview ────────────────────────────────────────

@admin_bp.route('/overview', methods=['GET'])
@admin_required
def get_overview():
    """Single endpoint for all dashboard KPIs.

    For bookings paid before the final_amount column existed, falls back to
    amount_xof (the quoted price) so legacy paid bookings are counted in GMV.
    Commission and payout are similarly computed from amount_xof when the
    stored columns are null.
    """
    from sqlalchemy import func
    from datetime import datetime

    now = datetime.utcnow()
    first_of_month = datetime(now.year, now.month, 1)

    # Effective per-row amount: prefer final_amount, fall back to amount_xof.
    # All columns are Integer so arithmetic stays integer (no ROUND/NUMERIC needed).
    eff_amt = func.coalesce(
        ClientBooking.final_amount,
        ClientBooking.amount_xof,
        0
    )
    # 15% commission using integer arithmetic (truncates, fine for FCFA integers)
    eff_commission = func.coalesce(
        ClientBooking.shizu_commission,
        eff_amt * 15 / 100
    )
    # 85% payout = amount − 15% commission
    eff_payout = func.coalesce(
        ClientBooking.provider_payout,
        eff_amt - eff_amt * 15 / 100
    )

    # ── GMV ───────────────────────────────────────────────────
    gmv_total = db.session.query(
        func.coalesce(func.sum(eff_amt), 0)
    ).filter(ClientBooking.payment_status == 'paid').scalar()

    gmv_month = db.session.query(
        func.coalesce(func.sum(eff_amt), 0)
    ).filter(
        ClientBooking.payment_status == 'paid',
        ClientBooking.created_at >= first_of_month
    ).scalar()

    # ── Revenue Shizu (15% commission) ────────────────────────
    revenue_shizu = db.session.query(
        func.coalesce(func.sum(eff_commission), 0)
    ).filter(ClientBooking.payment_status == 'paid').scalar()

    # ── Provider payouts ──────────────────────────────────────
    payouts_due = db.session.query(
        func.coalesce(func.sum(eff_payout), 0)
    ).filter(
        ClientBooking.payment_status == 'paid',
        ClientBooking.payout_status != 'sent'
    ).scalar()

    payouts_sent = db.session.query(
        func.coalesce(func.sum(eff_payout), 0)
    ).filter(ClientBooking.payout_status == 'sent').scalar()

    # ── Booking counts ────────────────────────────────────────
    total_bookings     = db.session.query(func.count(ClientBooking.id)).scalar()
    completed_bookings = db.session.query(func.count(ClientBooking.id)).filter(ClientBooking.status == 'completed').scalar()
    cancelled_bookings = db.session.query(func.count(ClientBooking.id)).filter(ClientBooking.status == 'cancelled').scalar()
    pending_bookings   = db.session.query(func.count(ClientBooking.id)).filter(ClientBooking.status.in_(['pending', 'under_review', 'requested'])).scalar()
    confirmed_bookings = db.session.query(func.count(ClientBooking.id)).filter(ClientBooking.status.in_(['confirmed', 'assigned', 'accepted', 'in_progress'])).scalar()

    # Completion rate: completed / (total − cancelled)
    denominator = (total_bookings or 0) - (cancelled_bookings or 0)
    completion_rate = round((completed_bookings / denominator * 100), 1) if denominator > 0 else 0.0

    # ── Active providers (distinct users) ─────────────────────
    active_providers = db.session.query(ServiceProvider.user_id).filter(
        ServiceProvider.verification_status == 'approved',
        ServiceProvider.provider_status == 'active'
    ).distinct().count()

    return jsonify({
        'gmv_total':          int(gmv_total),
        'gmv_month':          int(gmv_month),
        'revenue_shizu':      int(revenue_shizu),
        'payouts_due':        int(payouts_due),
        'payouts_sent':       int(payouts_sent),
        'total_bookings':     total_bookings,
        'completed_bookings': completed_bookings,
        'cancelled_bookings': cancelled_bookings,
        'pending_bookings':   pending_bookings,
        'confirmed_bookings': confirmed_bookings,
        'completion_rate':    completion_rate,
        'active_providers':   active_providers,
    })


# ── Finance Overview ──────────────────────────────────────────

@admin_bp.route('/finance/summary', methods=['GET'])
@admin_required
def finance_summary():
    from sqlalchemy import func
    eff_amt = func.coalesce(ClientBooking.final_amount, ClientBooking.amount_xof, 0)
    completed   = db.session.query(func.count(ClientBooking.id)).filter_by(status='completed').scalar()
    total_paid  = db.session.query(func.coalesce(func.sum(eff_amt), 0)).filter(ClientBooking.payment_status == 'paid').scalar()
    payouts_due_count = db.session.query(func.count(ClientBooking.id)).filter_by(payout_status='due').scalar()
    payouts_due_value = db.session.query(func.coalesce(func.sum(eff_amt), 0)).filter(ClientBooking.payout_status == 'due').scalar()
    failed_payouts = db.session.query(func.count(ClientBooking.id)).filter_by(payout_status='failed').scalar()
    unpaid_completed = db.session.query(func.count(ClientBooking.id)).filter_by(status='completed', payment_status='unpaid').scalar()

    return jsonify({
        'completed_bookings': completed,
        'total_paid_xof': int(total_paid),
        'payouts_due_count': payouts_due_count,
        'payouts_due_value_xof': int(payouts_due_value),
        'failed_payouts': failed_payouts,
        'unpaid_completed_bookings': unpaid_completed,
    })
