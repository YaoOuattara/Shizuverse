from flask import Blueprint

# Register all route blueprints here
from .auth import auth_bp
from .client import client_bp
from .provider import provider_bp
from .chat import chat_bp
from .socket_chat import socket_chat_bp

all_blueprints = [
    (auth_bp, "/auth"),
    (client_bp, "/client"),
    (provider_bp, "/provider"),
    (chat_bp, "/api/chat"),
    (socket_chat_bp, "/chat")
]
