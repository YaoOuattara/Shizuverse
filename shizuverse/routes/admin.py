from flask import Blueprint, request, jsonify, current_app, g
from functools import wraps
from datetime import datetime
import jwt as pyjwt
from shizuverse.models import db, User, ServiceProvider, ClientBooking, Notification
from shizuverse.models.client_booking import VALID_PAYMENT_STATUSES
from shizuverse.models.booking_event import BookingEvent
from shizuverse.models.service_models import Service
from shizuverse.models.review import Review
from shizuverse.limiter import limiter
from shizuverse.utils.booking_ref import booking_ref as make_booking_ref

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
        except pyjwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        # A valid signature is not proof of admin rights: client/provider tokens
        # are signed with the same SECRET_KEY. Admin tokens carry sub='admin'
        # and no 'type'; reject anything else.
        if payload.get('sub') != 'admin' or payload.get('type') is not None:
            return jsonify({'error': 'Forbidden'}), 403
        g.admin_payload = payload
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
        # Review documents — needed to decide Gate 3 / Gate 5 with the proof in view.
        'profile_photo_url': p.profile_photo_url,
        'experience_photo_url': p.experience_photo_url,
        'experience_text': p.experience_text,
        'id_document_url': p.id_document_url,
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


def _sync_provider_rows(user_id, **fields):
    """Apply status fields to ALL ServiceProvider rows of a user.

    A provider has one row per service offered; verification / listing /
    activation must stay consistent across them (same principle already used by
    update_provider_profile and update_provider_availability). Approving/rejecting
    only the clicked row left the sibling service rows out of sync.
    """
    rows = ServiceProvider.query.filter_by(user_id=user_id).all()
    for row in rows:
        for key, value in fields.items():
            setattr(row, key, value)
    return rows


@admin_bp.route('/providers/<int:provider_id>/approve', methods=['POST'])
@limiter.limit("20 per minute")
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

    _sync_provider_rows(
        p.user_id,
        verification_status='approved',
        listed_status='listed',
        provider_status='active',
        verified=True,
        reviewed_at=datetime.utcnow(),
        reviewed_by=None,
    )

    notification = Notification(
        user_id=p.user_id,
        type='provider_approved',
        content='Your profile has been approved. You are now listed on Shizu.'
    )
    db.session.add(notification)
    db.session.commit()

    # WhatsApp: congratulate the provider
    try:
        from shizuverse.utils.notifications import notify_provider_approved
        if p.phone_number:
            notify_provider_approved(
                provider_phone=p.phone_number,
                provider_name=p.company_name or 'prestataire',
                approved_date=datetime.utcnow().strftime('%d/%m/%Y'),
            )
    except Exception as e:
        current_app.logger.error(f"[approve_provider] Unexpected error: {e}", exc_info=True)

    return jsonify({'message': 'Provider approved', 'provider_id': provider_id})


@admin_bp.route('/providers/<int:provider_id>/reject', methods=['POST'])
@limiter.limit("20 per minute")
@admin_required
def reject_provider(provider_id):
    """Reject a provider with a required reason."""
    p = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json()
    reason = data.get('reason', '').strip()
    note = data.get('note', '').strip()

    if not reason:
        return jsonify({'error': 'Rejection reason is required'}), 400

    _sync_provider_rows(
        p.user_id,
        verification_status='rejected',
        rejection_reason=reason,
        rejection_note=note if note else None,
        reviewed_at=datetime.utcnow(),
        reviewed_by=None,
    )

    notification = Notification(
        user_id=p.user_id,
        type='provider_rejected',
        content=f'Your application was not approved. Reason: {reason}'
    )
    db.session.add(notification)
    db.session.commit()

    # WhatsApp: inform provider of rejection with reason
    try:
        from shizuverse.utils.notifications import notify_provider_rejected
        if p.phone_number:
            notify_provider_rejected(
                provider_phone=p.phone_number,
                reason=reason,
            )
    except Exception as e:
        current_app.logger.error(f"[reject_provider] Unexpected error: {e}", exc_info=True)

    return jsonify({'message': 'Provider rejected', 'provider_id': provider_id})


@admin_bp.route('/providers/<int:provider_id>/suspend', methods=['POST'])
@limiter.limit("20 per minute")
@admin_required
def suspend_provider(provider_id):
    p = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json()
    reason = data.get('reason', '').strip()

    _sync_provider_rows(
        p.user_id,
        verification_status='suspended',
        listed_status='unlisted',
        provider_status='paused',
    )

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
    _sync_provider_rows(
        p.user_id,
        verification_status='approved',
        listed_status='listed',
        provider_status='active',
    )

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

    new_listed = 'listed' if action == 'list' else 'unlisted'
    _sync_provider_rows(p.user_id, listed_status=new_listed)
    db.session.commit()

    return jsonify({'message': f'Provider {action}ed', 'listed_status': new_listed})


@admin_bp.route('/providers/<int:provider_id>/activation', methods=['POST'])
@admin_required
def toggle_activation(provider_id):
    p = ServiceProvider.query.get_or_404(provider_id)
    data = request.get_json()
    action = data.get('action')

    if action not in ('activate', 'pause'):
        return jsonify({'error': 'action must be activate or pause'}), 400

    new_status = 'active' if action == 'activate' else 'paused'
    _sync_provider_rows(p.user_id, provider_status=new_status)
    db.session.commit()

    return jsonify({'message': f'Provider {action}d', 'provider_status': new_status})


# ── Provider Service List Edit ────────────────────────────────

@admin_bp.route('/providers/<int:provider_id>/services', methods=['PATCH'])
@limiter.limit("20 per minute")
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

    # Add rows for newly added services — FULL copy of the canonical row.
    # A partial copy left new rows with column defaults (listed_status
    # 'unlisted', provider_status 'paused', no momo/docs/rates): an approved &
    # listed provider gaining a service ended up with a mismatched sibling
    # (T-20: status and profile are per PERSON, not per service line).
    for svc_id in new_svc_ids:
        if svc_id not in existing_by_svc_id:
            db.session.add(ServiceProvider(
                user_id=user_id,
                service_id=svc_id,
                # Profile
                company_name=canonical.company_name,
                phone_number=canonical.phone_number,
                bio=canonical.bio,
                address=canonical.address,
                account_type=getattr(canonical, 'account_type', None),
                rccm_number=canonical.rccm_number,
                profile_picture=canonical.profile_picture,
                profile_photo_url=canonical.profile_photo_url,
                id_document_url=canonical.id_document_url,
                experience_text=canonical.experience_text,
                experience_photo_url=canonical.experience_photo_url,
                mobile_money_number=canonical.mobile_money_number,
                mobile_money_name=canonical.mobile_money_name,
                mobile_money_operator=canonical.mobile_money_operator,
                service_rates=canonical.service_rates,
                # Status (person-level)
                verified=canonical.verified,
                verification_status=canonical.verification_status,
                listed_status=canonical.listed_status,
                provider_status=canonical.provider_status,
                submitted_at=canonical.submitted_at,
                reviewed_at=canonical.reviewed_at,
                reviewed_by=canonical.reviewed_by,
                available_today=canonical.available_today,
            ))

    db.session.commit()

    updated = ServiceProvider.query.filter_by(user_id=user_id).all()
    services = [row.service.name for row in updated if row.service]
    return jsonify({'success': True, 'services': services})


@admin_bp.route('/providers/<int:provider_id>/zones', methods=['PATCH'])
@limiter.limit("20 per minute")
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
            # Provider-DECLARED rates (T-14: not Shizu pricing). Same value on
            # every row of the provider, so the canonical row carries it.
            'service_rates': p.service_rates,
            'id_document_url': p.id_document_url,
            # Review documents — the admin must SEE the capability proof (Gate 3)
            # and the profile photo, not just the ID. These were missing.
            'profile_photo_url': p.profile_photo_url,
            'experience_photo_url': p.experience_photo_url,
            'experience_text': p.experience_text,
        })

    return jsonify(result)


# ── Bookings ──────────────────────────────────────────────────

@admin_bp.route('/bookings', methods=['GET'])
@admin_required
def get_all_bookings():
    """Full booking list with optional status filters."""
    q = ClientBooking.query

    status = request.args.get('status')
    payment = request.args.get('payment_status')       # dossier flag: open|pending|refunded
    payout = request.args.get('payout_status')
    collection = request.args.get('collection_status')  # derived: unpaid|partial|paid

    if status: q = q.filter_by(status=status)
    if payment: q = q.filter_by(payment_status=payment)
    if payout: q = q.filter_by(payout_status=payout)
    if collection:
        from sqlalchemy import func
        due = func.coalesce(ClientBooking.final_amount, ClientBooking.amount_xof, 0)
        col = func.coalesce(ClientBooking.amount_collected, 0)
        if collection == 'unpaid':
            q = q.filter(col <= 0)
        elif collection == 'paid':
            q = q.filter(col > 0, col >= due)
        elif collection == 'partial':
            q = q.filter(col > 0, col < due)

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
    # WhatsApp thread of this booking (both directions, chronological). Shipped
    # with the detail so the drawer needs no extra request. Never blocking: the
    # booking detail must still open if the messages table misbehaves.
    try:
        from shizuverse.models.whatsapp_message import WhatsAppMessage
        msgs = (WhatsAppMessage.query.filter_by(booking_id=booking_id)
                .order_by(WhatsAppMessage.received_at.asc()).all())
        data['messages'] = [m.to_dict() for m in msgs]
    except Exception as e:
        current_app.logger.error(f"[get_booking_detail] messages WhatsApp illisibles: {e}",
                                 exc_info=True)
        data['messages'] = []
    return jsonify(data)


@admin_bp.route('/messages', methods=['GET'])
@admin_required
def list_whatsapp_messages():
    """Global WhatsApp queue — the ONLY place an unattached message is visible.

    A message from an unknown number has booking_id NULL and appears in no
    drawer; without this endpoint it would be captured and then invisible,
    which is the exact failure we are fixing.

    Query params: unread=1 (unread only), unmatched=1 (booking_id NULL only),
    limit (default 100, max 500).
    """
    from shizuverse.models.whatsapp_message import WhatsAppMessage
    q = WhatsAppMessage.query
    if request.args.get('unread') in ('1', 'true'):
        q = q.filter(WhatsAppMessage.is_read.is_(False))
    if request.args.get('unmatched') in ('1', 'true'):
        q = q.filter(WhatsAppMessage.booking_id.is_(None))
    try:
        limit = min(int(request.args.get('limit', 100)), 500)
    except (TypeError, ValueError):
        limit = 100
    rows = q.order_by(WhatsAppMessage.received_at.desc()).limit(limit).all()
    unread = (WhatsAppMessage.query
              .filter(WhatsAppMessage.direction == 'inbound',
                      WhatsAppMessage.is_read.is_(False)).count())
    unmatched = (WhatsAppMessage.query
                 .filter(WhatsAppMessage.direction == 'inbound',
                         WhatsAppMessage.booking_id.is_(None)).count())
    return jsonify({
        'items': [m.to_dict() for m in rows],
        'unread_count': unread,
        'unmatched_count': unmatched,
    })


@admin_bp.route('/messages/<int:message_id>/read', methods=['PATCH'])
@admin_required
def mark_whatsapp_message_read(message_id):
    from shizuverse.models.whatsapp_message import WhatsAppMessage
    m = WhatsAppMessage.query.get_or_404(message_id)
    m.is_read = True
    db.session.commit()
    return jsonify({'id': m.id, 'is_read': m.is_read})


@admin_bp.route('/bookings/<int:booking_id>/service', methods=['PATCH'])
@admin_required
def classify_booking_service(booking_id):
    """Classify a FREE request (service_id NULL) into a real service.

    AI-suggested, admin-verified: the client submits in natural language, the
    admin picks the service here. Reclassifying an already-categorized booking
    is out of scope — refused. Assignment is blocked until this runs (guard in
    assign_booking)."""
    b = ClientBooking.query.get_or_404(booking_id)
    if b.service_id is not None:
        return jsonify({'error': "Cette réservation est déjà classée "
                                 f"({b.service_name}). Reclasser un dossier catégorisé est hors périmètre."}), 400

    data = request.get_json() or {}
    service_id = data.get('service_id')
    if not service_id:
        return jsonify({'error': 'service_id is required'}), 400
    service = Service.query.get(service_id)
    if service is None:
        return jsonify({'error': 'Service not found'}), 404

    prev_name = b.service_name
    b.service_id = service.id
    b.service_name = service.name
    # The free-entry slug ('demande') no longer describes the booking.
    b.service_slug = None

    db.session.add(BookingEvent(
        booking_id=b.id,
        event_type='service_classified',
        from_status=b.status,
        to_status=b.status,
        actor_id=None,
        note=f"Demande classée : {prev_name} → {service.name}",
    ))
    db.session.commit()

    return jsonify({
        'success': True,
        'service_id': b.service_id,
        'service_name': b.service_name,
    })


@admin_bp.route('/bookings/<int:booking_id>/quote', methods=['POST'])
@admin_required
def set_booking_quote(booking_id):
    """Store a quoted price on the booking. Recomputes payment tier and deposit amount."""
    b = ClientBooking.query.get_or_404(booking_id)
    if b.amount_locked:
        return jsonify({'error': "Devis déjà accepté et verrouillé — déverrouillage litige requis."}), 409
    data = request.get_json() or {}
    amount = data.get('amount_xof')
    if amount is None or not isinstance(amount, (int, float)) or int(amount) <= 0:
        return jsonify({'error': 'amount_xof must be a positive number'}), 400

    note = (data.get('note') or '').strip() or None

    from shizuverse.utils.payment_rules import get_payment_tier, get_deposit_amount, get_cancellation_policy
    from shizuverse.models.client_booking import ClientBooking as CB
    prior = CB.query.filter_by(client_phone=b.client_phone).count()

    amt = int(amount)
    tier = get_payment_tier(amt, prior)
    deposit = get_deposit_amount(amt, tier)

    # Estimate hours until appointment for cancellation policy
    from datetime import datetime as _dt
    hours = (b.appointment_date - _dt.utcnow()).total_seconds() / 3600 if b.appointment_date else 999
    policy = get_cancellation_policy(tier, hours)

    b.amount_xof = amt
    b.payment_tier = tier
    b.deposit_amount = deposit
    b.cancellation_policy = policy
    b.quote_note = note

    # Fresh single-use magic-link token (7 days). Regenerating on every quote
    # invalidates any previous link (e.g. after a dispute unlock + re-quote).
    import secrets
    from datetime import timedelta as _td
    b.quote_token = secrets.token_urlsafe(32)
    b.quote_token_expires_at = _dt.utcnow() + _td(days=7)
    # Do NOT touch amount_locked here: a quote never unlocks a locked amount.

    # Quoting was invisible in the history: the widest hole of the three. The
    # amount the client is ASKED to accept is the origin of the whole money
    # trail — without this event, a re-quote after a dispute unlock leaves no
    # trace of what was proposed. Raw amount, same reason as the lock events.
    db.session.add(BookingEvent(
        booking_id=b.id,
        event_type='quote_set',
        from_status=b.status,
        to_status=b.status,
        actor_id=None,
        note=f'Devis posé à {amt} XOF (palier {tier})'
             + (f' — {note}' if note else ''),
    ))
    db.session.commit()

    # WhatsApp: send the quote to the client (service + amount + tier + note + link).
    try:
        from shizuverse.utils.notifications import notify_payment_instructions
        notify_payment_instructions(
            client_name=b.client_name,
            client_phone=b.client_phone,
            booking_ref=make_booking_ref(b),
            amount=amt,
            service_name=b.service_name,
            payment_tier=tier,
            note=note,
            quote_token=b.quote_token,
            locale=b.locale,
            booking_id=b.id,
        )
    except Exception as e:
        current_app.logger.error(f"[set_booking_quote] notification error: {e}", exc_info=True)

    return jsonify({
        'success': True, 'id': b.id,
        'amount_xof': b.amount_xof,
        'payment_tier': b.payment_tier,
        'deposit_amount': b.deposit_amount,
        'cancellation_policy': b.cancellation_policy,
    })


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

    # WhatsApp: notify client + provider (if assigned) of cancellation
    try:
        from shizuverse.utils.notifications import (
            notify_booking_cancelled_client,
            notify_booking_cancelled_provider,
        )
        notify_booking_cancelled_client(
            client_name=b.client_name,
            client_phone=b.client_phone,
            booking_ref=make_booking_ref(b),
            reason=reason or '',
            locale=b.locale,
            booking_id=b.id,
        )
        if b.provider_phone:
            from shizuverse.utils.dates import format_long_date
            notify_booking_cancelled_provider(
                provider_phone=b.provider_phone,
                booking_ref=make_booking_ref(b),
                # Provider is always addressed in French (T-19).
                date=format_long_date(b.appointment_date, 'fr'),
                booking_id=b.id,
            )
    except Exception as e:
        current_app.logger.error(f"[cancel_booking] Unexpected error: {e}", exc_info=True)

    return jsonify({'message': 'Booking cancelled', 'booking_id': booking_id})


# Slot labels for reschedule notifications (client = locale, provider = FR).
_SLOT_LABELS = {
    'morning':   {'fr': 'Matin 8h–12h',     'en': 'Morning 8am–12pm'},
    'afternoon': {'fr': 'Après-midi 12h–17h','en': 'Afternoon 12pm–5pm'},
    'evening':   {'fr': 'Soir 17h–21h',      'en': 'Evening 5pm–9pm'},
    'anytime':   {'fr': 'Flexible',          'en': 'Anytime'},
}


@admin_bp.route('/bookings/<int:booking_id>/reschedule', methods=['POST'])
@admin_required
def reschedule_booking(booking_id):
    """Admin-only: move a booking to a new date/slot.

    Changes ONLY the date/slot — never the amount, amount_locked, or the
    assigned provider (a reschedule is a date change, not a re-quote). The
    lifecycle status is preserved; the reschedule is traced as a BookingEvent.
    """
    b = ClientBooking.query.get_or_404(booking_id)

    if b.status in ('completed', 'cancelled', 'declined'):
        return jsonify({'error': f"Impossible de reprogrammer une réservation « {b.status} »."}), 400

    data = request.get_json() or {}
    new_date_raw = (data.get('appointment_date') or '').strip()
    reason = (data.get('reason') or '').strip()
    new_slot = (data.get('time_slot') or data.get('time_preference') or '').strip() or None

    if not new_date_raw:
        return jsonify({'error': 'appointment_date is required (ISO 8601)'}), 400
    if not reason:
        return jsonify({'error': 'Un motif de reprogrammation est obligatoire.'}), 400

    # Parse date — strip tz so comparison with utcnow() stays naive (mirror create_booking).
    try:
        new_dt = datetime.fromisoformat(new_date_raw)
        if new_dt.tzinfo is not None:
            from datetime import timezone
            new_dt = new_dt.astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        return jsonify({'error': 'appointment_date invalide. Utilisez ISO 8601.'}), 400

    if new_dt < datetime.utcnow():
        return jsonify({'error': 'La nouvelle date doit être dans le futur.'}), 400

    old_dt = b.appointment_date
    old_str = old_dt.strftime('%d/%m/%Y %H:%M') if old_dt else '—'
    new_str = new_dt.strftime('%d/%m/%Y %H:%M')

    # Apply ONLY date/slot. Amount, amount_locked, provider untouched.
    b.appointment_date = new_dt
    if new_slot:
        b.time_slot = new_slot
        b.time_preference = new_slot

    db.session.add(BookingEvent(
        booking_id=b.id,
        event_type='rescheduled',
        from_status=b.status,
        to_status=b.status,
        actor_id=None,
        note=f"Reprogrammée : {old_str} → {new_str}"
             + (f" [{new_slot}]" if new_slot else "")
             + f" — Motif : {reason}",
    ))
    db.session.commit()

    # WhatsApp: client (locale) + provider if assigned (always FR). Never blocking.
    # The approved templates carry a LONG date ("mardi 4 août 2026") — formatted
    # through utils.dates, the single source of truth for date rendering.
    try:
        from shizuverse.utils.notifications import (
            notify_booking_rescheduled_client,
            notify_booking_rescheduled_provider,
        )
        from shizuverse.utils.dates import format_long_date
        client_slot = _SLOT_LABELS.get(new_slot, {}).get('en' if b.locale == 'en' else 'fr', '') if new_slot else ''
        notify_booking_rescheduled_client(
            client_name=b.client_name,
            client_phone=b.client_phone,
            booking_ref=make_booking_ref(b),
            new_date=format_long_date(new_dt, b.locale),
            new_slot=client_slot,
            locale=b.locale,
            booking_id=b.id,
        )
        if b.provider_phone:
            provider_slot = _SLOT_LABELS.get(new_slot, {}).get('fr', '') if new_slot else ''
            notify_booking_rescheduled_provider(
                provider_phone=b.provider_phone,
                booking_ref=make_booking_ref(b),
                new_date=format_long_date(new_dt, 'fr'),   # T-19
                new_slot=provider_slot,
                booking_id=b.id,
            )
    except Exception as e:
        current_app.logger.error(f"[reschedule_booking] notification error: {e}", exc_info=True)

    return jsonify({
        'success': True,
        'id': b.id,
        'appointment_date': b.appointment_date.isoformat(),
        'time_slot': b.time_slot,
        'status': b.status,
    })


@admin_bp.route('/bookings/<int:booking_id>/finance', methods=['POST'])
@admin_required
def update_finance(booking_id):
    """Update payment_status, payout_status, and/or record final_amount with commission breakdown."""
    b = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json()

    payment = data.get('payment_status')
    payout = data.get('payout_status')
    final_amount = data.get('final_amount')
    reason = (data.get('reason') or '').strip()

    # payment_status is a dossier flag now (open/pending/refunded). 'paid'/'unpaid'
    # are DERIVED from amount_collected and must NOT be written here — accepting
    # them would silently corrupt the flag. Money is recorded via confirm-payment.
    valid_payment = VALID_PAYMENT_STATUSES  # ('open', 'pending', 'refunded')
    valid_payout = ('not_due', 'due', 'sent', 'failed')

    if payment and payment not in valid_payment:
        return jsonify({'error': f'Invalid payment_status: {payment}. '
                                 f'Le paiement encaissé se gère via confirm-payment.'}), 400
    # 'refunded' is TERMINAL, on the a5b4cd1 model. Nothing guarded this before:
    # the write was unconditional, so a second click on "Rembourser" silently
    # rewrote the flag, and a direct call could just as silently walk it back to
    # 'open' — with no trace either way. payout_status stays editable: a refunded
    # file may still need its payout marked failed or cancelled.
    if payment and b.payment_status == 'refunded':
        return jsonify({
            'error': "Ce dossier a déjà été remboursé — le statut de paiement "
                     "n'est plus modifiable.",
            'payment_status': b.payment_status,
        }), 409
    # No refund of money never received. Booking 76 in prod showed
    # « Non payé + Remboursé » : refunded had been written on a file whose
    # amount_collected was 0. A PARTIAL refund stays possible — any collection
    # at all suffices, we never compare to the quote.
    if payment == 'refunded' and (b.amount_collected or 0) == 0:
        return jsonify({
            'error': "Rien n'a été encaissé sur ce dossier — il n'y a rien à "
                     "rembourser.",
            'amount_collected': 0,
        }), 400
    if payout and payout not in valid_payout:
        return jsonify({'error': f'Invalid payout_status: {payout}'}), 400
    # Payout can only become due once the client has FULLY paid (derived).
    if payout == 'due' and b.collection_status != 'paid':
        return jsonify({'error': 'Cannot set payout to due until the client has fully paid'}), 400
    # …and never on a refunded file. The guard above cannot catch this: a refund
    # leaves amount_collected intact (T-29), so collection_status stays 'paid'
    # and the check passes. Paying the provider while refunding the client means
    # Shizu pays twice out of its own funds.
    if payout == 'due' and b.payment_status == 'refunded':
        return jsonify({
            'error': "Ce dossier a été remboursé au client : aucun versement ne "
                     "peut lui être dû.",
            'payment_status': b.payment_status,
        }), 409

    if final_amount is not None:
        # Validate before touching the row: a non-numeric or non-positive value
        # must be a clean 400, never a 500 from int('abc').
        try:
            fa = int(final_amount)
        except (TypeError, ValueError):
            return jsonify({'error': 'final_amount must be a positive integer'}), 400
        if fa <= 0:
            return jsonify({'error': 'final_amount must be a positive integer'}), 400

        old_amount = b.final_amount
        # amount_xof is the client-accepted, locked quote. If the real amount
        # charged differs from that locked quote, an admin must justify it —
        # this is the only sanctioned way final_amount may diverge from the
        # immutable amount_xof (overrun, on-site adjustment, etc.).
        if b.amount_locked and b.amount_xof is not None and fa != b.amount_xof and not reason:
            return jsonify({
                'error': "Le montant du devis est verrouillé. Un motif est obligatoire "
                         "pour enregistrer un montant final différent du devis accepté."
            }), 400

        b.final_amount = fa
        b.shizu_commission = round(fa * 0.15)
        b.provider_payout = fa - b.shizu_commission

        # Always trace a final_amount write (T-07: actor_id=None — no admin row).
        note_bits = [f"Montant final: {old_amount if old_amount is not None else '—'} → {fa} FCFA"]
        if b.amount_xof is not None and fa != b.amount_xof:
            note_bits.append(f"(devis accepté: {b.amount_xof} FCFA)")
        if reason:
            note_bits.append(f"Motif: {reason}")
        db.session.add(BookingEvent(
            booking_id=b.id,
            event_type='final_amount_set',
            from_status=b.status,
            to_status=b.status,
            actor_id=None,
            note=' '.join(note_bits),
        ))

    # A payment_status / payout_status change moves real money and left NO trace
    # at all: the only event this endpoint ever wrote was final_amount_set, and
    # only when a final_amount was supplied. Same blind spot 4d06e64 closed on
    # the quote/lock/unlock events — with the amount in force, raw, because an
    # audit note is parsed rather than read aloud.
    changes = []
    if payment and payment != b.payment_status:
        changes.append(f'paiement {b.payment_status} → {payment}')
    if payout and payout != b.payout_status:
        changes.append(f'versement {b.payout_status} → {payout}')

    if payment:
        b.payment_status = payment
    if payout:
        b.payout_status = payout

    if changes:
        note = f"Finance : {', '.join(changes)} sur {b.amount_due_total} XOF"
        if reason:
            note += f" — motif : {reason}"
        db.session.add(BookingEvent(
            booking_id=b.id,
            event_type='finance_updated',
            from_status=b.status,
            to_status=b.status,
            actor_id=None,
            note=note,
        ))

    db.session.commit()

    # WhatsApp: payout sent → notify provider. (Payment recording — and its
    # provider notification — now lives in confirm-payment, not here; the old
    # `payment == 'paid'` branch is gone since 'paid' is no longer written here.)
    try:
        from shizuverse.utils.notifications import notify_payout_sent
        eff_payout = b.provider_payout or (
            round((b.final_amount or b.amount_xof or 0) * 0.85)
        )
        if payout == 'sent' and b.provider_phone and eff_payout:
            from shizuverse.utils.dates import format_long_date
            notify_payout_sent(
                provider_phone=b.provider_phone,
                provider_payout=eff_payout,
                # No payout_date column exists: the payout date IS the moment the
                # admin marks it sent, which is also this request's BookingEvent.
                payout_date=format_long_date(datetime.utcnow(), 'fr'),   # T-19
                booking_id=b.id,
            )
    except Exception as e:
        current_app.logger.error(f"[update_finance] Unexpected error: {e}", exc_info=True)

    return jsonify({
        'message': 'Finance status updated',
        'payment_status': b.payment_status,
        'payout_status': b.payout_status,
        'final_amount': b.final_amount,
        'shizu_commission': b.shizu_commission,
        'provider_payout': b.provider_payout,
        'amount_collected': b.amount_collected,
        'amount_due': b.amount_due,
        'collection_status': b.collection_status,
        'overpaid': b.overpaid,
    })


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
            'is_published': r.is_published,
            'punctuality': r.punctuality,
            'respect': r.respect,
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

    # Money expressions live in ONE place (utils/finance_expressions): they used
    # to be redefined here and in finance_summary, and the two drifted.
    from shizuverse.utils.finance_expressions import (
        eff_amt as _eff_amt, eff_commission as _eff_commission,
        eff_payout as _eff_payout, fully_paid as _fully_paid,
        not_refunded as _not_refunded,
    )
    eff_amt, eff_commission = _eff_amt(), _eff_commission()
    eff_payout, fully_paid, not_refunded = _eff_payout(), _fully_paid(), _not_refunded()

    # Every revenue aggregate below excludes refunded files. A refund leaves
    # amount_collected untouched (T-29: money really did come in), so nothing in
    # the collected amount will drop the file on its own — it has to be excluded
    # explicitly, or refunded bookings keep inflating the totals forever.

    # ── GMV ───────────────────────────────────────────────────
    gmv_total = db.session.query(
        func.coalesce(func.sum(eff_amt), 0)
    ).filter(fully_paid, not_refunded).scalar()

    gmv_month = db.session.query(
        func.coalesce(func.sum(eff_amt), 0)
    ).filter(
        fully_paid,
        not_refunded,
        ClientBooking.created_at >= first_of_month
    ).scalar()

    # ── Revenue Shizu (15% commission) ────────────────────────
    revenue_shizu = db.session.query(
        func.coalesce(func.sum(eff_commission), 0)
    ).filter(fully_paid, not_refunded).scalar()

    # ── Provider payouts ──────────────────────────────────────
    # 'due' only — 'not_due' used to pass the previous `!= 'sent'` filter, so
    # payouts that were explicitly NOT due were counted as due.
    payouts_due = db.session.query(
        func.coalesce(func.sum(eff_payout), 0)
    ).filter(
        fully_paid,
        not_refunded,
        ClientBooking.payout_status == 'due'
    ).scalar()

    # Same predicates as payouts_due, minus the status — a sent payout is a fact,
    # but it belongs to the same population.
    payouts_sent = db.session.query(
        func.coalesce(func.sum(eff_payout), 0)
    ).filter(
        fully_paid,
        not_refunded,
        ClientBooking.payout_status == 'sent'
    ).scalar()

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


# ── Payment Rules Endpoints ───────────────────────────────────

@admin_bp.route('/bookings/<int:booking_id>/lock-amount', methods=['POST'])
@admin_required
def lock_booking_amount(booking_id):
    """Admin confirms the final quoted amount. Must happen before provider is assigned."""
    b = ClientBooking.query.get_or_404(booking_id)
    if b.amount_locked:
        return jsonify({'error': "Montant déjà verrouillé."}), 409
    data = request.get_json() or {}
    confirmed_amount = data.get('confirmed_amount')

    if confirmed_amount is None or not isinstance(confirmed_amount, (int, float)) or int(confirmed_amount) <= 0:
        return jsonify({'error': 'confirmed_amount must be a positive number'}), 400

    from shizuverse.utils.payment_rules import get_payment_tier, get_deposit_amount, get_cancellation_policy
    from datetime import datetime as _dt
    amt = int(confirmed_amount)
    prior = ClientBooking.query.filter_by(client_phone=b.client_phone).count()
    tier = get_payment_tier(amt, prior)
    deposit = get_deposit_amount(amt, tier)
    hours = (b.appointment_date - _dt.utcnow()).total_seconds() / 3600 if b.appointment_date else 999
    policy = get_cancellation_policy(tier, hours)

    b.amount_xof = amt
    b.payment_tier = tier
    b.deposit_amount = deposit
    b.cancellation_policy = policy
    b.amount_locked = True
    b.amount_locked_at = _dt.utcnow()

    # The note carries the RAW amount, never a display format: this row is an
    # audit record, and a dispute must be able to replay which amount was locked
    # at each step. _fmt_amount (notifications) renders "20 000" for humans in a
    # WhatsApp message — wrong tool here, and unparseable back into a number.
    event = BookingEvent(
        booking_id=b.id,
        event_type='amount_locked',
        from_status=b.status,
        to_status=b.status,
        actor_id=None,
        note=f'Verrouillé manuellement à {amt} XOF — acceptation hors app '
             f'confirmée par l\'admin',
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({
        'success': True,
        'amount_xof': b.amount_xof,
        'payment_tier': b.payment_tier,
        'deposit_amount': b.deposit_amount,
        'cancellation_policy': b.cancellation_policy,
        'amount_locked': b.amount_locked,
    })


@admin_bp.route('/bookings/<int:booking_id>/unlock-amount', methods=['POST'])
@admin_required
def unlock_booking_amount(booking_id):
    """Explicitly unlock a locked amount (dispute case only). Requires a reason."""
    b = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'reason is required to unlock an amount'}), 400

    # Record the amount BEING unlocked, not just the reason. Without it the
    # dispute sequence (lock at X → unlock → re-lock at Y) cannot be replayed:
    # the row only ever holds the latest value.
    unlocked_amount = b.amount_xof

    b.amount_locked = False
    b.amount_locked_at = None

    event = BookingEvent(
        booking_id=b.id,
        event_type='amount_unlocked',
        from_status=b.status,
        to_status=b.status,
        actor_id=None,
        note=f'Montant déverrouillé (litige) à {unlocked_amount} XOF : {reason}',
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({
        'success': True,
        'amount_locked': b.amount_locked,
    })


@admin_bp.route('/bookings/<int:booking_id>/confirm-payment', methods=['POST'])
@admin_required
def confirm_payment(booking_id):
    """Record a client payment (deposit OR balance).

    Payments ACCUMULATE into amount_collected — the single source of truth for
    how much was collected. The booking is confirmed on the FIRST payment (a
    deposit engages the client, T-15). Overpayment (tip / MoMo rounding) is
    accepted, never refused. unpaid/partial/paid are derived, not stored here.
    """
    b = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json() or {}

    # The amount received now. Omitting it means "settle the full remaining
    # balance" (keeps the simple one-click full-payment action working).
    raw = data.get('amount')
    if raw is None:
        amount = b.amount_due
    else:
        try:
            amount = int(raw)
        except (TypeError, ValueError):
            return jsonify({'error': 'amount must be a positive integer'}), 400
    if amount <= 0:
        return jsonify({'error': 'amount must be a positive integer'}), 400

    prev_collected = b.amount_collected or 0
    prev_status = b.status
    due_total = b.amount_due_total

    b.amount_collected = prev_collected + amount
    # A recorded payment resolves any prior unverified client claim.
    if b.payment_status == 'pending':
        b.payment_status = 'open'
    # Confirm on the first payment (a deposit engages the booking, T-15).
    if prev_collected == 0:
        b.status = 'confirmed'

    now_full = due_total <= 0 or b.amount_collected >= due_total
    kind = 'Solde' if now_full else 'Acompte'
    db.session.add(BookingEvent(
        booking_id=b.id,
        event_type='payment_recorded',
        from_status=prev_status,
        to_status=b.status,
        note=f"{kind} {amount} FCFA reçu (encaissé {b.amount_collected}/{due_total} FCFA)",
    ))
    db.session.commit()

    # WhatsApp: full → "payment received, confirmed"; partial → the DISTINCT
    # deposit-received message (never announce full payment on a deposit).
    try:
        if now_full:
            from shizuverse.utils.notifications import notify_payment_confirmed
            notify_payment_confirmed(
                client_name=b.client_name,
                client_phone=b.client_phone,
                booking_ref=make_booking_ref(b),
                amount=b.amount_collected,
                locale=b.locale,
                booking_id=b.id,
            )
        else:
            from shizuverse.utils.notifications import notify_deposit_received
            notify_deposit_received(
                client_name=b.client_name,
                client_phone=b.client_phone,
                booking_ref=make_booking_ref(b),
                amount=amount,
                amount_due=b.amount_due,
                locale=b.locale,
                booking_id=b.id,
            )
    except Exception as e:
        current_app.logger.error(f"[confirm_payment] Unexpected error: {e}", exc_info=True)

    return jsonify({
        'success': True,
        'status': b.status,
        'payment_status': b.payment_status,
        'amount_collected': b.amount_collected,
        'amount_due': b.amount_due,
        'collection_status': b.collection_status,
        'overpaid': b.overpaid,
    })


@admin_bp.route('/bookings/<int:booking_id>/send-payment-instructions', methods=['POST'])
@admin_required
def send_payment_instructions(booking_id):
    """Send the payment instructions to the client via WhatsApp (in their locale).

    Read-only w.r.t. the booking: never changes status, payment_status, or the
    amount. Only sends the message and records a BookingEvent on success.
    """
    from shizuverse.utils.notifications import notify_payment_instructions, is_twilio_enabled

    b = ClientBooking.query.get_or_404(booking_id)

    if not is_twilio_enabled():
        return jsonify({'sent': False, 'twilio_enabled': False,
                        'error': 'WhatsApp (Twilio) non configuré.'}), 503

    if b.amount_xof is None:
        return jsonify({'sent': False, 'error': "Aucun montant de devis à envoyer."}), 400

    try:
        sent = notify_payment_instructions(
            client_name=b.client_name,
            client_phone=b.client_phone,
            booking_ref=make_booking_ref(b),
            amount=b.amount_xof,
            service_name=b.service_name,
            payment_tier=b.payment_tier,
            note=b.quote_note,
            quote_token=b.quote_token,
            locale=b.locale,
            booking_id=b.id,
        )
    except Exception as e:
        current_app.logger.error(f"[send_payment_instructions] error: {e}", exc_info=True)
        return jsonify({'sent': False, 'error': "Échec de l'envoi."}), 502

    if not sent:
        return jsonify({'sent': False, 'error': "Le message n'a pas pu être envoyé."}), 502

    db.session.add(BookingEvent(
        booking_id=b.id,
        event_type='payment_instructions_sent',
        from_status=b.status,
        to_status=b.status,
        actor_id=None,
        note=f"Instructions de paiement envoyées au client ({b.locale}).",
    ))
    db.session.commit()

    return jsonify({'sent': True})


@admin_bp.route('/bookings/<int:booking_id>/dispute', methods=['POST'])
@admin_required
def open_dispute(booking_id):
    """Flag a booking as disputed."""
    b = ClientBooking.query.get_or_404(booking_id)
    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'reason is required'}), 400

    # Re-opening was implicit and destructive: a second call overwrote the reason
    # and dispute_opened_at while leaving dispute_resolved_at set, producing a
    # booking that was simultaneously re-opened and resolved. Refuse instead.
    # NOTE: there is no re-open path at all today — dispute_flag is never set
    # back to False anywhere. A genuine second dispute on the same booking is
    # therefore impossible; that is a product gap, not something this guard
    # creates.
    if b.dispute_flag:
        return jsonify({
            'error': "Un litige est déjà ouvert sur cette réservation.",
            'dispute_reason': b.dispute_reason,
            'dispute_opened_at': b.dispute_opened_at.isoformat() if b.dispute_opened_at else None,
            'dispute_resolution': b.dispute_resolution,
        }), 409

    b.dispute_flag = True
    b.dispute_reason = reason
    b.dispute_opened_at = datetime.utcnow()

    # shizu_dispute_opened_provider_fr announces « le règlement est suspendu le
    # temps de la vérification » — until now nothing implemented it. A pending
    # payout is put on hold; release_provider re-opens it, so the suspend →
    # release cycle is complete. Traced with the amount (4d06e64 model).
    dispute_note = reason
    if b.payout_status == 'due':
        b.payout_status = 'not_due'
        db.session.add(BookingEvent(
            booking_id=b.id,
            event_type='finance_updated',
            from_status=b.status,
            to_status=b.status,
            actor_id=None,
            note=f'Versement suspendu — litige ouvert (due → not_due) '
                 f'sur {b.amount_due_total} XOF',
        ))
    elif b.payout_status == 'sent':
        # Money already left: a fact, never overwritten. The dispute still
        # opens — recovering a sent payout is a human conversation, not a
        # status write. Kept in the event note so a future dispute banner can
        # surface it without re-deriving history.
        current_app.logger.warning(
            "[open_dispute] litige ouvert sur #%s alors que le versement est "
            "DÉJÀ PARTI (payout_status=sent, %s XOF) — rien n'est écrasé, "
            "récupération à traiter à la main.", b.id, b.amount_due_total)
        dispute_note += ' — versement déjà envoyé avant l\'ouverture'

    event = BookingEvent(
        booking_id=b.id,
        event_type='dispute_opened',
        from_status=b.status,
        to_status=b.status,
        note=dispute_note,
    )
    db.session.add(event)
    db.session.commit()

    # WhatsApp: both sides are told a dispute is open. Never blocking — a failed
    # notification must not prevent a dispute from being recorded.
    try:
        from shizuverse.utils.notifications import (
            notify_dispute_opened_client, notify_dispute_opened_provider,
        )
        notify_dispute_opened_client(
            client_name=b.client_name,
            client_phone=b.client_phone,
            booking_ref=make_booking_ref(b),
            locale=b.locale,
            booking_id=b.id,
        )
        # A dispute can be opened on a booking with no provider yet (a client can
        # contest a quote or a delay) — hence the guard, not a systematic send.
        if b.provider_phone:
            notify_dispute_opened_provider(
                provider_phone=b.provider_phone,
                booking_ref=make_booking_ref(b),
                booking_id=b.id,
            )
    except Exception as e:
        current_app.logger.error(f"[open_dispute] notification error: {e}", exc_info=True)

    return jsonify({'success': True, 'dispute_flag': True, 'dispute_reason': b.dispute_reason})


@admin_bp.route('/bookings/<int:booking_id>/resolve-dispute', methods=['POST'])
@admin_required
def resolve_dispute_new(booking_id):
    """Resolve a disputed booking."""
    b = ClientBooking.query.get_or_404(booking_id)
    if not b.dispute_flag:
        return jsonify({'error': 'No active dispute on this booking'}), 400

    # dispute_flag stays True after a resolution (nothing ever clears it), so
    # the guard above does NOT prevent a replay: without this, calling the
    # endpoint again silently overwrote the resolution and re-applied its
    # financial effects — a refund could become a payout release, with both
    # recorded as fact. The admin UI hides the buttons once resolved, but that
    # is display, not API: a retry or a double-click still went through.
    if b.dispute_resolution or b.dispute_resolved_at:
        return jsonify({
            'error': "Ce litige a déjà été résolu.",
            'dispute_resolution': b.dispute_resolution,
            'dispute_resolved_at': b.dispute_resolved_at.isoformat() if b.dispute_resolved_at else None,
        }), 409

    data = request.get_json() or {}
    resolution = (data.get('resolution') or '').strip()
    # 'split' REMOVED — it was accepted, stored and displayed "Partagé" while
    # producing no financial effect whatsoever: no payment_status, no
    # payout_status, no amount, and no column to hold a share. An admin believed
    # they had arbitrated and nothing moved, so no message could honestly tell
    # either party what they were getting. A real split needs columns, a
    # commission rule and an approved Meta template — separate product lot.
    # Verified in production before removal: zero rows carry it.
    valid = ('refund_client', 'release_provider')
    if resolution not in valid:
        return jsonify({'error': f'resolution must be one of {list(valid)}'}), 400

    b.dispute_resolution = resolution
    b.dispute_resolved_at = datetime.utcnow()

    if resolution == 'refund_client':
        # The arbitration stands either way — but 'refunded' is only written
        # when money actually came in. On a never-collected file there is
        # nothing to give back: writing refunded would recreate the
        # « Non payé + Remboursé » contradiction this lot closes.
        if (b.amount_collected or 0) > 0:
            b.payment_status = 'refunded'
        # Cancel any pending payout. shizu_dispute_no_payment_provider_fr tells
        # the provider the mission is closed WITHOUT payment — until now nothing
        # in the code made that true: a booking already marked payout 'due' kept
        # saying so, and the row contradicted the message we had just sent.
        b.payout_status = 'not_due'
    elif resolution == 'release_provider':
        b.payout_status = 'due'

    # refund_client and release_provider move real money (payment_status /
    # payout_status just above), yet the event recorded no figure — the same
    # blind spot 4d06e64 closed on the quote/lock/unlock events. Raw amount, for
    # the same reason: an audit note is parsed, not read aloud.
    amount_at_stake = b.amount_due_total
    RESOLUTION_LABELS = {
        'refund_client':    'remboursement client',
        'release_provider': 'paiement libéré au prestataire',
    }
    note = (f'Litige résolu — {RESOLUTION_LABELS[resolution]} '
            f'({resolution}) sur {amount_at_stake} XOF')
    if resolution == 'refund_client' and (b.amount_collected or 0) == 0:
        note += ' — rien encaissé, aucun remboursement à émettre'
    event = BookingEvent(
        booking_id=b.id,
        event_type='dispute_resolved',
        from_status=b.status,
        to_status=b.status,
        note=note,
    )
    db.session.add(event)
    db.session.commit()

    # WhatsApp: each resolution tells BOTH sides the same story from their own
    # angle — a refund for the client is "no payout" for the provider. Never
    # blocking: the resolution is already committed above.
    try:
        from shizuverse.utils.notifications import (
            notify_dispute_refund_client, notify_dispute_no_payment_provider,
            notify_dispute_closed_client, notify_dispute_released_provider,
        )
        ref = make_booking_ref(b)
        if resolution == 'refund_client':
            # shizu_dispute_refund_client says « un remboursement a été décidé » —
            # on a never-collected file that promise would be false. The client
            # gets the neutral closed-case template instead: arbitrated in their
            # favour, nothing to transfer back.
            if (b.amount_collected or 0) > 0:
                notify_dispute_refund_client(
                    client_name=b.client_name, client_phone=b.client_phone,
                    booking_ref=ref, locale=b.locale, booking_id=b.id,
                )
            else:
                notify_dispute_closed_client(
                    client_name=b.client_name, client_phone=b.client_phone,
                    booking_ref=ref, locale=b.locale, booking_id=b.id,
                )
            if b.provider_phone:
                notify_dispute_no_payment_provider(
                    provider_phone=b.provider_phone, booking_ref=ref, booking_id=b.id,
                )
        elif resolution == 'release_provider':
            notify_dispute_closed_client(
                client_name=b.client_name, client_phone=b.client_phone,
                booking_ref=ref, locale=b.locale, booking_id=b.id,
            )
            if b.provider_phone:
                notify_dispute_released_provider(
                    provider_phone=b.provider_phone, booking_ref=ref, booking_id=b.id,
                )
    except Exception as e:
        current_app.logger.error(f"[resolve_dispute_new] notification error: {e}",
                                 exc_info=True)

    return jsonify({'success': True, 'dispute_resolution': b.dispute_resolution})


# ── Admin Config (payment numbers) ────────────────────────────

@admin_bp.route('/config', methods=['GET'])
@admin_required
def get_admin_config():
    """Return payment/contact numbers so admin can verify env vars are set."""
    import os
    return jsonify({
        'wave_number':   os.environ.get('SHIZU_WAVE_NUMBER', ''),
        'orange_number': os.environ.get('SHIZU_ORANGE_NUMBER', ''),
        'mtn_number':    os.environ.get('SHIZU_MTN_NUMBER', ''),
        'whatsapp':      os.environ.get('NEXT_PUBLIC_SHIZU_WHATSAPP', ''),
        'twilio_enabled': bool(
            os.environ.get('TWILIO_ACCOUNT_SID') and
            os.environ.get('TWILIO_AUTH_TOKEN') and
            os.environ.get('TWILIO_WHATSAPP_FROM')
        ),
    })


# ── Finance Overview ──────────────────────────────────────────

@admin_bp.route('/finance/summary', methods=['GET'])
@admin_required
def finance_summary():
    from sqlalchemy import func
    # Same expressions as /admin/overview — see utils/finance_expressions for why
    # they are shared rather than restated.
    from shizuverse.utils.finance_expressions import (
        eff_payout as _eff_payout, fully_paid as _fully_paid,
        not_refunded as _not_refunded,
    )
    collected = func.coalesce(ClientBooking.amount_collected, 0)
    completed   = db.session.query(func.count(ClientBooking.id)).filter_by(status='completed').scalar()
    # Real cash in: sum of what was actually collected (deposits included), not a
    # count of fully-paid rows. Deliberately NOT the same metric as overview's
    # gmv_total (GMV of settled files) — both are legitimate, they answer
    # different questions, and neither should be derived from the other.
    total_paid  = db.session.query(func.coalesce(func.sum(collected), 0)).scalar()
    payouts_due_count = db.session.query(func.count(ClientBooking.id)).filter_by(payout_status='due').scalar()
    # The PROVIDER's 85% share, not the gross amount: the commission was never
    # owed to them. This used to sum eff_amt here while overview summed
    # eff_payout — the same label showing two numbers 15% apart.
    payouts_due_value = db.session.query(
        func.coalesce(func.sum(_eff_payout()), 0)
    ).filter(
        _fully_paid(), _not_refunded(),
        ClientBooking.payout_status == 'due',
    ).scalar()
    failed_payouts = db.session.query(func.count(ClientBooking.id)).filter_by(payout_status='failed').scalar()
    # Completed but nothing collected yet (derived 'unpaid').
    unpaid_completed = db.session.query(func.count(ClientBooking.id)).filter(
        ClientBooking.status == 'completed', collected == 0).scalar()

    return jsonify({
        'completed_bookings': completed,
        'total_paid_xof': int(total_paid),
        'payouts_due_count': payouts_due_count,
        'payouts_due_value_xof': int(payouts_due_value),
        'failed_payouts': failed_payouts,
        'unpaid_completed_bookings': unpaid_completed,
    })


@admin_bp.route('/payouts/by-provider', methods=['GET'])
@admin_required
def payouts_by_provider():
    """Payouts grouped by provider PERSON — what the payouts tab should have been.

    Groups on ClientBooking.provider_user_id, never on ServiceProvider.id: T-20
    gives a person one SP row per service offered (three for most), all sharing
    a user_id — grouping on the service row would count them three times. The
    per-row payout amount comes from the SAME SQL expression as the aggregates
    (finance_expressions.eff_payout), selected alongside the row, so this view
    can never disagree with the tiles by construction.

    Three blocks per person, three different actions:
      eligible — completed, settled, not refunded, payout not_due: what COULD be
                 marked due (the grouped action; the update_finance guards keep
                 applying per call).
      due      — payout_status='due': to pay now.
      upcoming — completed but not settled yet: visibility, no action.
    'sent' rows are done and excluded from the blocks, but their total is kept
    per person; 'failed' rows likewise get their own count — a failed payout
    that silently vanished from every list would be a lie by omission.

    ORPHANS are counted, not just excluded: a completed, settled booking whose
    provider_user_id is NULL is money without a recipient (booking 75). If the
    header said "total to pay: X" while 25 500 float unattached, the number
    would lie by omission. The cause is labelled — no phone at all vs a phone
    the backfill could not resolve — because the two call for different fixes.
    """
    from sqlalchemy import or_
    from shizuverse.utils.finance_expressions import (
        eff_payout, fully_paid, not_refunded,
    )
    payout_expr = eff_payout()

    # Population: everything payout-relevant — completed missions, plus any row
    # already carrying a payout status that demands attention. Refunded files
    # are out entirely: a refunded client means no payout (c744d55).
    rows = (
        db.session.query(ClientBooking, payout_expr, fully_paid())
        .filter(
            not_refunded(),
            or_(
                ClientBooking.status == 'completed',
                ClientBooking.payout_status.in_(('due', 'failed')),
            ),
        )
        .order_by(ClientBooking.id.asc())
        .all()
    )

    def item(b, payout):
        return {
            'id': b.id,
            'service_name': b.service_name,
            'appointment_date': b.appointment_date.isoformat() if b.appointment_date else None,
            'payout': int(payout or 0),
            'collection_status': b.collection_status,
            'payout_status': b.payout_status,
            'status': b.status,
        }

    groups = {}      # user_id -> {'eligible': [...], 'due': [...], ...}
    orphans = []
    for b, payout, is_paid in rows:
        if b.provider_user_id is None:
            # Two causes, two different fixes: no phone at all means the booking
            # was never assigned (retroactive assignment); a phone the backfill
            # left unresolved means a number to correct or attach by hand.
            entry = item(b, payout)
            entry['cause'] = 'unresolved_provider' if b.provider_phone else 'no_provider'
            entry['provider_name'] = b.provider_name
            entry['provider_phone'] = b.provider_phone
            orphans.append(entry)
            continue

        g_ = groups.setdefault(b.provider_user_id, {
            'eligible': [], 'due': [], 'upcoming': [],
            'sent_total': 0, 'failed_count': 0,
        })
        if b.payout_status == 'due':
            g_['due'].append(item(b, payout))
        elif b.payout_status == 'sent':
            g_['sent_total'] += int(payout or 0)
        elif b.payout_status == 'failed':
            g_['failed_count'] += 1
            g_['due'].append(item(b, payout))   # failed = to pay again, not done
        elif b.status == 'completed' and is_paid:
            g_['eligible'].append(item(b, payout))
        elif b.status == 'completed':
            g_['upcoming'].append(item(b, payout))

    # Coordinates: any SP row of the group works — mobile_money_* and
    # company_name are synchronized across a person's rows (_sync_provider_rows
    # and the profile-update sibling copy).
    providers = []
    if groups:
        sp_by_user = {}
        for sp in ServiceProvider.query.filter(
                ServiceProvider.user_id.in_(list(groups.keys()))).all():
            sp_by_user.setdefault(sp.user_id, sp)
        users = {u.id: u for u in User.query.filter(User.id.in_(list(groups.keys()))).all()}

        for user_id, g_ in groups.items():
            sp = sp_by_user.get(user_id)
            u = users.get(user_id)
            name = (sp.company_name if sp and sp.company_name else None) or \
                   (u.full_name if u and u.full_name else None) or f'user #{user_id}'
            momo_number = (sp.mobile_money_number or '').strip() if sp else ''
            momo_name = (sp.mobile_money_name or '').strip() if sp else ''
            momo_operator = (sp.mobile_money_operator or '').strip() if sp else ''

            # Surfaced, never masked: money due with no way to pay it, a number
            # whose holder is unknown, or a holder who is a DIFFERENT person
            # than the provider (the holder is always displayed regardless —
            # the admin must see where the money goes).
            anomalies = []
            if not momo_number:
                anomalies.append('missing_momo_number')
            if momo_number and not momo_name:
                anomalies.append('missing_momo_name')
            if momo_name and momo_name.casefold() != name.casefold():
                anomalies.append('momo_holder_differs')

            providers.append({
                'user_id': user_id,
                'name': name,
                'company_name': sp.company_name if sp else None,
                'mobile_money_number': momo_number or None,
                'mobile_money_name': momo_name or None,
                'mobile_money_operator': momo_operator or None,
                'anomalies': anomalies,
                'eligible': {'count': len(g_['eligible']),
                             'total': sum(i['payout'] for i in g_['eligible']),
                             'items': g_['eligible']},
                'due': {'count': len(g_['due']),
                        'total': sum(i['payout'] for i in g_['due']),
                        'items': g_['due']},
                'upcoming': {'count': len(g_['upcoming']),
                             'total': sum(i['payout'] for i in g_['upcoming']),
                             'items': g_['upcoming']},
                'sent_total': g_['sent_total'],
                'failed_count': g_['failed_count'],
            })
        # Biggest amounts due first — that is the action list.
        providers.sort(key=lambda p: (-p['due']['total'], -p['eligible']['total']))

    orphans_total = sum(o['payout'] for o in orphans)
    return jsonify({
        'providers': providers,
        'orphans': {'count': len(orphans), 'total': orphans_total, 'items': orphans},
        'totals': {
            'due': sum(p['due']['total'] for p in providers),
            'eligible': sum(p['eligible']['total'] for p in providers),
            'upcoming': sum(p['upcoming']['total'] for p in providers),
            'orphans': orphans_total,
        },
    })


# ── WhatsApp / Twilio test ────────────────────────────────────

@admin_bp.route('/notifications/test', methods=['POST'])
@admin_required
def test_notification():
    """Send a test WhatsApp to verify Twilio is wired up.
    Body: { phone: '+2250700000000', message?: 'Custom text' }
    """
    from shizuverse.utils.notifications import send_whatsapp, is_twilio_enabled
    data = request.get_json() or {}
    phone = (data.get('phone') or '').strip()
    if not phone:
        return jsonify({'error': 'phone is required'}), 400
    message = data.get('message') or 'Test Shizu WhatsApp ✅ — Twilio is configured correctly.'
    sent = send_whatsapp(phone, message)
    return jsonify({
        'sent': sent,
        'twilio_enabled': is_twilio_enabled(),
        'to': phone,
    })


# ── Anomaly Detection ─────────────────────────────────────────

@admin_bp.route('/anomalies/check', methods=['GET'])
@admin_required
def anomaly_check():
    """Detect anomalies only — no alert sent, nothing written to DB."""
    from shizuverse.utils.anomaly_detector import detect_anomalies
    anomalies = detect_anomalies()
    return jsonify({'detected': len(anomalies), 'anomalies': anomalies})


@admin_bp.route('/anomalies/run', methods=['POST'])
@admin_required
def anomaly_run():
    """Full cycle: detect → Claude Haiku alert → WhatsApp → persist to anomaly_log."""
    from shizuverse.utils.anomaly_detector import run_anomaly_check
    result = run_anomaly_check()
    return jsonify(result)


@admin_bp.route('/anomalies/<int:anomaly_id>/resolve', methods=['POST'])
@admin_required
def anomaly_resolve(anomaly_id):
    """Mark an anomaly as resolved."""
    from shizuverse.models.anomaly_log import AnomalyLog
    entry = AnomalyLog.query.get_or_404(anomaly_id)
    if entry.resolved_at:
        return jsonify({'error': 'Anomaly is already resolved'}), 400

    data = request.get_json() or {}
    entry.resolved_at = datetime.utcnow()
    entry.resolved_by = (data.get('resolved_by') or 'admin').strip()[:100]
    db.session.commit()

    return jsonify({'success': True, 'id': entry.id, 'resolved_at': entry.resolved_at.isoformat()})


@admin_bp.route('/anomalies/log', methods=['GET'])
@admin_required
def anomaly_log():
    """Last 20 anomaly events (resolved + unresolved)."""
    from shizuverse.models.anomaly_log import AnomalyLog
    entries = AnomalyLog.query.order_by(AnomalyLog.detected_at.desc()).limit(20).all()
    return jsonify([e.to_dict() for e in entries])
