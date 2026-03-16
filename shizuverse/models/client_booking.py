from . import db
from datetime import datetime

VALID_STATUSES = ['requested', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled', 'disputed']


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
    status           = db.Column(db.String(20), default="requested", nullable=False)
    notes            = db.Column(db.Text, nullable=True)
    payment_status = db.Column(
        db.Enum('unpaid', 'pending', 'paid', 'refunded', name='payment_status_enum'),
        default='unpaid', nullable=False)
    payout_status = db.Column(
        db.Enum('not_due', 'due', 'sent', 'failed', name='payout_status_enum'),
        default='not_due', nullable=False)
    amount_xof = db.Column(db.Integer, nullable=True)
    decline_reason = db.Column(db.Text, nullable=True)
    cancellation_reason = db.Column(db.Text, nullable=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

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
            "status":               self.status,
            "notes":                self.notes,
            "provider_name":        self.provider_name,
            "provider_phone":       self.provider_phone,
            "reviewed_by":          self.reviewed_by,
            "created_at":           self.created_at.isoformat() if self.created_at else None,
            "payment_status":       self.payment_status,
            "payout_status":        self.payout_status,
            "amount_xof":           self.amount_xof,
            "decline_reason":       self.decline_reason,
            "cancellation_reason":  self.cancellation_reason,
        }
