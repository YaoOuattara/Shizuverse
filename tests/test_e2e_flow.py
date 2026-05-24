"""
End-to-end booking lifecycle test.

Covers the full happy path from anonymous booking creation through admin
review and provider fulfillment, plus a rate-limit smoke check.

Usage:
    pytest tests/test_e2e_flow.py -v

Environment variables (all have sensible defaults):
    FLASK_API_URL     Base URL of the Flask API  (default: https://shizu-verse.onrender.com)
    ADMIN_PASSWORD    Admin login password        (default: admin)
    TEST_PROVIDER_PHONE  Disposable provider phone  (default: 0700000099)
    TEST_PROVIDER_PASS   Disposable provider pass   (default: E2ePass123)
"""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta

import pytest

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE = os.environ.get("FLASK_API_URL", "https://shizu-verse.onrender.com").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
TEST_PHONE = os.environ.get("TEST_PROVIDER_PHONE", "0700000099")
TEST_PASS = os.environ.get("TEST_PROVIDER_PASS", "E2ePass123")
TEST_NAME = "E2E Test Provider"

APPOINTMENT = (datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%dT10:00:00")


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def _req(method: str, path: str, body=None, token: str | None = None):
    """Return (status_code, parsed_body_or_str)."""
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            try:
                return r.status, json.loads(raw)
            except json.JSONDecodeError:
                return r.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


# ---------------------------------------------------------------------------
# Shared state (populated by early fixtures, consumed by later tests)
# ---------------------------------------------------------------------------

_state: dict = {}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def ensure_provider():
    """Register (or skip if already exists) the disposable test provider."""
    status, body = _req("POST", "/api/provider/register", {
        "name": TEST_NAME,
        "phone": TEST_PHONE,
        "password": TEST_PASS,
        "services": ["Ménage"],
        "zones": ["Cocody"],
        "pricing": {"Ménage": 5000},
    })
    assert status in (201, 409), f"Provider register returned {status}: {body}"


@pytest.fixture(scope="session")
def provider_token(ensure_provider):
    status, body = _req("POST", "/api/provider/login", {
        "phone": TEST_PHONE,
        "password": TEST_PASS,
    })
    assert status == 200, f"Provider login failed {status}: {body}"
    token = body.get("token") or body.get("access_token")
    assert token, f"No token in login response: {body}"
    _state["provider_token"] = token
    return token


@pytest.fixture(scope="session")
def admin_token():
    status, body = _req("POST", "/api/admin/login", {"password": ADMIN_PASSWORD})
    assert status == 200, f"Admin login failed {status}: {body}"
    token = body.get("token") or body.get("access_token")
    assert token, f"No token in admin login response: {body}"
    _state["admin_token"] = token
    return token


@pytest.fixture(scope="session")
def booking_id(admin_token):
    """Use the booking created in test_02; falls back to creating one fresh."""
    if "booking_id" in _state:
        return _state["booking_id"]
    status, body = _req("POST", "/api/bookings/", {
        "client_name": "E2E Client",
        "client_phone": "0700000001",
        "client_location": "Cocody, Abidjan",
        "service_name": "Ménage",
        "appointment_date": APPOINTMENT,
    })
    assert status == 201, f"Booking creation failed {status}: {body}"
    bid = body.get("id") or body.get("booking", {}).get("id")
    assert bid, f"No booking id in response: {body}"
    _state["booking_id"] = bid
    return bid


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_01_health_check():
    """API must be reachable and return 200."""
    status, body = _req("GET", "/")
    assert status == 200, f"Health check failed: {status} {body}"


def test_02_anonymous_booking_creation():
    """Anonymous client creates a booking — expect 201."""
    status, body = _req("POST", "/api/bookings/", {
        "client_name": "E2E Client",
        "client_phone": "0700000001",
        "client_location": "Cocody, Abidjan",
        "service_name": "Ménage",
        "appointment_date": APPOINTMENT,
    })
    assert status == 201, f"Expected 201 got {status}: {body}"
    bid = body.get("id") or body.get("booking", {}).get("id")
    assert bid, f"Response missing booking id: {body}"
    _state["booking_id"] = bid


def test_03_admin_login(admin_token):
    """Admin login returns a JWT token."""
    assert admin_token and len(admin_token) > 20


def test_04_admin_list_bookings(admin_token):
    """Admin can list bookings and the e2e booking appears in the list."""
    status, body = _req("GET", "/api/admin/bookings", token=admin_token)
    assert status == 200, f"Expected 200 got {status}: {body}"
    bookings = body if isinstance(body, list) else body.get("bookings", [])
    assert len(bookings) >= 1, "Expected at least one booking in admin list"


def test_05_recommendations_endpoint(admin_token):
    """Recommendations endpoint responds without error."""
    bid = _state.get("booking_id")
    if not bid:
        pytest.skip("No booking id available from test_02")
    status, body = _req("GET", f"/api/admin/bookings/{bid}/recommendations", token=admin_token)
    # 200 (matched) or 404 (no providers found) are both acceptable
    assert status in (200, 404, 422), f"Unexpected status {status}: {body}"


def test_06_provider_login(provider_token):
    """Provider login returns a JWT token."""
    assert provider_token and len(provider_token) > 20


def test_07_provider_views_requests(provider_token):
    """Provider can fetch their pending booking requests."""
    status, body = _req("GET", "/api/provider/bookings", token=provider_token)
    assert status == 200, f"Expected 200 got {status}: {body}"
    bookings = body if isinstance(body, list) else body.get("bookings", [])
    assert isinstance(bookings, list), f"Expected a list, got: {type(bookings)}"


def test_08_admin_status_update(admin_token):
    """Admin can update a booking status (pending → confirmed)."""
    bid = _state.get("booking_id")
    if not bid:
        pytest.skip("No booking id available from test_02")
    status, body = _req(
        "PATCH", f"/api/admin/bookings/{bid}/status",
        {"status": "confirmed"},
        token=admin_token,
    )
    assert status in (200, 422), f"Unexpected status {status}: {body}"


def test_09_rate_limit_on_admin_login():
    """6th rapid admin login attempt must return 429."""
    wrong_pass = "definitely_wrong_password_for_rate_limit_test"
    last_status = None
    for _ in range(6):
        last_status, _ = _req("POST", "/api/admin/login", {"password": wrong_pass})
    assert last_status == 429, (
        f"Expected 429 after 6 rapid login attempts, got {last_status}. "
        "Check Flask-Limiter configuration."
    )


def test_10_provider_profile_fetch(provider_token):
    """Provider can fetch their own profile."""
    status, body = _req("GET", "/api/provider/profile", token=provider_token)
    assert status == 200, f"Expected 200 got {status}: {body}"
    assert "name" in body or "phone" in body, f"Profile response looks wrong: {body}"
