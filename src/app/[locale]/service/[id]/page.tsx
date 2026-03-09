import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';

// Placeholder until real service data source is wired
const services: { id: string; name: string; description: string }[] = [];

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
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

export default async function ServicePage({ params }: Props) {
  const { locale, id } = await params;
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
