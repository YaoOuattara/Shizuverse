from . import db
from datetime import datetime

class ServiceProvider(db.Model):
    __tablename__ = 'service_providers'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    bio = db.Column(db.Text, nullable=True)
    experience_years = db.Column(db.Integer, nullable=True)
    joined_on = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='provider_profile', uselist=False)
    services = db.relationship('Service', backref='provider', lazy=True)

    def __repr__(self):
        return f"<ServiceProvider {self.id}>"

