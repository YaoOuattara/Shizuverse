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

    # 3. PUT assign
    # Spec said {provider_id: 1} but the endpoint takes provider_name (string)
    check(
        "3. PUT  /api/admin/bookings/" + str(booking_id) + "/assign  {provider_name: ...}",
        "PUT", "/api/admin/bookings/" + str(booking_id) + "/assign",
        body={"provider_name": "Prestataire Test", "provider_phone": "0700000000"},
        expect_status=200,
        note="spec had provider_id; actual field is provider_name",
    )

    # 4. POST quote
    # Lives at /admin/ (not /api/admin/); key is amount_xof (not amount)
    check(
        "4. POST /admin/bookings/" + str(booking_id) + "/quote  {amount_xof: 15000}",
        "POST", "/admin/bookings/" + str(booking_id) + "/quote",
        body={"amount_xof": 15000},
        expect_status=200,
        note="spec had /api/admin + amount; actual path is /admin + amount_xof",
    )

    # 5. POST finance
    # Lives at /admin/ (not /api/admin/); needs payment_status or payout_status
    check(
        "5. POST /admin/bookings/" + str(booking_id) + "/finance  {payment_status: paid}",
        "POST", "/admin/bookings/" + str(booking_id) + "/finance",
        body={"payment_status": "paid"},
        expect_status=200,
        note="spec had /api/admin; actual path is /admin",
    )

    # 6. PUT status -> completed
    check(
        "6. PUT  /api/admin/bookings/" + str(booking_id) + "/status  {status: completed}",
        "PUT", "/api/admin/bookings/" + str(booking_id) + "/status",
        body={"status": "completed"},
        expect_status=200,
    )

    # 7. POST cancel
    # Lives at /admin/ (not /api/admin/)
    # Note: booking was just moved to 'completed' in test 6, so this will 400.
    # That is correct backend behaviour (cannot cancel a completed booking).
    check(
        "7. POST /admin/bookings/" + str(booking_id) + "/cancel  {reason: test}",
        "POST", "/admin/bookings/" + str(booking_id) + "/cancel",
        body={"reason": "test"},
        expect_status=200,
        note="spec had /api/admin; actual path is /admin. "
             "Will 400 if booking is already completed (correct backend behaviour).",
    )

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
