// src/components/Navbar.tsx (example)
'use client';
import {useTranslations} from 'next-intl';

export default function Navbar() {
  const t = useTranslations('common');
  return <nav>{t('language')}</nav>;
}
