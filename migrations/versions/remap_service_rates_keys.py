"""remap service_rates keys: localized category name → category_id

Revision ID: remap_service_rates_keys
Revises: add_amount_collected
Create Date: 2026-07-26 00:00:00.000000

service_rates was stored keyed by the LOCALIZED category display name
("Climatisation et électroménager": …) — fragile: a rename orphans the data
and an EN registration produces a different key. Target format: keys are
String(category_id) ("7": …), the stable identifier the register form already
holds before it (used to) convert to a name.

Idempotent: numeric keys are left untouched (second run is a no-op); unmatched
name keys are KEPT as-is (never destroyed) and reported in the migration log.
Trivial at 2 providers — impossible at 40.
"""
import json

from alembic import op
import sqlalchemy as sa

revision = 'remap_service_rates_keys'
down_revision = 'add_amount_collected'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # service_categories may carry name_fr/name_en added by raw SQL (the API
    # introspects them the same way) — match against every name column present.
    cat_cols = {c['name'] for c in sa.inspect(bind).get_columns('service_categories')}
    name_cols = [c for c in ('name', 'name_fr', 'name_en') if c in cat_cols]

    name_to_id = {}
    for col in name_cols:
        for cid, cname in bind.execute(sa.text(
                f"SELECT id, {col} FROM service_categories WHERE {col} IS NOT NULL")):
            name_to_id.setdefault(cname.strip().lower(), cid)

    rows = bind.execute(sa.text(
        "SELECT id, service_rates FROM service_providers "
        "WHERE service_rates IS NOT NULL")).fetchall()

    for sp_id, rates in rows:
        if isinstance(rates, str):
            try:
                rates = json.loads(rates)
            except ValueError:
                continue
        if not isinstance(rates, dict) or not rates:
            continue

        remapped, changed = {}, False
        for key, value in rates.items():
            if str(key).strip().isdigit():
                remapped[str(key).strip()] = value           # already migrated
                continue
            cid = name_to_id.get(str(key).strip().lower())
            if cid is not None:
                remapped[str(cid)] = value
                changed = True
            else:
                # Unknown name — keep verbatim, never destroy declared data.
                print(f"[remap_service_rates] sp_id={sp_id}: unmatched key {key!r} kept as-is")
                remapped[key] = value

        if changed:
            bind.execute(
                sa.text("UPDATE service_providers SET service_rates = CAST(:v AS JSONB) "
                        "WHERE id = :id"),
                {"v": json.dumps(remapped), "id": sp_id},
            )
            print(f"[remap_service_rates] sp_id={sp_id}: keys remapped → {sorted(remapped)}")


def downgrade():
    # Lossy by design (names were localized); no automatic reverse mapping.
    pass
