from datetime import datetime
from shizuverse.models import db


class Waitlist(db.Model):
    __tablename__ = "waitlist"

    id         = db.Column(db.Integer, primary_key=True)
    commune    = db.Column(db.String(100), nullable=False)
    phone      = db.Column(db.String(30), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
