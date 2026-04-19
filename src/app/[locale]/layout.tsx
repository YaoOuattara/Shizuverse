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

