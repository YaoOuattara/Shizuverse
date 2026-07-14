from . import db
from datetime import datetime

VALID_STATUSES = ['requested', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled', 'disputed', 'pending_payment']


class ClientBooking(db.Model):
    __tablename__ = "client_bookings"

    id = db.Column(db.Integer, primary_key=True)

    # Guest contact info (no user account required)
    client_name     = db.Column(db.String(120), nullable=False)
    client_phone    = db.Column(db.String(30),  nullable=False)
    client_location = db.Column(db.String(255), nullable=False)

    # Service — FK + denormalized name for display without a join
    service_id   = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=True)
    service_name = db.Column(db.String(150), nullable=False)
    service_slug = db.Column(db.String(80),  nullable=True)   # e.g. "menage"

    appointment_date = db.Column(db.DateTime, nullable=False)
    urgency          = db.Column(db.String(20), nullable=True)   # urgent_2h | same_day | under_24h | normal
    time_preference  = db.Column(db.String(20), nullable=True)   # morning | afternoon | evening | anytime
    time_slot        = db.Column(db.String(20), nullable=True)   # morning | afternoon | evening
    status           = db.Column(db.String(20), default="requested", nullable=False)
    notes            = db.Column(db.Text, nullable=True)
    payment_status = db.Column(
        db.Enum('unpaid', 'pending', 'paid', 'refunded', name='payment_status_enum'),
        default='unpaid', nullable=False)
    payout_status = db.Column(
        db.Enum('not_due', 'due', 'sent', 'failed', name='payout_status_enum'),
        default='not_due', nullable=False)
    amount_xof = db.Column(db.Integer, nullable=True)
    final_amount = db.Column(db.Integer, nullable=True)
    shizu_commission = db.Column(db.Integer, nullable=True)
    provider_payout = db.Column(db.Integer, nullable=True)
    decline_reason = db.Column(db.Text, nullable=True)
    cancellation_reason = db.Column(db.Text, nullable=True)
    quote_note = db.Column(db.Text, nullable=True)   # note sent to client with the quote
    # Magic-link quote acceptance (anonymous clients, no account required)
    quote_token            = db.Column(db.String(64), unique=True, nullable=True, index=True)
    quote_token_expires_at = db.Column(db.DateTime, nullable=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    # ── Payment rules engine ──────────────────────────────────
    payment_tier        = db.Column(db.String(20),  nullable=True)   # after_service|deposit_30|deposit_40|full_prepay
    deposit_amount      = db.Column(db.Integer,      nullable=True)   # FCFA deposit due upfront
    cancellation_policy = db.Column(db.String(30),  nullable=True)   # full_refund|provider_compensation|no_refund

    # ── Amount lock (admin confirms amount before dispatch) ───
    amount_locked    = db.Column(db.Boolean,   default=False, nullable=False, server_default='false')
    amount_locked_at = db.Column(db.DateTime,  nullable=True)

    # ── Dispute tracking ──────────────────────────────────────
    dispute_flag        = db.Column(db.Boolean,  default=False, nullable=False, server_default='false')
    dispute_reason      = db.Column(db.Text,     nullable=True)
    dispute_opened_at   = db.Column(db.DateTime, nullable=True)
    dispute_resolution  = db.Column(db.String(20), nullable=True)    # refund_client|release_provider|split
    dispute_resolved_at = db.Column(db.DateTime, nullable=True)

    # Provider assignment fields (set when admin assigns a provider)
    provider_name  = db.Column(db.String(100), nullable=True)
    provider_phone = db.Column(db.String(20),  nullable=True)
    reviewed_by    = db.Column(db.String(50),  nullable=True)

    service = db.relationship("Service", backref="client_bookings", lazy="joined")

    def to_dict(self):
        return {
            "id":                   self.id,
            "client_name":          self.client_name,
            "client_phone":         self.client_phone,
            "client_location":      self.client_location,
            "service_id":           self.service_id,
            "service_name":         self.service_name,
            "service_slug":         self.service_slug,
            "appointment_date":     self.appointment_date.isoformat(),
            "urgency":              self.urgency,
            "time_preference":      self.time_preference,
            "time_slot":            self.time_slot,
            "status":               self.status,
            "notes":                self.notes,
            "provider_name":        self.provider_name,
            "provider_phone":       self.provider_phone,
            "reviewed_by":          self.reviewed_by,
            "created_at":           self.created_at.isoformat() if self.created_at else None,
            "payment_status":       self.payment_status,
            "payout_status":        self.payout_status,
            "amount_xof":           self.amount_xof,
            "final_amount":         self.final_amount,
            "shizu_commission":     self.shizu_commission,
            "provider_payout":      self.provider_payout,
            "decline_reason":       self.decline_reason,
            "cancellation_reason":  self.cancellation_reason,
            "quote_note":           self.quote_note,
            # Payment rules
            "payment_tier":         self.payment_tier,
            "deposit_amount":       self.deposit_amount,
            "cancellation_policy":  self.cancellation_policy,
            "amount_locked":        self.amount_locked,
            "amount_locked_at":     self.amount_locked_at.isoformat() if self.amount_locked_at else None,
            # Dispute
            "dispute_flag":         self.dispute_flag,
            "dispute_reason":       self.dispute_reason,
            "dispute_opened_at":    self.dispute_opened_at.isoformat() if self.dispute_opened_at else None,
            "dispute_resolution":   self.dispute_resolution,
            "dispute_resolved_at":  self.dispute_resolved_at.isoformat() if self.dispute_resolved_at else None,
        }
