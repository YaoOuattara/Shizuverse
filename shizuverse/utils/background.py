"""
Fire-and-forget work that must not hold up an HTTP response.

Why a plain daemon thread: shizuverse.app runs gevent.monkey.patch_all() at
import, so under the production server a threading.Thread IS a greenlet — it
runs as soon as the request greenlet yields, and the response goes out without
waiting for it. Under an unpatched server (tests, a sync worker) it is a real
thread; the contract is the same. No Flask context travels with it: pass plain
values (see admin_alerts.alert_snapshot), never an ORM object whose session
closes with the request.

Nothing raised in the background can reach the caller any more, so every
exception is logged here with its traceback — never lost.
"""
import logging
import threading

logger = logging.getLogger(__name__)


def run_in_background(fn, *args, name: str = "background-task", **kwargs) -> threading.Thread:
    """Start fn(*args, **kwargs) without waiting for it. Returns the thread
    (tests join it; production code ignores it)."""
    def _runner():
        try:
            fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            logger.error("[%s] background task failed: %s", name, exc, exc_info=True)

    thread = threading.Thread(target=_runner, name=name, daemon=True)
    thread.start()
    return thread
