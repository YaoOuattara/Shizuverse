"""
Provider endpoint integration tests against the live Render deployment.

Steps performed automatically:
  1. Register a disposable test provider (idempotent - skips if phone already exists)
  2. Login as that provider to get a token
  3. Create a fresh pending booking so accept/decline have something to act on
  4. Run all 5 provider endpoint tests in sequence
  5. Print PASS/FAIL for each, never stopping on failure

Usage:
    python tests/test_provider_endpoints.py

No env vars required - credentials are generated inline.
"""

import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta

BASE = "https://shizu-verse.onrender.com"

# Disposable test provider credentials (unique enough to not clash with real users)
TEST_PHONE = "0799999901"
TEST_PASSWORD = "TestPass123"
TEST_NAME = "Provider Test CI"

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _req(method, path, body=None, token=None):
    """Return (status_code, parsed_body)."""
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
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
    except urllib.error.URLError as e:
        return 0, str(e.reason)


PASS_COUNT = 0
FAIL_COUNT = 0


def check(label, method, path, body=None, token=None, expect_status=200, note=""):
    global PASS_COUNT, FAIL_COUNT
    status, resp = _req(method, path, body, token)
    ok = (status == expect_status)
    icon = "PASS" if ok else "FAIL"
    suffix = "  [" + note + "]" if note else ""
    detail = ""
    if not ok:
        detail = "  ->  got " + str(status) + ": " + str(resp)[:220]
    print("  " + icon + "  " + label + suffix + detail)
    if ok:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
    return status, resp


# ---------------------------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------------------------

def setup_provider():
    """Register test provider (ignore 409 = already exists), then login."""
    print("[setup] Registering test provider " + TEST_PHONE + " ...")
    status, resp = _req("POST", "/api/provider/register", {
        "full_name": TEST_NAME,
        "phone": TEST_PHONE,
        "password": TEST_PASSWORD,
        "services": ["Nettoyage general", "General cleaning"],
        "zones": ["Cocody"],
        "bio": "Compte de test automatise - ne pas supprimer",
        "account_type": "individual",
    })
    if status == 201:
        print("[setup] Provider registered (id=" + str(resp.get("provider_id")) + ")")
    elif status == 409:
        print("[setup] Provider already exists - continuing to login")
    else:
        print("[setup] Register returned " + str(status) + ": " + str(resp)[:200])

    print("[setup] Logging in ...")
    status, resp = _req("POST", "/api/provider/login", {
        "phone": TEST_PHONE,
        "password": TEST_PASSWORD,
    })
    if status != 200:
        print("[setup] LOGIN FAILED " + str(status) + ": " + str(resp))
        sys.exit(1)

    token = resp.get("token", "")
    provider = resp.get("provider", {})
    print("[setup] Logged in  provider_id=" + str(provider.get("id")) +
          "  name=" + str(provider.get("name", "")) +
          "  status=" + str(provider.get("verification_status", "")))
    return token, provider


def create_pending_booking():
    """POST a new booking that will be in 'pending' state for accept/decline tests."""
    future = (datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%dT10:00:00")
    status, resp = _req("POST", "/api/bookings/", {
        "client_name": "Client Test CI",
        "client_phone": "0700000099",
        "client_location": "Cocody, Abidjan",
        "service_id": 1,
        "appointment_date": future,
        "notes": "Booking created by provider endpoint test suite",
    })
    if status == 201:
        bid = resp.get("id")
        print("[setup] Created pending booking id=" + str(bid))
        return bid
    else:
        print("[setup] Could not create test booking " + str(status) + ": " + str(resp)[:200])
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("")
    print("Target: " + BASE)
    print("")

    # -- Setup ---------------------------------------------------------------
    token, provider = setup_provider()
    booking_id = create_pending_booking()
    print("")

    # -- Tests ---------------------------------------------------------------

    # 1. GET provider bookings
    check(
        "1. GET  /api/provider/bookings",
        "GET", "/api/provider/bookings",
        token=token,
        expect_status=200,
    )

    # 2. GET provider profile
    check(
        "2. GET  /api/provider/profile",
        "GET", "/api/provider/profile",
        token=token,
        expect_status=200,
    )

    # 3. PATCH provider profile
    check(
        "3. PATCH /api/provider/profile  {bio: 'test bio'}",
        "PATCH", "/api/provider/profile",
        body={"bio": "test bio updated by automated test"},
        token=token,
        expect_status=200,
    )

    # 4. PATCH accept booking
    if booking_id:
        check(
            "4. PATCH /api/provider/bookings/" + str(booking_id) + "/accept",
            "PATCH", "/api/provider/bookings/" + str(booking_id) + "/accept",
            token=token,
            expect_status=200,
        )
    else:
        print("  SKIP  4. PATCH /api/provider/bookings/{id}/accept  [no pending booking available]")
        global FAIL_COUNT
        FAIL_COUNT += 1

    # 5. PATCH decline booking
    # Re-create a second pending booking for decline (accept changed test booking to 'confirmed')
    booking_id_2 = create_pending_booking()
    if booking_id_2:
        check(
            "5. PATCH /api/provider/bookings/" + str(booking_id_2) + "/decline  {reason: test}",
            "PATCH", "/api/provider/bookings/" + str(booking_id_2) + "/decline",
            body={"reason": "test"},
            token=token,
            expect_status=200,
        )
    else:
        print("  SKIP  5. PATCH /api/provider/bookings/{id}/decline  [could not create second test booking]")
        FAIL_COUNT += 1

    # -- Summary -------------------------------------------------------------
    total = PASS_COUNT + FAIL_COUNT
    print("")
    print("-" * 55)
    print("  Results: " + str(PASS_COUNT) + "/" + str(total) + " passed  |  " + str(FAIL_COUNT) + " failed")
    print("-" * 55)
    print("")
    sys.exit(0 if FAIL_COUNT == 0 else 1)


if __name__ == "__main__":
    main()
