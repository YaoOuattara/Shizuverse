from . import db
from datetime import datetime


class AnomalyLog(db.Model):
    __tablename__ = "anomaly_log"

    id           = db.Column(db.Integer, primary_key=True)
    anomaly_type = db.Column(db.String(80),  nullable=False)
    severity     = db.Column(db.String(20),  nullable=False)   # critical | warning | info
    description  = db.Column(db.Text,        nullable=False)
    booking_id   = db.Column(db.Integer, db.ForeignKey("client_bookings.id"), nullable=True)
    provider_id  = db.Column(db.Integer, db.ForeignKey("service_providers.id"), nullable=True)
    detected_at  = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    # Dedup / reminder tracking (one row per ongoing anomaly, updated each run).
    last_seen_at     = db.Column(db.DateTime, nullable=True)
    occurrence_count = db.Column(db.Integer, nullable=False, default=1, server_default='1')
    last_notified_at = db.Column(db.DateTime, nullable=True)
    resolved_at  = db.Column(db.DateTime, nullable=True)
    resolved_by  = db.Column(db.String(100), nullable=True)

    booking  = db.relationship("ClientBooking",  backref="anomaly_logs", lazy="select")
    provider = db.relationship("ServiceProvider", backref="anomaly_logs", lazy="select")

    def to_dict(self):
        return {
            "id":           self.id,
            "anomaly_type": self.anomaly_type,
            "severity":     self.severity,
            "description":  self.description,
            "booking_id":   self.booking_id,
            "provider_id":  self.provider_id,
            "detected_at":  self.detected_at.isoformat() if self.detected_at else None,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "occurrence_count": self.occurrence_count,
            "resolved_at":  self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by":  self.resolved_by,
        }
