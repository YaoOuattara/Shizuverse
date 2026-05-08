"""
Retention/Re-engagement Agent for Shizu.

Finds inactive clients and generates personalised WhatsApp messages via Claude Haiku.
Never auto-sends — all campaigns are admin-supervised.
"""
import os
import logging
from datetime import datetime, date, timedelta

from anthropic import Anthropic

logger = logging.getLogger(__name__)

REENGAGEMENT_DAYS: dict = {
    'menage': 14, 'nettoyage': 14, 'cleaning': 14,
    'garde': 14, 'childcare': 14, 'senior': 14,
    'beaute': 21, 'beauty': 21, 'jardinage': 21, 'garden': 21,
    'climatisation': 60, 'ac': 60,
    'plomberie': 90, 'plumbing': 90, 'electr': 90, 'bricolage': 90, 'handyman': 90,
    'default': 30,
}


def get_threshold(service_type: str) -> int:
    service_lower = (service_type or '').lower()
    for key, days in REENGAGEMENT_DAYS.items():
        if key != 'default' and key in service_lower:
            return days
    return REENGAGEMENT_DAYS['default']


def _mask_phone(phone: str) -> str:
    clean = phone.replace('+', '').replace(' ', '')
    return clean[:6] + '***' if len(clean) >= 6 else phone


def get_clients_to_reengage() -> list:
    """
    Return eligible clients sorted by days_since DESC.
    Excludes: opted-out phones, phones messaged in the last 14 days.
    """
    from shizuverse.models.client_booking import ClientBooking
    from shizuverse.models import db
    from sqlalchemy import func

    opted_out_phones: set = set()
    recent_phones: set = set()
    try:
        from shizuverse.models.retention_campaign import RetentionCampaign
        opted = db.session.query(RetentionCampaign.client_phone).filter_by(opted_out=True).all()
        opted_out_phones = {r[0] for r in opted}
        cutoff = datetime.utcnow() - timedelta(days=14)
        recent = db.session.query(RetentionCampaign.client_phone).filter(
            RetentionCampaign.sent_at >= cutoff,
            RetentionCampaign.message_sent.isnot(None),
        ).all()
        recent_phones = {r[0] for r in recent}
    except Exception as e:
        logger.warning('Could not load retention exclusion lists: %s', e)

    # Latest completed booking per client
    subq = (
        db.session.query(
            ClientBooking.client_phone,
            func.max(ClientBooking.appointment_date).label('last_date'),
        )
        .filter(ClientBooking.status == 'completed')
        .filter(ClientBooking.client_phone.isnot(None))
        .group_by(ClientBooking.client_phone)
        .subquery()
    )

    rows = (
        db.session.query(ClientBooking, subq.c.last_date)
        .join(subq, (ClientBooking.client_phone == subq.c.client_phone) &
              (ClientBooking.appointment_date == subq.c.last_date))
        .filter(ClientBooking.status == 'completed')
        .all()
    )

    count_map = {
        r[0]: r[1]
        for r in db.session.query(
            ClientBooking.client_phone,
            func.count(ClientBooking.id),
        )
        .filter(ClientBooking.status == 'completed')
        .group_by(ClientBooking.client_phone)
        .all()
    }

    today = datetime.utcnow()
    eligible = []
    seen: set = set()

    for booking, last_date in rows:
        phone = booking.client_phone
        if not phone or phone in opted_out_phones or phone in recent_phones or phone in seen:
            continue
        seen.add(phone)

        last_dt = last_date if isinstance(last_date, datetime) else datetime.combine(last_date, datetime.min.time())
        days_since = (today - last_dt).days
        threshold = get_threshold(booking.service_name or '')

        if days_since < threshold:
            continue

        svc_word = (booking.service_name or '').split()[0].capitalize() if booking.service_name else ''
        eligible.append({
            'phone': phone,
            'masked_phone': _mask_phone(phone),
            'client_name': booking.client_name or '',
            'last_service': booking.service_name or '',
            'last_commune': booking.client_location or '',
            'days_since': days_since,
            'threshold': threshold,
            'booking_count': count_map.get(phone, 1),
            'threshold_label': f"Réengagement après {threshold}j — {svc_word}",
        })

    eligible.sort(key=lambda x: x['days_since'], reverse=True)
    return eligible


def generate_reengagement_message(client_data: dict) -> str:
    """Call Claude Haiku for a personalised message. Never raises."""
    try:
        client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY', ''))
        user_content = (
            f"Client: {client_data.get('client_name', 'Client')} | "
            f"Dernier service: {client_data.get('last_service', '')} | "
            f"Commune: {client_data.get('last_commune', '')} | "
            f"Absent depuis: {client_data.get('days_since', 0)} jours | "
            f"Nombre de réservations: {client_data.get('booking_count', 1)}"
        )
        response = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=200,
            system=(
                "Tu es l'assistant de réengagement de Shizu à Abidjan. "
                "Génère un message WhatsApp court, chaleureux et personnalisé en français. "
                "Max 3 phrases. Naturel, pas commercial. Termine par www.shizu.pro"
            ),
            messages=[{'role': 'user', 'content': user_content}],
        )
        return response.content[0].text.strip()
    except Exception as e:
        logger.warning('Claude message generation failed: %s', e)
        service = client_data.get('last_service', 'votre service')
        return (
            f"Bonjour ! Cela fait un moment que nous n'avons pas eu le plaisir de vous accueillir "
            f"chez Shizu. Retrouvez {service} et bien plus sur www.shizu.pro 🙏"
        )


def preview_retention_campaign() -> list:
    """Return eligible clients with message previews — no sending."""
    clients = get_clients_to_reengage()
    return [{**c, 'message_preview': generate_reengagement_message(c)} for c in clients]


def run_retention_campaign() -> dict:
    """
    Rate-limited campaign runner (max once per 24 h).
    Returns {sent, skipped, errors, total} or {error, ran_today}.
    """
    from shizuverse.models import db
    from shizuverse.utils.notifications import send_whatsapp

    try:
        from shizuverse.models.retention_campaign import RetentionCampaign
        today = date.today()
        already_ran = db.session.query(RetentionCampaign).filter(
            RetentionCampaign.campaign_date == today,
            RetentionCampaign.message_sent.isnot(None),
        ).first()
        if already_ran:
            return {'error': "Campagne déjà lancée aujourd'hui", 'ran_today': True}
    except Exception as e:
        logger.warning('Rate-limit check failed: %s', e)

    clients = get_clients_to_reengage()
    sent = skipped = errors = 0

    for c in clients:
        msg = generate_reengagement_message(c)
        ok = send_whatsapp(c['phone'], msg)
        if ok:
            sent += 1
            try:
                from shizuverse.models.retention_campaign import RetentionCampaign
                db.session.add(RetentionCampaign(
                    client_phone=c['phone'],
                    message_sent=msg,
                    sent_at=datetime.utcnow(),
                    campaign_date=date.today(),
                    opted_out=False,
                ))
            except Exception as e:
                logger.error('Failed to log retention record: %s', e)
                errors += 1
        else:
            skipped += 1

    try:
        db.session.commit()
    except Exception as e:
        logger.error('Retention campaign commit failed: %s', e)
        errors += 1

    return {'sent': sent, 'skipped': skipped, 'errors': errors, 'total': len(clients)}
