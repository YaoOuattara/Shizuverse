//
//  Shizu_Structure.swift
//  
//
//  Created by Nourdine Faress on 4/9/25.
//


Module    Purpose
app.py    Application factory and main entrypoint (w/ create_app, SocketIO)
main.py    CLI run script for dev
migrations.py    Database initialization + Flask-Migrate setup
models/    All ORM classes: User, Service, Appointment, Chat, etc.
routes/    Blueprint registration and routing logic
routes/client.py    Client dashboard, appointments, favorites, booking
routes/provider.py    Provider dashboard, service editing, analytics
routes/chat.py    HTTP endpoints for AI chat system
routes/socket_chat.py    WebSocket events for live chat
utils/chatbot.py    AI logic: multilingual chat, OpenAI, session handling
utils/jwt_utils.py    Token creation, rotation, verification
utils/security.py    Email verification, password reset tokens
utils/migration_validator.py    Validates Alembic migration order
templates/    HTML files (not yet uploaded – can scaffold placeholders)
static/    Static assets: CSS, JS, uploads (handled via Flask)



shizu-backend/
├── app.py
├── main.py
├── manual_bootstrap.py        # Previously migrations.py
├── migrations/                # NEW: Flask-Migrate-compatible structure
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── <revision>.py
├── models/
├── routes/
├── utils/
├── templates/
├── static/
├── README.md
├── README_migrations.md       # New




                                shizu-backend/
                                │
                                ├── app.py
                                ├── main.py
                                ├── migrations.py
                                │
                                ├── models/
                                │   └── [all ORM models]
                                │
                                ├── routes/
                                │   ├── __init__.py
                                │   ├── client.py
                                │   ├── provider.py
                                │   ├── chat.py
                                │   └── socket_chat.py
                                │   └── README.md ← ✅ overview of routing layer
                                │
                                ├── utils/
                                │   ├── __init__.py
                                │   ├── chatbot.py
                                │   ├── jwt_utils.py
                                │   ├── security.py
                                │   ├── migration_validator.py
                                │   └── README.md ← ✅ overview of utility tools
                                │
                                ├── templates/
                                │   └── [HTML templates]
                                │
                                ├── static/
                                │   └── uploads/
                                │
                                ├── README.md ← ✅ overall backend summary
                                └── .env.example






























































































































