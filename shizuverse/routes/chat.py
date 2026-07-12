from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from utils.chatbot import ChatBotService
from shizuverse.models import ChatSession, ChatMessage, db
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
    data = request.get_json() or {}
    session_id = data.get('session_id')
    message = data.get('message')
    if session_id is None or not message:
        return jsonify({"error": "session_id and message are required"}), 400

    # IDOR guard: the session must belong to the current user.
    session = ChatSession.query.get(session_id)
    if session is None:
        return jsonify({"error": "Session not found"}), 404
    if session.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    response = ChatBotService.get_bot_response(session_id, message)
    return jsonify({"response": response})
