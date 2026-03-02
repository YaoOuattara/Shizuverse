from datetime import datetime
from shizuverse.models import ChatSession, db
class ChatBotService:
@staticmethod
def create_session(user_id):
"""Create and persist a new chat session for the given user."""
session = ChatSession(user_id=user_id)
db.session.add(session)
db.session.commit()
return session
@staticmethod
def get_bot_response(session_id, message):
"""Return a bot response for the given session and message."""
return f"Echo: {message} (received at {datetime.utcnow().isoformat()})"
@staticmethod
def get_session_messages(session_id):
"""Return all messages for a given session."""
return []
