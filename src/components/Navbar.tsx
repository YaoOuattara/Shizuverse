'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

function HummingbirdIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C9 3 6.5 5 6 8c-1.5 0-3 1-3 2.5 0 1 .6 1.8 1.5 2.2L3 16h3l1-2.5c.5.3 1 .5 1.5.5h1L10 17h2l1.5-3.5C16 13 18 10.5 18 8c0-2.8-2.7-5-6-5z" fill="#0F3A7A"/>
      <path d="M9.5 8.5c0 .8-.7 1.5-1.5 1.5S6.5 9.3 6.5 8.5 7.2 7 8 7s1.5.7 1.5 1.5z" fill="white"/>
      <path d="M18 8c0 0 2-1 4-1-1.5 1-2 2.5-2 2.5" stroke="#0F3A7A" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function Navbar() {
  const locale = useLocale();
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '';

  const navLinks = [
    { label: locale === 'fr' ? 'Accueil' : 'Home', href: `/${locale}` },
    { label: locale === 'fr' ? 'Réservations' : 'Bookings', href: `/${locale}/bookings` },
    { label: locale === 'fr' ? 'Devenir prestataire' : 'Become a Provider', href: `/${locale}/provider` },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <HummingbirdIcon />
          <span className="font-bold text-[#0F3A7A] tracking-widest text-lg">SHIZU</span>
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

          <Link
            href={`/${locale}/bookings`}
            className="bg-[#0F3A7A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d3068] transition-colors"
          >
            {locale === 'fr' ? 'Réserver' : 'Book Now'}
          </Link>
        </div>
      </div>
    </nav>
  );
}
