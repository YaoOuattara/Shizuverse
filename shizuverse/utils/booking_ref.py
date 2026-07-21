"""
Canonical booking reference.

Format: SHZ-YYYY-ID  (e.g. SHZ-2025-32)

This is the single source of truth for the human-facing reference shown to
clients and providers. The parser in api/bookings.py splits on "-" and reads
the trailing integer as the booking id, so the id MUST stay last.
"""


def booking_ref(booking) -> str:
    """Return the canonical 'SHZ-{year}-{id}' reference for a booking.

    Year comes from created_at, falling back to appointment_date; if neither is
    set (unsaved booking) the year segment is omitted rather than guessed."""
    dt = getattr(booking, "created_at", None) or getattr(booking, "appointment_date", None)
    if dt is not None:
        return f"SHZ-{dt.year}-{booking.id}"
    return f"SHZ-{booking.id}"
