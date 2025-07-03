from . import db
from datetime import datetime

class Appointment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    provider_id = db.Column(db.Integer)
    service_id = db.Column(db.Integer, db.ForeignKey('service.id'))
    appointment_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='pending')
    notes = db.Column(db.Text)
    duration_minutes = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def validate_booking_request(self):
        return {'is_valid': True, 'errors': []}

    def notify_provider(self):
        pass