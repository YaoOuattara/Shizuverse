from . import db

class Achievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    description = db.Column(db.Text)
    type = db.Column(db.String(50))  # e.g., 'service_count', 'rating'
    requirements = db.Column(db.JSON)