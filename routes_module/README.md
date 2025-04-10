# 🧭 Shizu `routes/` Module

This module contains all HTTP and WebSocket route definitions for the Shizu backend.

## ✨ Overview

Each route file handles a specific user-facing role:

| Route File      | Description |
|------------------|-------------|
| `client.py`      | Client dashboard, service browsing, booking, favorites, etc. |
| `provider.py`    | Provider dashboard, profile and service management, analytics. |
| `chat.py`        | RESTful endpoints for multilingual chat and session management. |
| `socket_chat.py` | Real-time assistant integration using WebSockets. |
| `__init__.py`    | Registers all Blueprints cleanly for app-wide use. |

## 🧩 Integration

In your `app.py`, simply register the routes:

```python
from routes import all_routes
for bp, prefix in all_routes:
    app.register_blueprint(bp, url_prefix=prefix)
```

## 🌍 Language Support

All routes are `Flask-Babel` aware and support `fr` / `en` localization.

## 🛠 Development Tips

- Stick to Blueprint-based routes.
- Separate client/provider logic into their own modules.
- Use RESTful conventions.
- Use `@login_required` and `current_user` validation for security.
