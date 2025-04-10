# 🧬 Database Migrations – Shizu Backend

Shizu uses **Flask-Migrate (Alembic)** for schema versioning. This ensures structured upgrades without losing production data.

## 🔧 Usage

### 1. Create Migration Folder (already done)
```bash
flask db init
```

### 2. Auto-generate Migration
```bash
flask db migrate -m "Initial schema"
```

### 3. Apply Migration
```bash
flask db upgrade
```

### 4. Validate Schema
```bash
python utils/migration_validator.py
```

## 🗂 Structure

- `migrations/env.py` – Alembic migration environment setup.
- `migrations/versions/` – All historical schema changes.
- `manual_bootstrap.py` – One-time full DB init (if needed).

