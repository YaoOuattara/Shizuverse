"""
Slot labels match what the client picked, within operating hours (8h–20h).

The client chooses « Soirée · 17h–20h » in BookingForm; the backend used to
say « Soir 17h–21h » in the reschedule notifications — an hour the service
does not work. These labels also feed the admin new-booking alert.

Usage:
    pytest tests/test_slot_labels.py -v
"""
import re

from shizuverse.routes.admin import _SLOT_LABELS


def test_evening_label_is_the_one_the_client_picked():
    assert _SLOT_LABELS["evening"]["fr"] == "Soirée · 17h–20h"
    assert _SLOT_LABELS["evening"]["en"] == "Evening 5pm–8pm"


def test_no_slot_goes_past_operating_hours():
    for slot, labels in _SLOT_LABELS.items():
        hours = [int(h) for h in re.findall(r"(\d+)h", labels["fr"])]
        assert all(8 <= h <= 20 for h in hours), (slot, labels["fr"])


def test_admin_alert_reads_the_evening_label():
    from types import SimpleNamespace
    from shizuverse.utils.admin_alerts import slot_label
    b = SimpleNamespace(urgency="same_day", time_preference="evening", time_slot=None)
    assert slot_label(b) == "aujourd'hui, soirée · 17h–20h"
