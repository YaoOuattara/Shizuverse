"""
Admin endpoint integration tests against the live Render deployment.

Usage:
    ADMIN_TOKEN=<jwt> python tests/test_admin_endpoints.py

All tests run in sequence; failures are printed but never abort the run.

Notes on actual API shape vs the original spec:
  - PUT  /api/admin/bookings/<id>/assign  -> body uses `provider_name` (str), not `provider_id`
  - POST /admin/bookings/<id>/quote       -> path prefix is /admin (not /api/admin);
                                            body key is `amount_xof`, not `amount`
  - POST /admin/bookings/<id>/finance     -> path prefix is /admin (not /api/admin);
                                            body keys are `payment_status` / `payout_status`
  - POST /admin/bookings/<id>/cancel      -> path prefix is /admin (not /api/admin)
"""

import os
import sys
import json
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE = os.environ.get("FLASK_API_URL", "https://shizu-verse.onrender.com").rstrip("/")
TOKEN = os.environ.get("ADMIN_TOKEN", "")

if not TOKEN:
    print("ERROR: set ADMIN_TOKEN environment variable before running these tests.")
    print("  Example:  ADMIN_TOKEN=eyJ... python tests/test_admin_endpoints.py")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS_COUNT = 0
FAIL_COUNT = 0


def _headers():
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + TOKEN,
    }


def _request(method, path, body=None):
    """Return (status_code, response_body_dict_or_str)."""
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=_headers(), method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw
    except urllib.error.URLError as e:
        return 0, str(e.reason)


def check(label, method, path, body=None, expect_status=200, note=""):
    """Run one test, print PASS/FAIL, update counters."""
    global PASS_COUNT, FAIL_COUNT
    status, resp = _request(method, path, body)
    ok = (status == expect_status)
    icon = "PASS" if ok else "FAIL"
    suffix = "  [" + note + "]" if note else ""
    detail = ""
    if not ok:
        detail = "  ->  got " + str(status) + ": " + str(resp)[:200]
    print("  " + icon + "  " + label + suffix + detail)
    if ok:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
    return status, resp


# ---------------------------------------------------------------------------
# Test suite
# ---------------------------------------------------------------------------

def main():
    print("")
    print("Target: " + BASE)
    print("Token:  " + TOKEN[:24] + "...")
    print("")

    # 1. GET bookings list
    status, resp = check(
        "1. GET /api/admin/bookings",
        "GET", "/api/admin/bookings",
        expect_status=200,
    )

    # Resolve booking ID for all subsequent tests
    booking_id = 1
    if status == 200:
        bookings = resp.get("bookings", resp) if isinstance(resp, dict) else resp
        if isinstance(bookings, list) and bookings:
            terminal = {"completed", "cancelled", "declined"}
            for b in bookings:
                if b.get("status") not in terminal:
                    booking_id = b["id"]
                    break
            else:
                booking_id = bookings[0]["id"]
    print("       Using booking_id=" + str(booking_id) + " for remaining tests")
    print("")

    # 2. PATCH status -> confirmed
    check(
        "2. PATCH /api/admin/bookings/" + str(booking_id) + "/status  {status: confirmed}",
        "PATCH", "/api/admin/bookings/" + str(booking_id) + "/status",
        body={"status": "confirmed"},
        expect_status=200,
    )

    # 3. POST quote (sets amount, computes tier)
    check(
        "3. POST /admin/bookings/" + str(booking_id) + "/quote  {amount_xof: 15000}",
        "POST", "/admin/bookings/" + str(booking_id) + "/quote",
        body={"amount_xof": 15000},
        expect_status=200,
        note="sets tier=deposit_30 for 15k; path is /admin (not /api/admin)",
    )

    # 4. POST lock-amount (required before assign)
    check(
        "4. POST /admin/bookings/" + str(booking_id) + "/lock-amount  {confirmed_amount: 15000}",
        "POST", "/admin/bookings/" + str(booking_id) + "/lock-amount",
        body={"confirmed_amount": 15000},
        expect_status=200,
        note="amount must be locked before provider can be assigned",
    )

    # 5. PUT assign (now allowed after lock)
    check(
        "5. PUT  /api/admin/bookings/" + str(booking_id) + "/assign  {provider_name: ...}",
        "PUT", "/api/admin/bookings/" + str(booking_id) + "/assign",
        body={"provider_name": "Prestataire Test", "provider_phone": "0700000000"},
        expect_status=200,
        note="spec had provider_id; actual field is provider_name",
    )

    # 6. POST finance
    check(
        "6. POST /admin/bookings/" + str(booking_id) + "/finance  {payment_status: paid}",
        "POST", "/admin/bookings/" + str(booking_id) + "/finance",
        body={"payment_status": "paid"},
        expect_status=200,
        note="path is /admin (not /api/admin)",
    )

    # 7. PUT status -> completed
    check(
        "7. PUT  /api/admin/bookings/" + str(booking_id) + "/status  {status: completed}",
        "PUT", "/api/admin/bookings/" + str(booking_id) + "/status",
        body={"status": "completed"},
        expect_status=200,
    )

    # 7. POST cancel — needs a fresh booking in a cancellable state (not completed/cancelled)
    # Create a new pending booking, confirm it, then cancel it.
    cancel_booking_id = None
    from datetime import datetime, timedelta
    future = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%dT10:00:00")
    s7, r7 = _request("POST", "/api/bookings/", {
        "client_name": "Cancel Test Client",
        "client_phone": "0700000088",
        "client_location": "Plateau, Abidjan",
        "service_id": 1,
        "appointment_date": future,
        "notes": "Created by test suite for cancel test",
    })
    if s7 == 201 and isinstance(r7, dict):
        cancel_booking_id = r7.get("id")
        # Confirm it so it's in a cancellable state
        _request("PATCH", "/api/admin/bookings/" + str(cancel_booking_id) + "/status",
                 {"status": "confirmed"})
    if cancel_booking_id:
        check(
            "8. POST /admin/bookings/" + str(cancel_booking_id) + "/cancel  {reason: test}",
            "POST", "/admin/bookings/" + str(cancel_booking_id) + "/cancel",
            body={"reason": "automated test cancel"},
            expect_status=200,
            note="fresh confirmed booking; spec had /api/admin, actual path is /admin",
        )
    else:
        print("  SKIP  8. POST /admin/bookings/{id}/cancel  [could not create test booking status=" + str(s7) + "]")
        global FAIL_COUNT
        FAIL_COUNT += 1

    # Summary
    total = PASS_COUNT + FAIL_COUNT
    print("")
    print("-" * 55)
    print("  Results: " + str(PASS_COUNT) + "/" + str(total) + " passed  |  " + str(FAIL_COUNT) + " failed")
    print("-" * 55)
    print("")
    sys.exit(0 if FAIL_COUNT == 0 else 1)


if __name__ == "__main__":
    main()
