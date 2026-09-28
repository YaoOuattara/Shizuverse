#!/usr/bin/env python3
"""Send a SAMPLE « nouvelle demande » admin alert — no booking, no database.

Checks the real wiring on the host (SMTP credentials, WhatsApp template SID,
recipient lists) without creating anything: the alert is built from a fake
booking held in memory. The app is never created and no query is ever run.

Usage (Render Shell, from the repo root):
    python scripts/send_test_admin_alert.py          # preview: prints what would go out, sends nothing
    python scripts/send_test_admin_alert.py --send   # really sends, to every configured recipient

The e-mail subject is prefixed « [TEST] » and the reference is SHZ-<year>-TEST,
so nobody mistakes it for a real request. Each recipient gets its own log line;
the exit code is 0 only if every configured recipient was reached (a WhatsApp
template still « en attente » counts as not reached).
"""
import argparse
import logging
import os
import sys
from datetime import datetime, timedelta
from types import SimpleNamespace

# Run as a plain script from the repo root: make `shizuverse` importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SUBJECT_PREFIX = "[TEST] "


def sample_booking():
    now = datetime.utcnow()
    return SimpleNamespace(
        id="TEST",                      # not an int → never attached to a real booking
        created_at=now,
        appointment_date=now + timedelta(days=1),
        client_name="Client Test (alerte d'exemple)",
        client_phone="+225 00 00 00 00 00",
        client_location="Cocody, adresse d'exemple",
        service_name="Demande libre",
        urgency="urgent_2h",
        time_preference="morning",
        time_slot=None,
        locale="fr",
        notes=("Demande du client : « Ceci est une alerte de TEST envoyée depuis "
               "le Render Shell — aucune réservation n'a été créée. »\n"
               "Précisions du client : rien à traiter."),
    )


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Alerte admin d'exemple (aucune écriture en base).")
    ap.add_argument("--send", action="store_true",
                    help="Envoie réellement. Sans ce flag : aperçu seulement.")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")

    from shizuverse.utils import admin_alerts
    from shizuverse.utils.mailer import is_smtp_enabled
    from shizuverse.utils.notifications import is_template_registered, is_twilio_enabled

    booking = sample_booking()
    alert = admin_alerts.build_alert(booking)
    phones, emails = admin_alerts.admin_phones(), admin_alerts.admin_emails()

    print("\n── Configuration ─────────────────────────────────────────────")
    print(f"  SMTP configuré ............ {'oui' if is_smtp_enabled() else 'NON'}")
    print(f"  Twilio configuré .......... {'oui' if is_twilio_enabled() else 'NON'}")
    print(f"  Template {admin_alerts.TEMPLATE_KEY} : "
          f"{'SID présent' if is_template_registered(admin_alerts.TEMPLATE_KEY) else 'EN ATTENTE (pas de SID)'}")
    print(f"  Destinataires WhatsApp .... {len(phones)}")
    print(f"  Destinataires e-mail ...... {len(emails)}")
    print("\n── Message ───────────────────────────────────────────────────")
    print(f"  WhatsApp : {admin_alerts.render_template_body(alert['variables'])}")
    print(f"  E-mail   : {SUBJECT_PREFIX}Nouvelle demande {alert['variables']['1']} — "
          f"{alert['variables']['2']} à {alert['variables']['3']}")

    if not args.send:
        print("\nAPERÇU — rien n'a été envoyé. Relancez avec --send pour envoyer.\n")
        return 0

    print("\n── Envoi ─────────────────────────────────────────────────────")
    result = admin_alerts.notify_admin_new_booking(booking, subject_prefix=SUBJECT_PREFIX)
    outcomes = list(result["whatsapp"].values()) + list(result["email"].values())
    print("\n── Résultat ──────────────────────────────────────────────────")
    for channel in ("email", "whatsapp"):
        for who, status in result[channel].items():
            print(f"  {channel:<8} {who:<32} {status}")
    if not outcomes:
        print("  Aucun destinataire configuré.")
    ok = bool(outcomes) and all(s == "sent" for s in outcomes)
    print(f"\n{'✅ Tous les destinataires atteints.' if ok else '❌ Au moins un destinataire non atteint — voir les logs ci-dessus.'}\n")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
