// src/app/[locale]/service/[id]/page.tsx

import { getTranslations } from 'next-intl/server';
import { services } from '@/src/data/services'; // hypothetical service data
import { Metadata } from 'next';

type Params = {
  params: {
    locale: string;
    id: string;
  };
};

// 🧠 Metadata handler
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, id } = params;
  const t = await getTranslations({ locale, namespace: 'services' });

  const service = services.find((s) => s.id === id);
  if (!service) return { title: t('notFoundTitle') };

  return {
    title: `${service.name} | Shizu`,
    description: t('serviceDescription', { name: service.name }),
    alternates: {
      canonical: `/${locale}/service/${id}`,
      languages: {
        en: `/en/service/${id}`,
        fr: `/fr/service/${id}`,
      },
    },
  };
}

// 🌐 Page component
export default async function ServicePage({ params }: Params) {
  const { locale, id } = params;
  const t = await getTranslations({ locale, namespace: 'services' });

  const service = services.find((s) => s.id === id);
  if (!service) return <p>{t('notFound')}</p>;

  return (
    <main>
      <h1>{service.name}</h1>
      <p>{service.description}</p>
    </main>
  );
}

