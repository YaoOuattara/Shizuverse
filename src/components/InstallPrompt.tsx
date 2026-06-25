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

const DISMISS_KEY = 'shizu_pwa_install_dismissed';
const REVEAL_DELAY_MS = 2500; // starting value — tuned on the live deploy

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

// SSR-safe localStorage helpers — Safari private mode throws on access.
function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(DISMISS_KEY, '1');
    else window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    // Storage unavailable (private mode / quota) — fail silently.
  }
}

export default function InstallPrompt() {
  const t = useTranslations('installPrompt');
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false); // drives the slide-up entrance

  useEffect(() => {
    setMounted(true);

    // Installed users never see the banner.
    if (isStandalone()) return;

    // Respect a remembered dismissal from a previous visit.
    if (readDismissed()) {
      setDismissed(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
      // Neutralize the flag: respect state, don't suppress forever.
      writeDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // iOS Safari fires no beforeinstallprompt — fall back to the manual hint.
    if (isIosSafari()) setShowIosHint(true);

    // Timed reveal — slide up a moment after load, not instantly.
    const revealTimer = window.setTimeout(() => setVisible(true), REVEAL_DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.clearTimeout(revealTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // The event is single-use — discard it regardless of the outcome.
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    writeDismissed(true);
  };

  // Render nothing until mounted (avoids hydration mismatch), when dismissed,
  // or when there's no actionable install path on this platform.
  if (!mounted || dismissed) return null;
  const showAndroid = deferredPrompt !== null;
  if (!showAndroid && !showIosHint) return null;

  return (
    <div
      className={`fixed inset-x-4 bottom-4 z-50 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-out motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="relative mx-auto max-w-md rounded-2xl bg-[#0D2B6B] px-4 py-3.5 pr-12 text-white shadow-xl">
        {/* Dismiss — 40px hit area, subtle press/hover state */}
        <button
          onClick={handleDismiss}
          aria-label={t('dismissLabel')}
          className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        {showAndroid ? (
          <div>
            <p className="text-sm font-medium">{t('androidTitle')}</p>
            <button
              onClick={handleInstall}
              className="mt-3 w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0D2B6B] transition-colors hover:bg-white/90 active:bg-white/80"
            >
              {t('installButton')}
            </button>
          </div>
        ) : (
          // Single paragraph so the sentence wraps naturally with the glyph inline.
          <p className="text-sm leading-relaxed">
            {t('iosBefore')}{' '}
            <Share className="inline h-4 w-4 align-[-3px]" aria-label={t('shareIconLabel')} />{' '}
            {t('iosAfter')}
          </p>
        )}
      </div>
    </div>
  );
}
