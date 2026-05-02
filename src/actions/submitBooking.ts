'use server';

import { redirect } from 'next/navigation';

export async function submitBooking(formData: FormData) {
  const FLASK_API =
    process.env.NEXT_PUBLIC_FLASK_API_URL ||
    process.env.FLASK_API_URL ||
    'https://shizu-verse.onrender.com';

  const client_name     = (formData.get('name')      as string | null) ?? '';
  const client_phone    = (formData.get('phone')     as string | null) ?? '';
  const client_location = (formData.get('location')  as string | null) ?? '';
  const service_id_raw  = (formData.get('serviceId') as string | null) ?? '';
  const appointment_date = (formData.get('date')     as string | null) ?? '';
  const notes           = (formData.get('notes')     as string | null) ?? '';
  const locale          = (formData.get('locale')    as string | null) ?? 'fr';

  if (!client_name || !client_phone || !client_location || !appointment_date) {
    throw new Error('Missing required fields');
  }

  // service_id from URL is numeric; serviceId could also be a slug string
  const service_id = service_id_raw ? parseInt(service_id_raw, 10) : null;
  const service_slug = (!service_id && service_id_raw) ? service_id_raw : undefined;

  // Flask expects ISO 8601 — the date input gives YYYY-MM-DD, append midnight
  const appointment_iso = appointment_date.includes('T')
    ? appointment_date
    : `${appointment_date}T08:00:00`;

  const body: Record<string, unknown> = {
    client_name,
    client_phone,
    client_location,
    appointment_date: appointment_iso,
    notes: notes || undefined,
    ...(service_id  ? { service_id }    : {}),
    ...(service_slug ? { service_slug } : {}),
  };

  const res = await fetch(`${FLASK_API}/api/bookings/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Booking failed (${res.status}): ${text}`);
  }

  const data = await res.json().catch(() => ({})) as { id?: number };
  const bookingId = data.id;
  const year = new Date().getFullYear();
  const ref = bookingId ? `SHZ-${year}-${bookingId}` : null;
  redirect(`/${locale}/booking/success${ref ? `?ref=${ref}` : ''}`);
}
