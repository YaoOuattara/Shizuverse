'use client';

import { useEffect } from 'react';

// Point d'accroche pour le comportement natif (coquille Capacitor iOS/Android).
// Aucun comportement natif pour l'instant : on détecte seulement. Exécuté
// uniquement côté client, et toute erreur est avalée pour ne jamais casser le web.
export default function NativePlatformBridge() {
  useEffect(() => {
    let cancelled = false;

    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (cancelled || !Capacitor.isNativePlatform()) return;
        // Natif uniquement — brancher ici les futurs lots (push, deep links…).
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
