import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function BookingSuccessPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <main>
      <h1>{t('successTitle')}</h1>
      <p>{t('successMessage')}</p>
    </main>
  );
}
