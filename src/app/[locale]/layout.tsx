import '@/app/globals.css';
import * as React from 'react';
import {NextIntlClientProvider} from 'next-intl';
import {notFound} from 'next/navigation';
import {locales, type Locale, loadMessages} from '@/i18n';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import { ProviderAuthProvider } from '@/context/ProviderAuthContext';
import { Analytics } from '@vercel/analytics/react';
import PwaRegistration from '@/components/PwaRegistration';
import { Toaster } from "@/components/ui/toaster";
import InstallPrompt from '@/components/InstallPrompt';
import NativePlatformBridge from '@/components/NativePlatformBridge';

const NATIVE_VIEWPORT_SCRIPT = `(function () {
  try {
    var C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
    var m = document.createElement('meta');
    m.name = 'viewport';
    m.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
    var head = document.head;
    head.appendChild(m);
    new MutationObserver(function () {
      var all = head.querySelectorAll('meta[name="viewport"]');
      if (all[all.length - 1] !== m) head.appendChild(m);
    }).observe(head, { childList: true });
  } catch (e) {}
})();`;

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
        {/* App Capacitor uniquement : viewport-fit=cover pour que les env(safe-area-inset-*)
            aient une valeur. Le pont natif est injecté avant ce script ; sur le web
            window.Capacitor n'existe pas et rien ne change (Safari paysage, PWA inclus).
            On ajoute notre propre balise (la dernière l'emporte) sans toucher à celle de
            Next — React 19 en réinsérerait une — et on la garde en dernier quand Next en
            rajoute une lors d'une navigation client. */}
        <script dangerouslySetInnerHTML={{ __html: NATIVE_VIEWPORT_SCRIPT }} />
        <link rel="icon" type="image/png" href="https://res.cloudinary.com/ddilgv5ir/image/upload/v1779646648/shizu_icon_square_hkmm06.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#0D2B6B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Shizu" />
        <meta property="og:image" content="https://res.cloudinary.com/ddilgv5ir/image/upload/v1779646648/shizu_icon_square_hkmm06.png" />
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
          <InstallPrompt />
          {/* SANS ce montage, les 15 fichiers qui appellent useToast écrivent
              dans un état mémoire que rien ne rend : chaque toast du projet
              (sauvegardes, remboursements, erreurs réseau…) était un no-op
              silencieux. Le viewport est z-[100], au-dessus de tout header
              sticky (max z-50) — pas de conflit. */}
          <Toaster />
        </NextIntlClientProvider>
        <Analytics />
        <PwaRegistration />
        <NativePlatformBridge />
      </body>
    </html>
  );
}

