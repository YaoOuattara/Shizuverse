import time
from collections import defaultdict

import jwt as pyjwt
from flask import Blueprint, request, current_app
from flask_socketio import emit
from utils.chatbot import ChatBotService
from datetime import datetime

socket_chat_bp = Blueprint('socket_chat', __name__)

# In-memory per-connection message throttle (best-effort; per-worker for MVP).
_MSG_LIMIT = 10        # messages
_MSG_WINDOW = 60       # seconds
_msg_history: dict = defaultdict(list)


def _valid_token(auth):
    """Accept a JWT passed via socket.io `auth={token}` or ?token= query."""
    token = None
    if isinstance(auth, dict):
        token = auth.get('token')
    token = token or request.args.get('token')
    if not token:
        return False
    try:
        pyjwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return True
    except pyjwt.InvalidTokenError:
        return False


def create_socket_instance(socketio):
    @socketio.on('connect')
    def handle_connect(auth=None):
        # Reject anonymous connections — no login, no socket.
        if not _valid_token(auth):
            return False
        emit('status', {'status': 'connected', 'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        _msg_history.pop(request.sid, None)

    @socketio.on('message')
    def handle_message(data):
        if not isinstance(data, dict):
            emit('error', {'error': 'invalid_payload'})
            return

        # Rate limit per connection.
        now = time.time()
        sid = request.sid
        recent = [t for t in _msg_history[sid] if now - t < _MSG_WINDOW]
        if len(recent) >= _MSG_LIMIT:
            emit('error', {'error': 'rate_limited'})
            return
        recent.append(now)
        _msg_history[sid] = recent

        message = data.get('message', '')
        response = ChatBotService.get_bot_response(data.get('session_id'), message)
        emit('message', {
            'role': 'assistant',
            'content': response,
            'timestamp': datetime.utcnow().isoformat()
        })

    return socketio
