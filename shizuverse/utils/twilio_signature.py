"""X-Twilio-Signature validation for public webhook endpoints.

A Twilio webhook is an unauthenticated public URL: without this check anyone
who guesses the path can inject fake messages and delivery statuses. Twilio
signs the full request URL plus the sorted POST parameters with the account's
auth token, so a valid signature proves both origin AND integrity.

The signature is computed over the URL the CALLER requested — which is why
ProxyFix (x_proto=1) matters: behind Render/Cloudflare, Flask would otherwise
report http:// and no signature could ever match.
"""
import logging
import os
from functools import wraps

from flask import request

logger = logging.getLogger(__name__)


def require_twilio_signature(f):
    """Reject any request that isn't provably from Twilio.

    A missing TWILIO_AUTH_TOKEN is a REFUSAL, never a free pass: an
    unconfigured environment must not silently turn the webhook into an open
    endpoint. Same for a missing header or a bad signature — 403, no body, and
    a log line naming the reason.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
        if not auth_token:
            logger.error(
                "[twilio-webhook] TWILIO_AUTH_TOKEN absent — requête REFUSÉE sur %s. "
                "Sans le token, aucune signature ne peut être vérifiée : on refuse "
                "plutôt que d'ouvrir l'endpoint.", request.path,
            )
            return "", 403

        signature = request.headers.get("X-Twilio-Signature", "")
        if not signature:
            logger.warning("[twilio-webhook] en-tête X-Twilio-Signature absent sur %s "
                           "— requête refusée", request.path)
            return "", 403

        try:
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(auth_token)
            # request.form is the POST body Twilio signed; request.url must be the
            # externally-visible https:// URL (see ProxyFix note above).
            valid = validator.validate(request.url, request.form.to_dict(), signature)
        except Exception as exc:  # noqa: BLE001
            # A validator crash must not 500 a public endpoint — refuse and log.
            logger.error("[twilio-webhook] validation de signature en erreur sur %s : %s",
                         request.path, exc, exc_info=True)
            return "", 403

        if not valid:
            logger.warning("[twilio-webhook] signature INVALIDE sur %s (url=%s) — refusée",
                           request.path, request.url)
            return "", 403

        return f(*args, **kwargs)

    return decorated
