from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from shizuverse.models import db

# Import the association class so SQLAlchemy knows the secondary table exists
from shizuverse.models.service_provider import ServiceProvider  # noqa: F401

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
    user_type = db.Column(db.String(20), nullable=False)  # 'client' or 'provider'
    preferred_language = db.Column(db.String(10), default='fr')
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'))
    account_type = db.Column(db.String(20), default='individual')  # 'individual' or 'company'
    company_name = db.Column(db.String(120), nullable=True)
    full_name = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    is_deleted = db.Column(db.Boolean, nullable=True, default=False)
    deleted_at = db.Column(db.DateTime, nullable=True)

    # Many-to-many: User <-> Service via service_providers junction table
    services = db.relationship(
        'Service',
        secondary='service_providers',
        primaryjoin='User.id == foreign(ServiceProvider.user_id)',
        secondaryjoin='Service.id == foreign(ServiceProvider.service_id)',
        lazy='dynamic',
        backref=db.backref('providers', lazy='dynamic', overlaps='provider_links,service,service_provider_links,user'),
        overlaps='provider_links,service,service_provider_links,user'
    )

    # REMOVED: conflicting appointments relationship that duplicated the backref
    # already defined in appointment.py via backref='client_appointments'
    # Access via: current_user.client_appointments

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.email}>"
