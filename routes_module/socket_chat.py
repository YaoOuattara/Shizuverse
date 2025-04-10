from flask import Blueprint, request
from flask_socketio import emit
from utils.chatbot import ChatBotService
from datetime import datetime

socket_chat_bp = Blueprint('socket_chat', __name__)

def create_socket_instance(socketio):
    @socketio.on('connect')
    def handle_connect():
        emit('status', {'status': 'connected', 'sid': request.sid})

    @socketio.on('message')
    def handle_message(data):
        message = data.get('message', '')
        response = ChatBotService.get_bot_response(data.get('session_id'), message)
        emit('message', {
            'role': 'assistant',
            'content': response,
            'timestamp': datetime.utcnow().isoformat()
        })

    return socketio
