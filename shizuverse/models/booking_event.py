from datetime import datetime
from shizuverse.models import db

class BookingEvent(db.Model):
    __tablename__ = 'booking_events'

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('client_bookings.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)
    from_status = db.Column(db.String(50), nullable=True)
    to_status = db.Column(db.String(50), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    actor_phone = db.Column(db.String(30), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    booking = db.relationship('ClientBooking', backref=db.backref('events', lazy='dynamic'))
    actor = db.relationship('User', backref=db.backref('booking_events', lazy='dynamic'))
