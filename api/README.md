# API Folder

This folder contains modular route definitions for the Shizu backend API.

## Modules

- **auth**: Login, registration, password reset
- **users**: Fetch and manage users
- **services**: Create and list services
- **appointments**: Bookings between clients and providers

Each module uses:
- `__init__.py` for Blueprint wiring
- `controller.py` for logic
- `schemas.py` for request validation using Marshmallow (optional)
