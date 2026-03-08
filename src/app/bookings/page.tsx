// src/app/[locale]/bookings/page.tsx
import {useTranslations} from 'next-intl';

export default function BookingsPage() {
  const t = useTranslations('booking');

  return (
    <main style={{padding: 16}}>
      <h1>{t('title')}</h1>
      <ul>
        <li>{t('selectDate')}</li>
        <li>{t('selectTime')}</li>
        <li>{t('confirmBooking')}</li>
      </ul>
    </main>
  );
}

