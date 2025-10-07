from flask import Blueprint

# Register all route blueprints here (absolute imports)
from shizuverse.routes.auth import auth_bp
from shizuverse.routes.client import client_bp
from shizuverse.routes.provider import provider_bp
from shizuverse.routes.chat import chat_bp
from shizuverse.routes.socket_chat import socket_chat_bp

all_blueprints = [
    (auth_bp, "/auth"),
    (client_bp, "/client"),
    (provider_bp, "/provider"),
    (chat_bp, "/api/chat"),
    (socket_chat_bp, "/chat"),
]
