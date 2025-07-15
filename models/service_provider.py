from models import db

class ServiceProvider(db.Model):
    __tablename__ = 'service_providers'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)  # ✅ Corrected FK
    company_name = db.Column(db.String(120))
    phone_number = db.Column(db.String(20))
    address = db.Column(db.String(255))
    bio = db.Column(db.Text)
    profile_picture = db.Column(db.String(255))
    verified = db.Column(db.Boolean, default=False)
    
    # Optional relationship
    user = db.relationship('User', backref=db.backref('service_provider', uselist=False))

    def __repr__(self):
        return f"<ServiceProvider {self.user_id}>"
