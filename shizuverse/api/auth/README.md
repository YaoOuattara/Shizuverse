# Auth Module

Handles user login (email/password).

## Endpoints

- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Returns: JWT or session-based token if valid

## Files

- `__init__.py`: Route registration
- `controller.py`: Login handler logic
- `schemas.py`: Input validation for login
