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
    # Result of the LAST send attempt. last_notified_at stamps the ATTEMPT (not
    # the success): stamping on success only made a structurally failing send
    # (outside the 24h window) retry every cron run — the observed one-alert-
    # per-hour storm. A failure stays visible here and in the logs, but the 6h
    # reminder keeps its role instead of being bypassed.
    last_send_ok     = db.Column(db.Boolean, nullable=True)
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
            "last_send_ok": self.last_send_ok,
            "resolved_at":  self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by":  self.resolved_by,
        }
