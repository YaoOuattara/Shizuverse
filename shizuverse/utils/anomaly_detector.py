"""
Operational anomaly detector for Shizu platform health monitoring.

Run detect_anomalies() for a read-only check.
Run run_anomaly_check() for the full cycle: detect → Claude Haiku alert → WhatsApp → DB log.
"""
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

ANOMALY_THRESHOLDS = {
    'booking_pending_hours':      3,
    'provider_response_hours':    1,
    'payment_confirmation_hours': 24,
    'dispute_open_hours':         48,
    'provider_acceptance_rate':   0.5,
    'booking_completion_rate':    0.7,
}


def detect_anomalies() -> list:
    """Run all 6 platform health checks. Returns a list of anomaly dicts. Never raises."""
    try:
        return _run_checks()
    except Exception as exc:
        logger.error("detect_anomalies failed: %s", exc)
        return []


def _run_checks() -> list:
    from shizuverse.models.client_booking import ClientBooking

    anomalies = []
    now = datetime.utcnow()
    t = ANOMALY_THRESHOLDS

    # ── Check 1: Bookings stuck unassigned > 3h ───────────────
    cutoff1 = now - timedelta(hours=t['booking_pending_hours'])
    stuck_unassigned = ClientBooking.query.filter(
        ClientBooking.status == 'requested',
        ClientBooking.provider_name.is_(None),
        ClientBooking.created_at <= cutoff1,
    ).all()
    for b in stuck_unassigned:
        hours = (now - b.created_at).total_seconds() / 3600
        anomalies.append({
            'type':            'booking_stuck_unassigned',
            'severity':        'critical' if hours > 6 else 'warning',
            'description':     (
                f"Réservation #{b.id} ({b.service_name}) non assignée depuis "
                f"{hours:.1f}h — client: {b.client_name}"
            ),
            'booking_id':      b.id,
            'provider_id':     None,
            'action_required': 'Assigner un prestataire immédiatement',
            'detected_at':     now.isoformat(),
        })

    # ── Check 2: Assigned but provider not accepted > 1h ─────
    cutoff2 = now - timedelta(hours=t['provider_response_hours'])
    assigned_pending = ClientBooking.query.filter(
        ClientBooking.status == 'requested',
        ClientBooking.provider_name.isnot(None),
        ClientBooking.created_at <= cutoff2,
    ).all()
    for b in assigned_pending:
        hours = (now - b.created_at).total_seconds() / 3600
        anomalies.append({
            'type':            'provider_no_response',
            'severity':        'warning',
            'description':     (
                f"Réservation #{b.id} — {b.provider_name} n'a pas répondu "
                f"depuis {hours:.1f}h"
            ),
            'booking_id':      b.id,
            'provider_id':     None,
            'action_required': 'Relancer le prestataire ou réassigner',
            'detected_at':     now.isoformat(),
        })

    # ── Check 3: Payment declared but not confirmed > 24h ────
    cutoff3 = now - timedelta(hours=t['payment_confirmation_hours'])
    pending_payment = ClientBooking.query.filter(
        ClientBooking.status == 'pending_payment',
        ClientBooking.created_at <= cutoff3,
    ).all()
    for b in pending_payment:
        hours = (now - b.created_at).total_seconds() / 3600
        anomalies.append({
            'type':            'payment_confirmation_delay',
            'severity':        'warning',
            'description':     (
                f"Réservation #{b.id} en attente de paiement depuis "
                f"{hours:.1f}h — {b.client_name}"
            ),
            'booking_id':      b.id,
            'provider_id':     None,
            'action_required': 'Vérifier le statut du paiement avec le client',
            'detected_at':     now.isoformat(),
        })

    # ── Check 4: Disputes open > 48h ─────────────────────────
    cutoff4 = now - timedelta(hours=t['dispute_open_hours'])
    open_disputes = ClientBooking.query.filter(
        ClientBooking.dispute_flag.is_(True),
        ClientBooking.dispute_opened_at <= cutoff4,
        ClientBooking.dispute_resolved_at.is_(None),
    ).all()
    for b in open_disputes:
        hours = (now - b.dispute_opened_at).total_seconds() / 3600
        anomalies.append({
            'type':            'dispute_unresolved',
            'severity':        'critical',
            'description':     (
                f"Litige #{b.id} non résolu depuis {hours:.1f}h"
                + (f" — {b.dispute_reason}" if b.dispute_reason else "")
            ),
            'booking_id':      b.id,
            'provider_id':     None,
            'action_required': 'Résoudre le litige en urgence',
            'detected_at':     now.isoformat(),
        })

    # ── Check 5: Provider acceptance rate < 50% last 7 days ──
    cutoff5 = now - timedelta(days=7)
    recent_assigned = ClientBooking.query.filter(
        ClientBooking.provider_name.isnot(None),
        ClientBooking.created_at >= cutoff5,
        ClientBooking.status.in_(['accepted', 'declined', 'in_progress', 'completed']),
    ).all()

    provider_counts: dict = {}
    for b in recent_assigned:
        stats = provider_counts.setdefault(b.provider_name, {'accepted': 0, 'declined': 0})
        if b.status == 'declined':
            stats['declined'] += 1
        else:
            stats['accepted'] += 1

    for name, stats in provider_counts.items():
        total = stats['accepted'] + stats['declined']
        if total >= 3:
            acceptance_rate = stats['accepted'] / total
            if acceptance_rate < t['provider_acceptance_rate']:
                anomalies.append({
                    'type':            'low_provider_acceptance',
                    'severity':        'warning',
                    'description':     (
                        f"{name} a refusé {stats['declined']}/{total} missions "
                        f"ces 7 derniers jours ({(1-acceptance_rate)*100:.0f}% de refus)"
                    ),
                    'booking_id':      None,
                    'provider_id':     None,
                    'action_required': 'Contacter le prestataire pour vérifier sa disponibilité',
                    'detected_at':     now.isoformat(),
                })

    # ── Check 6: Platform completion rate < 70% this week ────
    week_bookings = ClientBooking.query.filter(
        ClientBooking.created_at >= now - timedelta(days=7)
    ).all()
    non_cancelled = [b for b in week_bookings if b.status != 'cancelled']
    if len(non_cancelled) >= 5:
        completed_count = sum(1 for b in non_cancelled if b.status == 'completed')
        rate = completed_count / len(non_cancelled)
        if rate < t['booking_completion_rate']:
            anomalies.append({
                'type':            'low_completion_rate',
                'severity':        'warning',
                'description':     (
                    f"Taux de complétion cette semaine: {rate*100:.1f}% "
                    f"({completed_count}/{len(non_cancelled)}) — "
                    f"seuil: {t['booking_completion_rate']*100:.0f}%"
                ),
                'booking_id':      None,
                'provider_id':     None,
                'action_required': "Analyser les causes d'abandon et améliorer le processus",
                'detected_at':     now.isoformat(),
            })

    return anomalies


def generate_anomaly_alert(anomalies: list) -> str:
    """
    Call Claude Haiku to produce a concise WhatsApp-ready alert.
    Falls back to a plain-text summary if the API call fails.
    Never raises.
    """
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY', ''))

        anomaly_lines = "\n".join(
            f"- [{a['severity'].upper()}] {a['description']} → {a.get('action_required', '')}"
            for a in anomalies
        )

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=(
                "Tu es le système de monitoring de Shizu. "
                "Génère une alerte WhatsApp concise et actionnable pour l'admin. "
                "Priorise par sévérité. Maximum 5 lignes. "
                "Chaque anomalie sur une ligne avec emoji."
            ),
            messages=[{"role": "user", "content": f"Anomalies détectées:\n{anomaly_lines}"}],
        )
        return response.content[0].text.strip()

    except Exception as exc:
        logger.warning("Claude Haiku alert generation failed (%s) — using plain-text fallback", exc)
        critical = [a for a in anomalies if a['severity'] == 'critical']
        warning  = [a for a in anomalies if a['severity'] == 'warning']
        lines = [f"🚨 Shizu Monitor — {len(anomalies)} anomalie(s)"]
        for a in (critical + warning)[:4]:
            emoji = "🔴" if a['severity'] == 'critical' else "🟡"
            lines.append(f"{emoji} {a['description']}")
        if len(anomalies) > 4:
            lines.append(f"… +{len(anomalies) - 4} autre(s). Consultez le panel admin.")
        return "\n".join(lines)


def run_anomaly_check() -> dict:
    """
    Full cycle: detect → generate Claude Haiku alert → send WhatsApp → persist to DB.
    Returns {detected, alert_sent, anomalies}.
    """
    from shizuverse.models.anomaly_log import AnomalyLog
    from shizuverse.models import db
    from shizuverse.utils.notifications import send_whatsapp

    anomalies = detect_anomalies()
    if not anomalies:
        return {'detected': 0, 'alert_sent': False, 'notified': 0, 'anomalies': []}

    now = datetime.utcnow()
    REMINDER = timedelta(hours=6)           # re-notify a persisting anomaly at most every 6h
    RANK = {'info': 0, 'warning': 1, 'critical': 2}

    # ── Dedup + decide what to notify ─────────────────────────────────────────
    # One row per ONGOING anomaly (same type + booking + provider, unresolved).
    # Each run updates that row instead of creating a duplicate. We notify only
    # on: first detection, severity escalation, or a due 6h reminder.
    to_notify_rows = []   # AnomalyLog rows to mark as notified (only if the send succeeds)
    to_notify_anoms = []  # the anomaly dicts that will go into the WhatsApp alert
    for a in anomalies:
        existing = AnomalyLog.query.filter_by(
            anomaly_type=a['type'],
            booking_id=a.get('booking_id'),
            provider_id=a.get('provider_id'),
            resolved_at=None,
        ).first()

        if existing is None:
            row = AnomalyLog(
                anomaly_type=a['type'],
                severity=a['severity'],
                description=a['description'],
                booking_id=a.get('booking_id'),
                provider_id=a.get('provider_id'),
                detected_at=now,
                last_seen_at=now,
                occurrence_count=1,
            )
            db.session.add(row)
            to_notify_rows.append(row)       # first detection → notify
            to_notify_anoms.append(a)
        else:
            existing.last_seen_at = now
            existing.occurrence_count = (existing.occurrence_count or 1) + 1
            existing.description = a['description']
            escalated = RANK.get(a['severity'], 0) > RANK.get(existing.severity, 0)
            existing.severity = a['severity']
            due = (existing.last_notified_at is None
                   or (now - existing.last_notified_at) >= REMINDER)
            if escalated or due:             # aggravation OR 6h reminder → notify
                to_notify_rows.append(existing)
                to_notify_anoms.append(a)

    # ── Alert only for the notifiable subset (never every run) ────────────────
    admin_phone = (os.environ.get('SHIZU_ADMIN_PHONE')
                   or os.environ.get('NEXT_PUBLIC_SHIZU_WHATSAPP')
                   or '').strip()
    alert_sent = False
    if to_notify_anoms:
        alert = generate_anomaly_alert(to_notify_anoms)
        if admin_phone:
            alert_sent = send_whatsapp(admin_phone, alert)
            if alert_sent:
                # Stamp last_notified_at only on a successful send, so a failed
                # send retries next run instead of going silent for 6h.
                for row in to_notify_rows:
                    row.last_notified_at = now
        else:
            logger.warning("Neither SHIZU_ADMIN_PHONE nor NEXT_PUBLIC_SHIZU_WHATSAPP set — WhatsApp alert skipped")

    try:
        db.session.commit()
    except Exception as exc:
        logger.error("Failed to persist anomaly logs: %s", exc)
        db.session.rollback()

    return {
        'detected':   len(anomalies),
        'alert_sent': alert_sent,
        'notified':   len(to_notify_anoms),
        'anomalies':  anomalies,
    }
