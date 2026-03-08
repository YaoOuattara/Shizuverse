'use server';

import { redirect } from 'next/navigation';

export async function submitBooking(formData: FormData) {
  const requiredFields = ['name', 'phone', 'location', 'date', 'serviceId'];

  for (const field of requiredFields) {
    if (!formData.get(field)) {
      throw new Error(`Missing field: ${field}`);
    }
  }

  console.log('📅 Booking submitted:', {
    name: formData.get('name'),
    phone: formData.get('phone'),
    location: formData.get('location'),
    date: formData.get('date'),
    notes: formData.get('notes'),
    serviceId: formData.get('serviceId')
  });

  redirect('/en/booking/success'); // or dynamic with locale
}
