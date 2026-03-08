'use client';

import {useLocale} from 'next-intl';
import Link from 'next/link';               // ← use Next's Link
import {usePathname} from 'next/navigation';

const SUPPORTED = [
  {code: 'en', label: 'English'},
  {code: 'fr', label: 'Français'}
] as const;

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');

  return (
    <div style={{display: 'flex', gap: 8}}>
      {SUPPORTED.map(({code, label}) => (
        <Link
          key={code}
          href={`/${code}${pathWithoutLocale || ''}`}
          prefetch
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            background: locale === code ? '#eee' : '#f7f7f7'
          }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

