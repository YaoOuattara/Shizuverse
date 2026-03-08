// src/app/[locale]/booking/success/page.tsx

import { getTranslations } from 'next-intl/server';

type Params = {
  params: {
    locale: string;
  };
};

export default async function BookingSuccessPage({ params }: Params) {
  const t = await getTranslations({ locale: params.locale, namespace: 'booking' });

  return (
    <main>
      <h1>{t('successTitle')}</h1>
      <p>{t('successMessage')}</p>
    </main>
  );
}
