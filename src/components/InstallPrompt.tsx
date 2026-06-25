'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Share, X } from 'lucide-react';

// `BeforeInstallPromptEvent` is not part of the standard DOM lib types.
// Minimal local declaration — Chromium-only, single-use.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as "Macintosh" — disambiguate via touch points.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Only Safari can Add to Home Screen on iOS — exclude Chrome/Firefox for iOS.
  const isSafari = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

export default function InstallPrompt() {
  const t = useTranslations('installPrompt');
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Installed users never see the banner.
    if (isStandalone()) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // iOS Safari fires no beforeinstallprompt — fall back to the manual hint.
    if (isIosSafari()) setShowIosHint(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // The event is single-use — discard it regardless of the outcome.
    setDeferredPrompt(null);
  };

  // Render nothing until mounted (avoids hydration mismatch), when dismissed,
  // or when there's no actionable install path on this platform.
  if (!mounted || dismissed) return null;
  const showAndroid = deferredPrompt !== null;
  if (!showAndroid && !showIosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto mb-3 flex max-w-md items-center gap-3 rounded-xl bg-[#0D2B6B] px-4 py-3 text-white shadow-lg">
        <div className="min-w-0 flex-1">
          {showAndroid ? (
            <p className="text-sm font-medium">{t('androidTitle')}</p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm leading-snug">
              <span>{t('iosBefore')}</span>
              <Share className="inline h-4 w-4 shrink-0" aria-label={t('shareIconLabel')} />
              <span>{t('iosAfter')}</span>
            </p>
          )}
        </div>

        {showAndroid && (
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0D2B6B] transition-colors hover:bg-white/90"
          >
            {t('installButton')}
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          aria-label={t('dismissLabel')}
          className="shrink-0 rounded-md p-1 text-white/80 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
