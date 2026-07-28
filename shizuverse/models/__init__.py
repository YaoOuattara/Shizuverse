from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models here for global use (absolute imports)
from shizuverse.models.user import User
from shizuverse.models.role import Role
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.models.appointment import Appointment
from shizuverse.models.rating import Rating
from shizuverse.models.chat import ChatSession, ChatMessage
from shizuverse.models.achievement import Achievement
from shizuverse.models.notification import Notification
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.client_booking import ClientBooking
from shizuverse.models.booking_event import BookingEvent
from shizuverse.models.review import Review
from shizuverse.models.waitlist import Waitlist
from shizuverse.models.anomaly_log import AnomalyLog
from shizuverse.models.whatsapp_message import WhatsAppMessage
