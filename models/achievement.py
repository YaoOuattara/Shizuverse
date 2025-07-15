from . import db

class Achievement(db.Model):
    __tablename__ = 'achievements'  # Explicit table name for consistency

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(50), nullable=False)  # e.g., 'service_count', 'rating'
    requirements = db.Column(db.JSON, nullable=True)

    def __repr__(self):
        return f"<Achievement {self.name} ({self.type})>"
