from . import db
from datetime import datetime

class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    
    client_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    provider_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)

    appointment_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='pending')
    notes = db.Column(db.Text, nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships (optional but good for query clarity)
    client = db.relationship('User', foreign_keys=[client_id], backref='client_appointments')
    provider = db.relationship('User', foreign_keys=[provider_id], backref='provider_appointments')
    service = db.relationship('Service', backref='appointments')

    def validate_booking_request(self):
        return {'is_valid': True, 'errors': []}

    def notify_provider(self):
        pass
