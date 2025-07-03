from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models here for global use
from .user import User
from .role import Role
from .service import Service, ServiceCategory
from .appointment import Appointment
from .rating import Rating
from .chat import ChatSession, ChatMessage
from .achievement import Achievement
from .notification import Notification
from .service_provider import ServiceProvider
