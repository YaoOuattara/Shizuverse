# Shizuverse — Claude Code Context

## Project
Abidjan-based home services booking marketplace (Côte d'Ivoire).
Clients book cleaners, plumbers, electricians, etc. Providers accept and fulfill bookings.
Currency: **CFA (XOF)**. Primary locale: **fr-CI**.

## Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand
- **Backend**: Flask API deployed on Render
- **Production API**: https://shizu-verse.onrender.com
- **Frontend (Vercel)**: https://client-sigma-gilt.vercel.app
- **Admin login**: https://client-sigma-gilt.vercel.app/en/admin/login
- **Dev**: `npm run dev` → localhost:3000

## i18n — CRITICAL RULES
- All pages live under `src/app/[locale]/` routing (bilingual: `en` + `fr`)
- **next-intl** handles i18n. Translation files: `src/messages/en.json` and `src/messages/fr.json`
- Locale middleware: `src/middleware.ts` — handles detection and redirects
- In page components, locale is extracted via `useParams()` → `params.locale`
- **NEVER hardcode English or French strings directly in components** — always use `useTranslations()` hook
- Admin panel is accessible at both `/en/admin` and `/fr/admin`
- All client-facing pages must support both locales

## Admin Panel
- **Local**: `localhost:3000/en/admin` (also `/fr/admin`)
- **Production**: https://client-sigma-gilt.vercel.app/en/admin/login
- Auth: JWT token in localStorage (`shizu_admin_token`) — login at `/[locale]/admin/login`

### 6 sections
| Section   | File                          | Status         |
|-----------|-------------------------------|----------------|
| Overview  | `AdminOverview.tsx`           | ✅ Live API     |
| Bookings  | `AdminBookings.tsx`           | ✅ Live API     |
| Providers | `AdminProviders.tsx`          | ✅ Live API     |
| Services  | `AdminServices.tsx`           | ✅ Live API     |
| Payments  | `AdminPayments.tsx`           | Mock only      |
| Reviews   | `AdminReviews.tsx`            | Mock only      |

## Key Files

### API layer
- `src/lib/api.ts` — Flask API client (`adminApi` object with all endpoints)
- `src/hooks/useAdminApi.ts` — React hooks: `useAdminStats`, `useAdminBookings`, `useAdminProviders`, `useAdminServices`; exports `ApiBooking`, `ApiProvider`, `ApiService`, `ApiStats` interfaces

### Flask API endpoints (live)
```
GET  /api/admin/stats
GET  /api/admin/bookings[?status=...]
GET  /api/admin/providers[?status=...]
GET  /api/admin/services
PATCH /api/admin/bookings/<id>/status   body: { status }
PATCH /api/admin/providers/<id>/verify
```

### Mock store — DO NOT REWRITE
- `src/data/adminStore.ts` — Zustand store with persist middleware
- Contains rich `AdminBooking`, `AdminProvider`, `AdminService`, `AdminReview` types
- Still used by: Payments page, Reviews page, assign-provider modal, quote pricing engine, review display in booking drawer
- **Do not touch the mock data structure or zustand persist setup**

### Admin components
`src/app/[locale]/admin/` — all admin page components + `AdminLayout.tsx`

### Wiring pattern (for future pages)
1. Import hook from `useAdminApi.ts` → get `{ data, loading }` from API
2. Map `Api*` type → rich local type via `useMemo` (for lists) or `useState + useEffect` (when local mutations needed)
3. Call `adminApi.*` for mutations the API supports; update local state for the rest
4. Show `<Loader2 animate-spin />` while loading

## Build Plan — Remaining Steps

### Step 5 — Fix pre-existing TS error
File: `src/app/[locale]/booking/[serviceId]/page.tsx`
Error: `TS1128: Declaration or statement expected` at line 3
Fix before building new pages.

### Step 6 — Client booking pages
Source to port: `~/Downloads/Booking-Display/client/src/`
Pages needed: service listing, service detail, booking form, booking confirmation
Must use `useTranslations()` and support both locales.

### Step 7 — Provider dashboard
New section for providers to view their bookings, update availability, see earnings.
Will need new Flask endpoints and a new hook file.

### Step 8 — Real admin auth ✅ Done
JWT token auth. POST /api/admin/login (ADMIN_PASSWORD env var). @require_admin_token on all admin routes.

## Session Workflow
- Always read CLAUDE.md at the start of each session
- After completing any step, update ~/Desktop/Shizuverse/Backend/journal.txt
- Run `npx tsc --noEmit` after every file change and fix errors before moving on
- Never fix TS errors in files that are marked for replacement in the build plan
- Prefer surgical edits over full rewrites — keep existing UI and just swap data sources
- For client-facing pages: always use useTranslations() and never hardcode strings
- Commit to git and push to staging branch after completing each major step

## Rate Limit Optimization
- Batch related tasks in one prompt — never ask for one file at a time
- Always specify the full scope upfront: "do X, Y, Z then commit"
- Prefer writing complete files over incremental edits when creating new pages
- Run tsc --noEmit only ONCE after all files in a step are written, not after each file
- Use background tasks (ctrl+b) for long bash commands like git add -A
- When rate limit is near, finish current file, run tsc, commit, then stop cleanly
- Priority order if interrupted mid-step: 1) save current file 2) run tsc 3) commit what works 4) note what's left in journal

## Pre-built Prompts for Next Sessions
When starting a new session, use exactly:
"Read CLAUDE.md. Continue from journal.txt last entry. [specific task]."

Remaining work after MVP:
- Wire /bookings page to real client API (currently uses mock data)
- Wire /provider page to real provider API (currently uses mock data)
- Set ADMIN_PASSWORD env var on Render
- ~~Set NEXT_PUBLIC_FLASK_API_URL on Vercel dashboard~~ ✅ Done
- Payment integration (Wave, Orange Money)
- Push backend to git and deploy updated Flask with JWT auth
- Fix Tailwind purge / styling on production (pages look unstyled)

## Known Issues
- Pages look minimal/unstyled on production — suspect Tailwind purge config
- Admin login on production needs testing with password YaAllahShizu@1
- /bookings and /provider pages still use mock data

## Conventions
- Components: PascalCase, `.tsx`
- Hooks: camelCase, `use` prefix, in `src/hooks/`
- All monetary values in CFA; use `formatMoney(amount, currency)` from `src/lib/currency.ts`
- `format` / `parseISO` from `date-fns` for date handling
- shadcn/ui components from `@/components/ui/`
- `useToast` from `@/hooks/use-toast` for notifications
- Pricing logic lives in `src/utils/pricingEngine.ts` (zone × urgency × time multipliers)
