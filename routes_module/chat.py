from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from utils.chatbot import ChatBotService
from models import ChatSession, ChatMessage, db
from datetime import datetime

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/session', methods=['POST'])
@login_required
def create_session():
    session = ChatBotService.create_session(current_user.id)
    return jsonify({"session_id": session.id})

@chat_bp.route('/message', methods=['POST'])
@login_required
def send_message():
    data = request.get_json()
    response = ChatBotService.get_bot_response(data['session_id'], data['message'])
    return jsonify({"response": response})
