from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models here for global use (absolute imports)
from shizuverse.models.user import User
from shizuverse.models.role import Role
from shizuverse.models.service import Service, ServiceCategory
from shizuverse.models.appointment import Appointment
from shizuverse.models.rating import Rating
from shizuverse.models.chat import ChatSession, ChatMessage
from shizuverse.models.achievement import Achievement
from shizuverse.models.notification import Notification
from shizuverse.models.service_provider import ServiceProvider

