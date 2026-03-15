from . import db
from datetime import datetime

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    type = db.Column(db.String(50), nullable=False)
    content = db.Column(db.String(255), nullable=False)

    booking_id = db.Column(db.Integer, db.ForeignKey('client_bookings.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='notifications')
    booking = db.relationship('ClientBooking', backref=db.backref('notifications', lazy='dynamic'), foreign_keys=[booking_id])
