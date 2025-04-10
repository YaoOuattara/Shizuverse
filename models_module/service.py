from . import db

class ServiceCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True)

class Service(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('service_category.id'))
    description = db.Column(db.Text)
    price_range = db.Column(db.String(50))
    available = db.Column(db.Boolean, default=True)
    total_appointments = db.Column(db.Integer, default=0)
    demand_score = db.Column(db.Float, default=0.0)

    def calculate_demand_score(self):
        self.demand_score = self.total_appointments * 1.1  # Simplified