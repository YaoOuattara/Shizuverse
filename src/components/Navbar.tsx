'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const locale = useLocale();
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '';
  const [mounted, setMounted] = useState(false);
  const [isProvider, setIsProvider] = useState(false);

  useEffect(() => {
    setIsProvider(!!localStorage.getItem('provider_token'));
    setMounted(true);
  }, []);

  const hideBookCta =
    pathWithoutLocale.startsWith('/provider/register') ||
    pathWithoutLocale.startsWith('/booking/');

  const providerHref = isProvider ? `/${locale}/provider` : `/${locale}/provider/register`;
  const providerLabel = isProvider
    ? (locale === 'fr' ? 'Mon tableau de bord' : 'My Dashboard')
    : (locale === 'fr' ? 'Devenir prestataire' : 'Become a Provider');

  const staticLinks = [
    { label: locale === 'fr' ? 'Accueil' : 'Home', href: `/${locale}` },
    { label: locale === 'fr' ? 'Réservations' : 'Bookings', href: `/${locale}/bookings` },
  ];
  const navLinks = mounted
    ? [...staticLinks, { label: providerLabel, href: providerHref }]
    : staticLinks;

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <Image
            src={locale === 'fr' ? '/FR Logo Shizu.PNG' : '/EN Logo Shizu.PNG'}
            alt="Shizu"
            width={44}
            height={44}
            className="rounded-lg"
          />
          <span className="font-bold text-[#0F3A7A] tracking-widest text-lg hidden sm:block">
            SHIZU
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 hover:text-[#0F3A7A] font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: locale pill + CTA */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center bg-gray-100 rounded-full p-0.5 text-xs font-medium">
            {(['en', 'fr'] as const).map((code) => (
              <Link
                key={code}
                href={`/${code}${pathWithoutLocale}`}
                className={`px-3 py-1 rounded-full transition-all ${
                  locale === code
                    ? 'bg-white text-[#0F3A7A] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {code.toUpperCase()}
              </Link>
            ))}
          </div>

          {!hideBookCta && (
            <Link
              href={`/${locale}/services`}
              className="bg-[#0F3A7A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d3068] transition-colors"
            >
              {locale === 'fr' ? 'Réserver' : 'Book Now'}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
