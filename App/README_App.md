# app.py – Flask App Factory

## Overview
This file sets up the Flask application using the App Factory pattern. It:
- Loads configurations and environment variables
- Initializes extensions: SQLAlchemy, LoginManager, Socket.IO, Babel, CORS
- Registers routes from the `routes/`, `blueprints/`, and `utils/` modules
- Handles root route `/`, which displays the landing page with featured services
- Adds a `/health` endpoint for system checks

## Key Components
- `create_app()`: builds and returns the Flask app and Socket.IO instance
- `socketio.run()`: bootstraps the app with real-time capabilities
- Uses `gevent.monkey.patch_all()` for WebSocket support
