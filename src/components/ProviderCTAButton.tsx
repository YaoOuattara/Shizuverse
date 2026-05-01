"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  locale: string;
}

export default function ProviderCTAButton({ locale }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isProvider, setIsProvider] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem("provider_token");
      if (token) {
        // Validate JWT expiry so stale tokens don't persist
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          const exp = payload?.exp;
          if (typeof exp === "number" && Date.now() / 1000 >= exp) {
            localStorage.removeItem("provider_token");
          } else {
            setIsProvider(true);
          }
        } else {
          setIsProvider(true);
        }
      }
    } catch {
      // ignore parse errors — treat as unauthenticated
    }
    setMounted(true);
  }, []);

  const defaultLabel = locale === "fr" ? "Rejoindre Shizu" : "Join Shizu";
  const defaultHref = `/${locale}/provider/register`;

  // Before mount: always show unauthenticated state.
  // This prevents router-cache restores from flashing stale provider state.
  if (!mounted) {
    return (
      <Link
        href={defaultHref}
        className="inline-block mt-6 border border-[#0F3A7A] text-[#0F3A7A] bg-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0F3A7A] hover:text-white transition-colors"
      >
        {defaultLabel}
      </Link>
    );
  }

  const href = isProvider ? `/${locale}/provider` : defaultHref;
  const label = isProvider
    ? (locale === "fr" ? "Mon tableau de bord" : "My Dashboard")
    : defaultLabel;

  const className = isProvider
    ? "inline-block mt-6 bg-[#0F3A7A] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0d3068] transition-colors"
    : "inline-block mt-6 border border-[#0F3A7A] text-[#0F3A7A] bg-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0F3A7A] hover:text-white transition-colors";

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
