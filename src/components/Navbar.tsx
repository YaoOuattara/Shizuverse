'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const locale = useLocale();
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '';
  const [mounted, setMounted]           = useState(false);
  const [isProvider, setIsProvider]     = useState(false);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [menuOpen, setMenuOpen]         = useState(false);

  useEffect(() => {
    setIsProvider(!!(
      localStorage.getItem('provider_token') ||
      sessionStorage.getItem('provider_token') ||
      localStorage.getItem('provider_info') ||
      sessionStorage.getItem('provider_info')
    ));
    setMounted(true);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isHomePage = pathWithoutLocale === '';

  useEffect(() => {
    if (!isHomePage) return;
    const hero = document.getElementById('hero-section');
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [isHomePage]);

  // Only show booking CTAs after mount (prevents SSR flash) and never for providers
  const showBookCta =
    mounted &&
    !isProvider &&
    !pathWithoutLocale.startsWith('/provider/register') &&
    !pathWithoutLocale.startsWith('/booking/');

  const providerHref  = isProvider ? `/${locale}/provider` : `/${locale}/provider/register`;
  const providerLabel = isProvider
    ? (locale === 'fr' ? 'Mon tableau de bord' : 'My Dashboard')
    : (locale === 'fr' ? 'Devenir prestataire' : 'Become a Provider');

  const staticLinks = [
    { label: locale === 'fr' ? 'Accueil'       : 'Home',     href: `/${locale}` },
    { label: locale === 'fr' ? 'Réservations'  : 'Bookings', href: `/${locale}/bookings` },
  ];
  const navLinks = mounted
    ? [...staticLinks, { label: providerLabel, href: providerHref }]
    : staticLinks;

  const LangPill = ({ size = 'md' }: { size?: 'sm' | 'md' }) => (
    <div className={`flex items-center bg-gray-100 rounded-full p-0.5 font-medium ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>
      {(['en', 'fr'] as const).map((code) => (
        <Link
          key={code}
          href={`/${code}${pathWithoutLocale}`}
          className={`px-2.5 py-1 rounded-full transition-all ${
            locale === code
              ? 'bg-white text-[#0F3A7A] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {code.toUpperCase()}
        </Link>
      ))}
    </div>
  );

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">

        {/* Logo */}
        <Link href={`/${locale}`} className="shrink-0 flex items-center">
          <img
            src="https://res.cloudinary.com/ddilgv5ir/image/upload/v1779646648/shizu_logo_horizontal_dark_khesrn.png"
            alt="Shizu"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
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

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Language switcher — always visible */}
          <LangPill />

          {/* Desktop: Réserver CTA */}
          {showBookCta && (
            <div className={`hidden md:block transition-all duration-300 ${
              isHomePage && isHeroVisible ? 'opacity-0 -translate-y-1 pointer-events-none' : 'opacity-100'
            }`}>
              {isHomePage ? (
                <button
                  onClick={() => {
                    document.getElementById('search-bar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => document.getElementById('search-bar')?.focus(), 400);
                  }}
                  className="bg-[#0F3A7A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d3068] transition-colors"
                >
                  {locale === 'fr' ? 'Réserver' : 'Book Now'}
                </button>
              ) : (
                <Link
                  href={`/${locale}/services`}
                  className="bg-[#0F3A7A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d3068] transition-colors"
                >
                  {locale === 'fr' ? 'Réserver' : 'Book Now'}
                </Link>
              )}
            </div>
          )}

          {/* Mobile: Réserver pill */}
          {showBookCta && (
            <Link
              href={`/${locale}/services`}
              className="md:hidden bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
            >
              {locale === 'fr' ? 'Réserver' : 'Book'}
            </Link>
          )}

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1.5 rounded-lg text-gray-600 hover:text-[#0F3A7A] hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center py-2.5 px-2 text-sm font-medium text-gray-700 hover:text-[#0F3A7A] hover:bg-gray-50 rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {showBookCta && (
            <div className="pt-2 border-t border-gray-100">
              <Link
                href={`/${locale}/services`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center w-full bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-green-700 transition-colors"
              >
                {locale === 'fr' ? '+ Réserver un service' : '+ Book a service'}
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
