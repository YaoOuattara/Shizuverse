import '@/app/globals.css';
import * as React from 'react';
import {NextIntlClientProvider} from 'next-intl';
import {notFound} from 'next/navigation';
import {locales, type Locale, loadMessages} from '@/i18n';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import { ProviderAuthProvider } from '@/context/ProviderAuthContext';

export function generateStaticParams() {
  return locales.map((locale) => ({locale}));
}

type Props = { children: React.ReactNode; params: Promise<{locale: string}> };

export default async function RootLayout({children, params}: Props) {
  const {locale} = await params;
  if (!locales.includes(locale as Locale)) notFound();

  const messages = await loadMessages(locale as Locale);

  return (
    <html lang={locale}>
      <head>
        <link rel="icon" type="image/png" href="https://res.cloudinary.com/ddilgv5ir/image/upload/v1778425102/shizu_icon_square_csisos.png" />
        <meta property="og:image" content="https://res.cloudinary.com/ddilgv5ir/image/upload/v1778425102/shizu_icon_square_csisos.png" />
        <meta property="og:title" content="Shizu — Nous prenons le relais" />
        <meta property="og:description" content="Prestataires vérifiés à Abidjan. Réservation en 60 secondes." />
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ProviderAuthProvider>
            <AnalyticsProvider>
              {children}
            </AnalyticsProvider>
          </ProviderAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

