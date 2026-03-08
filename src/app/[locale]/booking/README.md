# booking/ — DO NOT EDIT

This entire folder will be **replaced in Step 6** of the build plan.

Source files will be ported from:
`~/Downloads/Booking-Display/client/src/`

## DO NOT:
- Fix TypeScript errors in any file under this folder
- Refactor or extend existing components here
- Add new files here before Step 6

## Files currently present (stubs/drafts only):
- `[serviceId]/page.tsx` — bare-bones stub, not the final implementation
- `success/` — placeholder if present

## Step 6 will build:
- Service listing page
- Service detail page
- Booking form (multi-step, with zone/urgency/time-preference inputs)
- Booking confirmation / success page

All rebuilt pages must use `useTranslations()` for i18n and support both `/en/` and `/fr/` locales.
