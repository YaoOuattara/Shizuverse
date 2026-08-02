"""Single home for the money SQL expressions.

Every financial aggregate in the admin surface is built from the same handful of
notions: what a booking is worth, what Shizu keeps, what the provider is owed,
whether the client has fully paid, whether the file was refunded.

They used to be redefined per endpoint — and they drifted. /admin/overview and
/admin/finance/summary each computed "payouts due" from their own definition:
one summed the provider's 85% share where the payout was not yet sent, the other
summed the gross amount where the payout was marked due. Same label on screen,
two different numbers, neither reproducible from the other. That is why they live
here now: a metric may legitimately differ between endpoints, its building blocks
may not.

These are SQLAlchemy expressions, not values — call them inside a query.
"""
from sqlalchemy import func

from shizuverse.models.client_booking import ClientBooking

# Commission kept by Shizu, as a percentage of the effective amount.
COMMISSION_PCT = 15


def eff_amt():
    """What the booking is actually worth: the recorded final amount if any,
    otherwise the accepted quote. Integer columns, so integer arithmetic."""
    return func.coalesce(ClientBooking.final_amount, ClientBooking.amount_xof, 0)


def eff_commission():
    """Shizu's 15% share — the stored value when present, else derived."""
    return func.coalesce(
        ClientBooking.shizu_commission,
        eff_amt() * COMMISSION_PCT / 100,
    )


def eff_payout():
    """The PROVIDER's share (85%). What Shizu owes a provider is their part,
    never the gross amount: the commission was never due to them."""
    return func.coalesce(
        ClientBooking.provider_payout,
        eff_amt() - eff_amt() * COMMISSION_PCT / 100,
    )


def fully_paid():
    """Client has paid everything due — DERIVED from amount_collected, which is
    the single source of "how much" (T-29). payment_status never stores it."""
    return (ClientBooking.amount_collected > 0) & \
           (ClientBooking.amount_collected >= eff_amt())


def not_refunded():
    """Excludes refunded files from revenue aggregates.

    A refund does NOT touch amount_collected, and that is deliberate: the client
    really did pay, and erasing it would make a partial refund unrepresentable
    and drop collection_status back to 'unpaid'. Money came in (one fact, one
    axis) then went out (another fact, another axis). So the aggregates have to
    exclude the file explicitly — nothing in the collected amount will do it for
    them. Without this, three refunded bookings kept inflating the totals, the
    15% commission and the payouts due.
    """
    return func.coalesce(ClientBooking.payment_status, '') != 'refunded'
