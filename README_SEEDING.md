🌱 Shizu Service Seeding Guide
This guide explains how to seed services into the Shizu database using the provided CSV files. It covers technical setup (for developers) and business workflow (for managing skipped services and future updates).

📂 CSV Sources

We maintain two main CSV datasets under data/services/:
Prioritized services → prioritized_services.csv
These are core services available on the platform by default.
Seeded automatically with make seed-prioritized.
Non-prioritized services → non_prioritized_services.csv
Optional services not yet prioritized.
Can be seeded later with make seed-non-prioritized.
⚠️ Important: Rows without a subcategory are automatically skipped. This enforces taxonomy discipline and supports professionalizing the informal sector.
⚙️ Developer Setup
Ensure your .env file points to the correct database:
DATABASE_URL=postgresql://user:password@host:5432/dbname
Run migrations if not already applied:
flask db upgrade
Use the provided Makefile commands (see below).

🚀 Seeding Commands
Seed prioritized services (active list)
make seed-prioritized
Seed non-prioritized services (inactive by default)
make seed-non-prioritized
View skipped services log
make skipped-log
Inspect skipped services CSV
make skipped-csv

📊 Skipped Services
Why services are skipped
Missing subcategory (mandatory field).
Critical missing fields (e.g., service name).
Where skipped services are recorded
skipped_services.log → developer/debug log (with full row info).
skipped_services.csv → structured export for business team.
🏢 Business Workflow
Open skipped_services.csv.
Assign missing taxonomy (e.g., subcategory).
Move corrected rows into either:
prioritized_services.csv → to activate, or
non_prioritized_services.csv → to hold until needed.
Re-run seeding via make.
📌 Best Practices
Always seed prioritized list first.
Keep skipped services CSV and non-prioritized list on the desk of the business team managing services.
Treat the seeding pipeline as a taxonomy enforcement tool to ensure clarity in how services are listed.
If new services are added, update the relevant CSVs and re-run seeding.
✅ Example Workflow
Developer runs:
make seed-prioritized
→ Seeds all prioritized services into DB.
Some rows are skipped (due to missing subcategories).
Business team reviews skipped_services.csv, fixes taxonomy.
Updated rows get added to non_prioritized_services.csv.
Later, developer runs:
make seed-non-prioritized
→ Non-priority services are imported when needed.
That way, tech + business are always aligned ✅


# 🌱 Seeding Guide for Services

This document explains how to seed services into the Shizu DB.

---

## 📂 CSV Sources

- `data/services/prioritized_services.csv` → prioritized list (active by default)
- `data/services/non_prioritized_services.csv` → optional list (inactive by default)
- `skipped_services.csv` → services that were skipped due to missing data (subcategory, etc.), for **business team review**

---

## 🚀 Running Seeding

Use the **Makefile** for convenience:

```bash
# Seed prioritized services
make seed-prioritized

# Seed non-prioritized services (optional)
make seed-non-prioritized

# Seed approved professional submissions
make seed-submissions

# Seed prioritized + approved submissions together
make seed-all
