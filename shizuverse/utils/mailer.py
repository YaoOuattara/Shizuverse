"""
E-mail sending via SMTP (standard library only — no new dependency).

Feature-flagged like WhatsApp: set SMTP_HOST, SMTP_PORT, SMTP_USER and
SMTP_PASSWORD. Until then every call logs the would-be send (recipient and
subject only) and returns False.

Port 465 uses implicit TLS (SMTP_SSL); any other port uses STARTTLS. The sender
address is SMTP_USER. The body is never logged: it can carry the client's own
words and contact details.
"""
import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)

# Short on purpose: a dead SMTP server must not hold a worker (or a greenlet)
# for long. Covers connect, TLS, login and send, each.
SMTP_TIMEOUT_SECONDS = 10


def is_smtp_enabled() -> bool:
    """True only when all four SMTP variables are present and non-empty."""
    return all(os.environ.get(k, "").strip()
               for k in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"))


def send_email(to_addr: str, subject: str, body: str) -> bool:
    """Send one plain-text UTF-8 e-mail to ONE recipient.

    Returns True on success, False on any failure or when SMTP is not
    configured. Never raises — a notification must not break the caller's main
    operation; a failure is logged with its full traceback instead.
    """
    to_addr = (to_addr or "").strip()
    if not to_addr:
        logger.warning("EMAIL: empty recipient — skipped")
        return False

    if not is_smtp_enabled():
        logger.info("SMTP NOT CONFIGURED — would send e-mail to %s: %s", to_addr, subject)
        return False

    host = os.environ["SMTP_HOST"].strip()
    user = os.environ["SMTP_USER"].strip()
    try:
        port = int(os.environ["SMTP_PORT"].strip())
    except ValueError:
        logger.error("EMAIL: SMTP_PORT is not a number — e-mail to %s not sent", to_addr)
        return False

    msg = EmailMessage()
    msg["From"] = user
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=SMTP_TIMEOUT_SECONDS)
        else:
            server = smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS)
        with server:
            if port != 465:
                server.starttls()
            server.login(user, os.environ["SMTP_PASSWORD"])
            server.send_message(msg)
        logger.info("EMAIL sent to %s: %s", to_addr, subject)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("EMAIL send failed to %s (%s): %s", to_addr, subject, exc,
                     exc_info=True)
        return False
