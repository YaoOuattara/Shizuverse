# Manual Test Checklist — Shizuverse

Base URL: `https://shizu-verse.onrender.com`  
Frontend: `https://client-sigma-gilt.vercel.app`  
Admin panel: `https://client-sigma-gilt.vercel.app/en/admin`

Mark each step **PASS** or **FAIL** and note any unexpected behaviour.

---

## Scenario 1 — Anonymous client books a service

1. Open `https://client-sigma-gilt.vercel.app`
2. Navigate to a service (e.g. Ménage / Cleaning)
3. Click **Réserver** / **Book**
4. Fill in: name, phone number (Ivorian format, e.g. `0701234567`), address (commune), preferred date/time
5. Submit the booking form
6. **Expected**: Confirmation message with booking reference displayed on screen
7. Check API: `GET /api/admin/bookings` (with admin token) — new booking appears with status `pending`

| Step | Result | Notes |
|------|--------|-------|
| 1–4  | | |
| 5    | | |
| 6    | | |
| 7    | | |

---

## Scenario 2 — Admin login

1. Open `https://client-sigma-gilt.vercel.app/en/admin/login`
2. Enter the admin password
3. **Expected**: Redirect to admin overview dashboard
4. Verify stats cards load (bookings count, providers count, revenue)
5. Try an incorrect password → **Expected**: Error message, no redirect

| Step | Result | Notes |
|------|--------|-------|
| 2–3  | | |
| 4    | | |
| 5    | | |

---

## Scenario 3 — Admin reviews and approves a provider

1. Log in to admin panel (Scenario 2)
2. Navigate to **Prestataires / Providers** section
3. Find a provider with status `submitted`
4. Click on their row to open the detail sheet
5. Verify their documents, services, and zones are displayed
6. If services include **Beauté à domicile** and no ID document is uploaded:
   - **Expected**: Amber banner "⚠️ Catégorie sensible — ID gouvernemental obligatoire avant approbation"
   - **Expected**: Approve button is disabled with label "Document d'identité manquant"
7. For a provider without beauty services (or with ID uploaded): click **Approuver**
8. **Expected**: Provider status changes to `approved`, toast notification appears

| Step | Result | Notes |
|------|--------|-------|
| 3–5  | | |
| 6    | | |
| 7–8  | | |

---

## Scenario 4 — Admin manages a booking (confirm → complete)

1. Log in to admin panel
2. Navigate to **Réservations / Bookings**
3. Open a booking with status `pending`
4. Click **Confirmer** → **Expected**: Status changes to `confirmed`
5. Reopen the same booking
6. Click **Marquer en cours** (if available) or **Marquer terminé**
7. **Expected**: Status updates correctly, timeline in drawer reflects each change
8. Verify cancel button is available at each intermediate status

| Step | Result | Notes |
|------|--------|-------|
| 3–4  | | |
| 5–6  | | |
| 7–8  | | |

---

## Scenario 5 — Provider registers and logs in

1. Open `https://client-sigma-gilt.vercel.app/fr/provider/register`
2. **Step 1**: Enter name, phone, password, select commune → click Continuer
3. **Step 2**: Select service category, select zones, set pricing → click Continuer
4. **Step 3**: Add bio, experience, optionally upload profile photo → click **Créer mon compte**
5. **Expected**: Success screen with "Votre candidature est en cours d'examen" or similar
6. Log in at `https://client-sigma-gilt.vercel.app/fr/provider/login`
7. **Expected**: Redirect to provider dashboard

| Step | Result | Notes |
|------|--------|-------|
| 2    | | |
| 3    | | |
| 4–5  | | |
| 6–7  | | |

---

## Scenario 6 — Provider views and responds to booking requests

1. Log in as a provider (Scenario 5)
2. Open **Mes demandes / My Requests** section
3. **Expected**: List of pending booking requests in provider's zones/category
4. Click on a booking → detail view opens
5. Click **Accepter** → **Expected**: Booking moves to accepted/confirmed state
6. Click **Décliner** on another booking → **Expected**: Booking removed from list or marked declined

| Step | Result | Notes |
|------|--------|-------|
| 2–3  | | |
| 4–5  | | |
| 6    | | |

---

## Scenario 7 — Rate limit enforcement

1. Open a terminal / API client (e.g. Postman, curl)
2. Send 6 rapid `POST /api/admin/login` requests with a wrong password:
   ```bash
   for i in {1..6}; do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST https://shizu-verse.onrender.com/api/admin/login \
       -H "Content-Type: application/json" \
       -d '{"password":"wrongpassword"}'
   done
   ```
3. **Expected**: First 5 attempts return `401`, 6th attempt returns `429`
4. **Expected**: 429 body contains French error message about retrying later

| Step | Result | Notes |
|------|--------|-------|
| 3    | | |
| 4    | | |

---

## Scenario 8 — Locale switching (French ↔ English)

1. Open `https://client-sigma-gilt.vercel.app/fr` — verify UI is in French
2. Switch to `https://client-sigma-gilt.vercel.app/en` — verify UI is in English
3. Navigate through: home → service detail → booking form in each locale
4. **Expected**: All labels, buttons, and error messages are translated (no hardcoded French or English strings)
5. Open admin panel at `/en/admin` and `/fr/admin` — verify both work and labels switch

| Step | Result | Notes |
|------|--------|-------|
| 1–2  | | |
| 3–4  | | |
| 5    | | |

---

## Sign-off

| Tester | Date | Environment | Overall result |
|--------|------|-------------|----------------|
| | | Production | |
| | | Staging | |
