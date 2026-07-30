"""Single source of truth for human-readable date formatting.

The approved WhatsApp templates carry long dates ("mardi 4 août 2026"), which
strftime cannot produce in French without setlocale — and setlocale mutates
process-global state, which is not safe under gevent. Babel formats per-call
with no global side effect.

Every long date shown to a client or a provider goes through here. Three
scattered strftime('%d/%m/%Y') calls is exactly how formats drift apart.
"""
import logging

from babel.dates import format_date as _babel_format_date

logger = logging.getLogger(__name__)

# Same normalization rule as notifications._norm_locale: only 'en' is honoured,
# everything else (missing, unknown, malformed) falls back to French.
def _norm(locale) -> str:
    return "en" if str(locale or "").strip().lower().startswith("en") else "fr"


def format_long_date(value, locale="fr") -> str:
    """'mardi 4 août 2026' (fr) / 'Tuesday 4 August 2026' (en).

    Accepts a date or datetime. Returns "" for None — callers must decide what
    an absent date means; a template variable that ends up empty is refused by
    send_whatsapp_template rather than sent half-filled.

    Never raises: a formatting failure falls back to the numeric form, because a
    message with an ugly date beats no message at all.
    """
    if value is None:
        return ""
    try:
        return _babel_format_date(value, "EEEE d MMMM y", locale=_norm(locale))
    except Exception as exc:  # noqa: BLE001
        logger.warning("format_long_date failed on %r (%s) — numeric fallback", value, exc)
        try:
            return value.strftime("%d/%m/%Y")
        except Exception:  # noqa: BLE001
            return ""
