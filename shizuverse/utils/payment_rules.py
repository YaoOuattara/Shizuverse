"""
Trust-based payment rules engine for Shizu.

This is a pure policy module — no DB access, no side effects.
All functions are deterministic given their inputs.

Tiers:
  after_service  — pay after the work is done (low-value bookings)
  deposit_30     — 30% deposit upfront, remainder after service
  deposit_40     — 40% deposit upfront, remainder after service
  full_prepay    — 100% paid before service (reserved for future use)

Cancellation policies:
  full_refund          — client gets full deposit back
  provider_compensation — deposit is kept by provider (4h or less notice)
  no_refund            — no refund (appointment already started or passed)
"""


def get_payment_tier(quoted_price, client_booking_count=0):
    """Return the payment tier for this booking.

    Args:
        quoted_price: quoted amount in XOF (or None if not yet quoted)
        client_booking_count: number of previous bookings by this client
                              (reserved for future trust-scaling logic)

    Returns:
        'after_service' | 'deposit_30' | 'deposit_40' | 'full_prepay'
    """
    if quoted_price is None or quoted_price < 15000:
        return 'after_service'
    elif quoted_price < 50000:
        return 'deposit_30'   # 30% deposit required
    else:
        return 'deposit_40'   # 40% deposit required


def get_deposit_amount(quoted_price, tier):
    """Return the FCFA deposit amount due for this tier.

    Returns 0 for after_service (no upfront payment required).
    """
    if tier == 'deposit_30':
        return round(quoted_price * 0.30)
    elif tier == 'deposit_40':
        return round(quoted_price * 0.40)
    elif tier == 'full_prepay':
        return quoted_price
    return 0


def get_remainder_amount(quoted_price, deposit_amount):
    """Amount due after the service is completed."""
    return max(0, (quoted_price or 0) - (deposit_amount or 0))


def get_cancellation_policy(tier, hours_before_appointment):
    """Return the cancellation policy given how much notice was given.

    Args:
        tier: payment tier string
        hours_before_appointment: float — positive = before, 0/negative = at/after

    Returns:
        'full_refund' | 'provider_compensation' | 'no_refund'
    """
    if tier == 'after_service':
        return 'full_refund'     # nothing was paid, nothing to refund
    if hours_before_appointment > 4:
        return 'full_refund'
    elif hours_before_appointment > 0:
        return 'provider_compensation'   # deposit kept by provider
    return 'no_refund'


TIER_LABELS = {
    'after_service': {'fr': 'Paiement après service', 'en': 'Pay after service'},
    'deposit_30':    {'fr': 'Acompte 30%',            'en': '30% deposit'},
    'deposit_40':    {'fr': 'Acompte 40%',            'en': '40% deposit'},
    'full_prepay':   {'fr': 'Prépaiement intégral',   'en': 'Full prepayment'},
}

CANCELLATION_LABELS = {
    'full_refund':          {'fr': 'Remboursement intégral',    'en': 'Full refund'},
    'provider_compensation': {'fr': 'Acompte dû au prestataire', 'en': 'Deposit kept by provider'},
    'no_refund':            {'fr': 'Aucun remboursement',        'en': 'No refund'},
}
