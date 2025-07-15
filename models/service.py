from . import db

class ServiceCategory(db.Model):
    __tablename__ = 'service_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)

    # Relationships
    services = db.relationship('Service', backref='category', lazy=True)


class Service(db.Model):
    __tablename__ = 'services'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('service_categories.id'), nullable=True)
    description = db.Column(db.Text, nullable=True)
    price_range = db.Column(db.String(50), nullable=True)
    available = db.Column(db.Boolean, default=True)
    total_appointments = db.Column(db.Integer, default=0)
    demand_score = db.Column(db.Float, default=0.0)

    # ✅ FIX: Renamed the backref to avoid collision with User.services
    provider = db.relationship('User', backref='provided_services', foreign_keys=[provider_id])

    def calculate_demand_score(self):
        self.demand_score = self.total_appointments * 1.1  # Simplified

