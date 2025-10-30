from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from shizuverse.models import db

# Import the association model so we can reference its table in `secondary`
from shizuverse.models.service_provider import ServiceProvider  # noqa: F401

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    user_type = db.Column(db.String(20), nullable=False)  # 'client' or 'provider'
    preferred_language = db.Column(db.String(10), default='fr')
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'))

    # ✅ Proper many-to-many: User ↔ Service via service_providers
    services = db.relationship(
        'Service',
        secondary='service_providers',
        primaryjoin=id == db.foreign(ServiceProvider.user_id),
        secondaryjoin=db.foreign(ServiceProvider.service_id) == db.text('services.id'),
        lazy='dynamic',
        backref=db.backref('providers', lazy='dynamic')
    )

    # Appointments user->client side; adjust if you also need provider side later
    appointments = db.relationship(
        'Appointment',
        backref='client_user',
        foreign_keys='Appointment.client_id'
    )

    # No ChatMessage backref here (avoid cycles)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.email}>"
