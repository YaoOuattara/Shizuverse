# Shizuverse — Developer Guide

This document is the entry point for any developer new to the codebase. Read it before touching anything.

---

## 1. Architecture Overview

Two separate repositories, two separate deploys:

| Repo | Stack | Deploy target | Branch |
|------|-------|---------------|--------|
| `ShizuverseFrontend` | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui | Vercel | `frontend` |
| `Shizuverse` (this repo) | Flask, SQLAlchemy, PostgreSQL | Render | `staging` |

**Never push directly to `main` on either repo.** All work goes through `staging` (backend) or `frontend` (frontend) and is promoted to `main` deliberately.

### URLs

| Environment | URL |
|-------------|-----|
| Production (frontend) | https://www.shizu.pro |
| Staging frontend | https://client-sigma-gilt.vercel.app |
| Backend API | https://shizu-verse.onrender.com |
| Admin login | https://client-sigma-gilt.vercel.app/en/admin/login |

---

## 2. Backend Structure

### Blueprint families

There are **two separate blueprint families** registered in `app.py`. This is the single most important thing to understand before editing backend code.

**`shizuverse/routes/`** — the live admin portal, auth, and provider-facing pages
- `routes/admin.py` — admin portal API used by the Next.js admin panel
  - Auth decorator: `@admin_required` (JWT Bearer token, checked against `ADMIN_PASSWORD`)
  - This is the authoritative admin blueprint. All new admin routes go here.
- `routes/auth.py` — client/provider login and registration
- `routes/providers.py` — provider-facing routes

**`shizuverse/api/`** — client-facing REST API consumed by the Next.js frontend
- `api/admin.py` — **older** provider-facing routes; uses `@require_admin_token` (different decorator, different auth flow)
  - Do not confuse this with `routes/admin.py`. Do not add new admin portal routes here.
- `api/bookings.py` — booking creation and retrieval
- `api/reviews.py` — review submission and moderation
- `api/services/services.py` — service and category listing (live file; the top-level `api/services.py` was deleted)

### Key models (`shizuverse/models/`)

| Model | Purpose |
|-------|---------|
| `User` | Auth record for clients and providers (`user_type`: `client` \| `provider`) |
| `ServiceProvider` | Provider profile, verification status, zones, services offered |
| `ClientBooking` | A booking made by a client |
| `BookingEvent` | Status history log for a booking |
| `Review` | Client review of a completed booking |
| `Service` | A bookable service (e.g. "Plomberie — fuite d'eau") |
| `ServiceCategory` | Top-level category (e.g. "Plomberie") |
| `ServiceSubcategory` | Mid-level grouping linking Service → Category |

### Database and migrations

- Single PostgreSQL instance, provisioned by Render.
- Migrations managed by Alembic via Flask-Migrate.
- After adding a new migration locally, push to `staging` and run in the Render shell:
  ```
  flask db upgrade
  ```
- To check current migration state: `flask db current`
- There are currently three merge migration heads in the history (`merge_heads_20260424`, `merge_migration_heads_may2026`, `merge_migration_heads_may2026_v2`). Do not add more merge migrations without resolving the existing ones.

### Rate limiting

Configured in `shizuverse/limiter.py`. Uses `REDIS_URL` env var if set; falls back to in-memory storage. In-memory is acceptable at current scale but does not persist across Render restarts.

---

## 3. Frontend Structure

### API calls

- **Admin panel**: use the `adminApi` object from `src/lib/api.ts`. All admin endpoints and auth headers are handled there.
- **Client-facing pages**: always use `process.env.NEXT_PUBLIC_FLASK_API_URL` directly. Do not define `FLASK_API` inline in individual files — it has been done before and caused stale hardcoded URLs.

### Cloudinary

Upload credentials appear directly in `src/app/[locale]/provider/profile/page.tsx` and `src/app/[locale]/provider/register/page.tsx`. This is intentional for MVP. Do not move them to env vars without discussing — it affects the upload preset configuration.

### Admin components

All admin sections live in `src/app/[locale]/admin/`. These are large files:

- `AdminBookings.tsx` — ~2,450 lines, handles the full booking lifecycle
- `AdminProviders.tsx`, `AdminServices.tsx`, `AdminOverview.tsx` — wired to live API
- `AdminPayments.tsx`, `AdminReviews.tsx` — partially mock data

Edit carefully. The Zustand store in `src/data/adminStore.ts` (with `persist` middleware) is still used by Payments, Reviews, and parts of the booking drawer. **Do not touch the mock data structure or the Zustand persist setup.**

### Locale routing

All pages live under `src/app/[locale]/`. French (`fr`) is the default locale. The `[locale]` segment is populated by `src/middleware.ts` via next-intl.

**Never hardcode French or English strings in components.** Always use `useTranslations()` from next-intl. Translation files are at `src/messages/en.json` and `src/messages/fr.json`.

---

## 4. Environment Variables

### Backend (set in Render dashboard → Environment)

| Variable | Required | Notes |
|----------|----------|-------|
| `SECRET_KEY` | Yes | App refuses to start in production without it |
| `DATABASE_URL` | Yes | Auto-set by Render PostgreSQL add-on |
| `ADMIN_PASSWORD` | Yes | Admin portal login password |
| `ANTHROPIC_API_KEY` | Yes | Required for all AI features |
| `CLOUDINARY_CLOUD_NAME` | Yes | `ddilgv5ir` |
| `ENV` | Yes | Must be `"production"` on Render |
| `REDIS_URL` | No | Rate limiter; falls back to memory if absent |
| `CORS_ORIGINS` | No | Comma-separated extra origins to allow |

### Frontend (set in Vercel dashboard → Settings → Environment Variables)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_FLASK_API_URL` | Yes | e.g. `https://shizu-verse.onrender.com` |

---

## 5. Deploy Process

### Backend

1. Commit and push to `staging` branch.
2. Render detects the push and auto-deploys (takes ~2 min on cold start, ~30 s on warm).
3. If the commit added a new Alembic migration: open the Render shell and run `flask db upgrade`.
4. Verify the deploy succeeded in the Render dashboard → Events tab.

### Frontend

1. Commit and push to `frontend` branch.
2. Vercel detects the push and auto-deploys.
3. Confirm the deployment is live in the Vercel dashboard before calling it done.
4. Hard-refresh the browser to bypass CDN cache if changes are not visible.

---

## 6. Known Technical Debt

Do not fix any of the following without discussing with the team first — they are load-bearing in their current state.

| Item | Location | Notes |
|------|----------|-------|
| Two admin.py files with different auth decorators | `routes/admin.py` vs `api/admin.py` | `routes/admin.py` is the live one; `api/admin.py` has older provider-facing routes |
| `AdminBookings.tsx` is ~2,450 lines | `src/app/[locale]/admin/AdminBookings.tsx` | Needs splitting into sub-components, but currently works |
| Logo files have baked-in backgrounds | Cloudinary assets | Future fix: replace with `ShizuLogo.tsx` SVG component |
| Rate limiter uses memory storage | `shizuverse/limiter.py` | Acceptable at MVP scale; set `REDIS_URL` to switch to Redis |
| Three unresolved merge migration heads | `migrations/versions/` | Do not add more merges without resolving existing ones |

---

## 7. Common Incident Playbook

### Backend is down / returning 500

1. Open Render dashboard → select the `shizu-verse` service → **Events** tab.
2. Look for a failed deploy or a crashed process.
3. Check logs in the **Logs** tab for the traceback.
4. If it's a migration error, open the Render shell and run `flask db current` and `flask db upgrade`.

### Database errors

```bash
# In Render shell
flask db current          # shows current revision
flask db history          # shows full migration graph
flask db upgrade          # applies any unapplied migrations
```

### Frontend not showing latest changes

1. Check Vercel dashboard — confirm the latest commit is deployed (green checkmark).
2. Hard-refresh the browser (`Cmd+Shift+R` on Mac).
3. If the deployment failed, check the build log in Vercel for TypeScript or import errors.

### AI features not working

Verify `ANTHROPIC_API_KEY` is set in the Render environment. The key is not committed to the repo.

### Cloudinary uploads failing

Verify `CLOUDINARY_CLOUD_NAME` is set to `ddilgv5ir` in the Render environment. Also check that the upload preset configured in the Cloudinary dashboard is set to **unsigned** (required for client-side uploads from the provider registration form).

---

## 8. Rollback Procedures

### Frontend (Vercel)

1. Go to vercel.com → project `client` → Deployments
2. Find the last known good deployment
3. Click the three dots → "Promote to Production"
4. Takes ~30 seconds, no rebuild needed

### Backend (Render)

1. Go to Render dashboard → Shizuverse → Events
2. Find the last successful deploy commit hash
3. In your local terminal: `git checkout <commit-hash> && git push origin staging --force`
4. **WARNING**: only force-push to `staging`, never to `main`
5. Run `flask db upgrade` in the Render shell if migrations are involved

### Database Emergency

If data is corrupted:

1. Go to console.neon.tech → your project → Branches
2. Use point-in-time restore to recover to a previous state
3. Update `DATABASE_URL` in Render environment if a new branch is created

---

## 9. Incident Response Plan

### Severity Levels

**P0 — Platform Down** (site unreachable, DB down, payments broken)
- **Who**: Yao immediately
- **First action**: Check UptimeRobot alert → Render dashboard → Vercel dashboard
- **Resolution target**: 1 hour
- **Communicate**: WhatsApp message to active providers and clients if > 30 min down

**P1 — Feature Broken** (booking flow broken, admin inaccessible, login failing)
- **Who**: Yao or dev on call
- **First action**: Check Sentry for error → identify commit → rollback if needed
- **Resolution target**: 4 hours

**P2 — Minor Bug** (UI glitch, non-critical feature broken)
- **Who**: Next available dev
- **First action**: Log in GitHub Issues
- **Resolution target**: Next deploy

### Data Breach Protocol

1. Immediately revoke all JWT tokens: change `SECRET_KEY` in Render environment
2. Notify affected users via WhatsApp within 24h
3. Document what data was exposed and how
4. Contact: contact@shizu.pro

### Common Incidents & Fixes

| Symptom | Fix |
|---------|-----|
| Backend cold start slow | Normal on Render free tier — upgrade to paid if persistent |
| Vercel deploy stuck | Vercel → Deployments → Redeploy latest commit |
| DB connection errors | Check `DATABASE_URL` in Render → verify Neon service status at status.neon.tech |
| AI features broken | Verify `ANTHROPIC_API_KEY` in Render environment |
| Cloudinary uploads failing | Verify `CLOUDINARY_CLOUD_NAME` in Render environment |
| Admin login failing | Verify `ADMIN_PASSWORD` in Render environment → check JWT `SECRET_KEY` |
