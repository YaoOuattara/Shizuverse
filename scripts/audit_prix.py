#!/usr/bin/env python3
"""
audit_prix.py — AUDIT LECTURE SEULE des montants de réservation (amount_xof).

Interroge la base via les modèles SQLAlchemy existants (aucun SQL brut,
aucune écriture). Affiche, par catégorie de service :
  - nombre de bookings avec amount_xof renseigné
  - min / médiane / moyenne / max des amount_xof
Puis la liste des 20 derniers amount_xof (catégorie + date).

Usage (Render shell ou local) :
    python scripts/audit_prix.py

SELECT / lecture uniquement — ne modifie jamais la base.
"""

import statistics

from shizuverse.app import create_app
from shizuverse.models import db, ClientBooking, Service, ServiceCategory, ServiceSubcategory  # noqa: F401

# create_app() renvoie (app, socketio) ; on ne garde que l'app Flask.
_result = create_app()
app = _result[0] if isinstance(_result, tuple) else _result


def fmt_xof(n):
    """Formate un entier FCFA avec espaces comme séparateurs de milliers."""
    if n is None:
        return "—"
    return f"{int(round(n)):,}".replace(",", " ")


def category_of(booking):
    """
    Résout la catégorie d'un booking en remontant la relation :
        ClientBooking.service -> Service.subcategory -> ServiceSubcategory.category

    service_id est nullable et certains bookings ne sont pas liés à un Service :
    on retombe alors sur le nom de service dénormalisé (service_name).
    """
    svc = booking.service  # relation lazy="joined" déclarée sur ClientBooking
    if svc is not None:
        sub = svc.subcategory
        if sub is not None and sub.category is not None:
            return sub.category.name
    return (booking.service_name or "").strip() or "(sans catégorie)"


def main():
    with app.app_context():
        # ── Lecture : uniquement les bookings avec un montant renseigné ──────
        priced = (
            ClientBooking.query
            .filter(ClientBooking.amount_xof.isnot(None))
            .order_by(ClientBooking.created_at.desc())
            .all()
        )

        total_bookings = ClientBooking.query.count()

        print()
        print("=" * 72)
        print("  AUDIT PRIX — amount_xof par catégorie (LECTURE SEULE)")
        print("=" * 72)
        print(f"  Réservations totales : {total_bookings}")
        print(f"  Avec amount_xof      : {len(priced)}")
        print(f"  Sans amount_xof      : {total_bookings - len(priced)}")
        print()

        if not priced:
            print("  Aucun booking avec amount_xof renseigné — rien à agréger.")
            print("=" * 72)
            return

        # ── Regroupement par catégorie ───────────────────────────────────────
        by_cat = {}
        for b in priced:
            by_cat.setdefault(category_of(b), []).append(int(b.amount_xof))

        # ── Tableau des statistiques par catégorie ───────────────────────────
        header = f"  {'Catégorie':<26}{'N':>5}{'Min':>12}{'Médiane':>12}{'Moyenne':>12}{'Max':>12}"
        print(header)
        print("  " + "-" * (len(header) - 2))

        for cat in sorted(by_cat, key=lambda c: (-len(by_cat[c]), c.lower())):
            amounts = by_cat[cat]
            n = len(amounts)
            mn = min(amounts)
            md = statistics.median(amounts)
            mean = statistics.mean(amounts)
            mx = max(amounts)
            label = cat if len(cat) <= 25 else cat[:24] + "…"
            print(
                f"  {label:<26}{n:>5}"
                f"{fmt_xof(mn):>12}{fmt_xof(md):>12}{fmt_xof(mean):>12}{fmt_xof(mx):>12}"
            )

        # ── Global ───────────────────────────────────────────────────────────
        all_amounts = [int(b.amount_xof) for b in priced]
        print("  " + "-" * (len(header) - 2))
        print(
            f"  {'TOTAL':<26}{len(all_amounts):>5}"
            f"{fmt_xof(min(all_amounts)):>12}"
            f"{fmt_xof(statistics.median(all_amounts)):>12}"
            f"{fmt_xof(statistics.mean(all_amounts)):>12}"
            f"{fmt_xof(max(all_amounts)):>12}"
        )
        print()

        # ── 20 derniers amount_xof (déjà triés created_at desc) ──────────────
        print("=" * 72)
        print("  20 DERNIERS MONTANTS (du plus récent au plus ancien)")
        print("=" * 72)
        lh = f"  {'#':>4}  {'Date':<19}{'Catégorie':<26}{'amount_xof':>14}"
        print(lh)
        print("  " + "-" * (len(lh) - 2))
        for i, b in enumerate(priced[:20], start=1):
            when = b.created_at.strftime("%Y-%m-%d %H:%M") if b.created_at else "—"
            cat = category_of(b)
            label = cat if len(cat) <= 25 else cat[:24] + "…"
            print(f"  {i:>4}  {when:<19}{label:<26}{fmt_xof(b.amount_xof):>14}")
        print()
        print("  (Lecture seule — aucune écriture effectuée.)")
        print("=" * 72)


if __name__ == "__main__":
    main()
