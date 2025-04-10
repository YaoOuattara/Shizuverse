from datetime import datetime

class ChatBotService:
    @staticmethod
    def get_bot_response(message):
        return f"Echo: {message} (received at {datetime.utcnow().isoformat()})"

    @staticmethod
    def get_session_messages(session_id):
        # This would be replaced by a real DB fetch in production
        return []
