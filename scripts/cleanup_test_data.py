#!/usr/bin/env python3
"""Pré-lancement : nettoyage des DONNÉES DE TEST (réservations & dépendances).

⚠️ DRY-RUN PAR DÉFAUT. N'écrit RIEN sans le flag explicite --execute.
⚠️ Ne supprime JAMAIS : prestataires, utilisateurs, catégories, services,
   grille de prix. Ce script ne touche qu'aux réservations de test et à leurs
   lignes dépendantes (events, avis, notifications, anomalies).

Usage :
    # 1) Inventaire seul (aucune écriture) :
    python scripts/cleanup_test_data.py

    # 2) Cibler par heuristique et voir le détail (toujours dry-run) :
    python scripts/cleanup_test_data.py --max-amount 100

    # 3) Supprimer une liste EXPLICITE de réservations (après revue) :
    python scripts/cleanup_test_data.py --booking-ids 12,13,14 --execute

Dépendances FK (vérifiées dans les modèles) — ordre de suppression imposé :
    booking_events.booking_id   NOT NULL, pas de cascade  -> supprimer d'abord
    reviews.booking_id          NOT NULL, pas de cascade  -> supprimer d'abord
    notification.booking_id     nullable                  -> mis à NULL
    anomaly_log.booking_id      nullable                  -> mis à NULL
"""
import argparse
import re
import sys

# Motifs de noms manifestement de test (élargir au besoin).
TEST_NAME_RE = re.compile(
    r"\b(test|gggg+|azerty|qwerty|meenal|john\s*test|essai|xxx+|aaa+|demo)\b",
    re.IGNORECASE,
)


def _load():
    from shizuverse.app import app
    from shizuverse.models import db
    from shizuverse.models.client_booking import ClientBooking
    from shizuverse.models.booking_event import BookingEvent
    from shizuverse.models.review import Review
    from shizuverse.models.notification import Notification
    from shizuverse.models.anomaly_log import AnomalyLog
    from shizuverse.utils.phone import is_valid_e164
    return app, db, ClientBooking, BookingEvent, Review, Notification, AnomalyLog, is_valid_e164


def _is_test_booking(b, max_amount, is_valid_e164) -> bool:
    if b.client_name and TEST_NAME_RE.search(b.client_name):
        return True
    if b.amount_xof is not None and b.amount_xof <= max_amount:
        return True
    if b.client_phone and not is_valid_e164(b.client_phone):
        return True
    return False


def main():
    ap = argparse.ArgumentParser(description="Nettoyage des données de test (dry-run par défaut).")
    ap.add_argument("--execute", action="store_true",
                    help="Écrit réellement en base. Sans ce flag : dry-run.")
    ap.add_argument("--max-amount", type=int, default=100,
                    help="Montant (FCFA) sous lequel une réservation est réputée de test. Défaut : 100.")
    ap.add_argument("--booking-ids", type=str, default="",
                    help="Liste explicite d'IDs à supprimer (ex. 12,13,14). Prioritaire sur l'heuristique.")
    args = ap.parse_args()

    app, db, ClientBooking, BookingEvent, Review, Notification, AnomalyLog, is_valid_e164 = _load()

    with app.app_context():
        # 1) Sélection des réservations cibles
        if args.booking_ids.strip():
            try:
                ids = [int(x) for x in args.booking_ids.split(",") if x.strip()]
            except ValueError:
                print("ERREUR : --booking-ids doit être une liste d'entiers séparés par des virgules.")
                sys.exit(2)
            targets = ClientBooking.query.filter(ClientBooking.id.in_(ids)).all()
        else:
            targets = [
                b for b in ClientBooking.query.order_by(ClientBooking.id).all()
                if _is_test_booking(b, args.max_amount, is_valid_e164)
            ]

        # 2) Inventaire lisible
        print("=" * 72)
        print(f"{'DRY-RUN' if not args.execute else 'EXÉCUTION'} — {len(targets)} réservation(s) ciblée(s)")
        print("=" * 72)
        total_events = total_reviews = total_notifs = total_anoms = 0
        for b in targets:
            ev = BookingEvent.query.filter_by(booking_id=b.id).count()
            rv = Review.query.filter_by(booking_id=b.id).count()
            nt = Notification.query.filter_by(booking_id=b.id).count()
            an = AnomalyLog.query.filter_by(booking_id=b.id).count()
            total_events += ev; total_reviews += rv; total_notifs += nt; total_anoms += an
            phone_ok = is_valid_e164(b.client_phone or "")
            print(f"  #{b.id:<5} {b.client_name or '—':<22} {b.client_phone or '—':<18} "
                  f"{(b.amount_xof if b.amount_xof is not None else '—'):>8} FCFA  "
                  f"{b.status:<12} phone_e164={'OK' if phone_ok else 'INVALIDE'}  "
                  f"[events={ev} avis={rv} notifs={nt} anomalies={an}]")
        print("-" * 72)
        print(f"  Dépendantes : {total_events} events, {total_reviews} avis, "
              f"{total_notifs} notifications (→NULL), {total_anoms} anomalies (→NULL)")
        print("  NON touchés : prestataires, utilisateurs, catégories, services, prix.")
        print("=" * 72)

        if not args.execute:
            print("DRY-RUN : aucune écriture. Relancez avec --execute pour appliquer.")
            return

        # 3) Suppression, dans l'ordre des dépendances, en une transaction
        try:
            for b in targets:
                BookingEvent.query.filter_by(booking_id=b.id).delete(synchronize_session=False)
                Review.query.filter_by(booking_id=b.id).delete(synchronize_session=False)
                Notification.query.filter_by(booking_id=b.id).update(
                    {"booking_id": None}, synchronize_session=False)
                AnomalyLog.query.filter_by(booking_id=b.id).update(
                    {"booking_id": None}, synchronize_session=False)
            ids = [b.id for b in targets]
            ClientBooking.query.filter(ClientBooking.id.in_(ids)).delete(synchronize_session=False)
            db.session.commit()
            print(f"OK — {len(ids)} réservation(s) et leurs dépendances supprimées.")
        except Exception as exc:
            db.session.rollback()
            print(f"ÉCHEC — transaction annulée (rollback). Cause : {exc}")
            sys.exit(1)


if __name__ == "__main__":
    main()
