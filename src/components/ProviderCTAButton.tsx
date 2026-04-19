"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  locale: string;
}

export default function ProviderCTAButton({ locale }: Props) {
  const [isProvider, setIsProvider] = useState(false);

  useEffect(() => {
    setIsProvider(!!localStorage.getItem("provider_token"));
  }, []);

  const href = isProvider
    ? `/${locale}/provider`
    : `/${locale}/provider/register`;

  const label = isProvider
    ? locale === "fr" ? "Mon tableau de bord" : "My Dashboard"
    : locale === "fr" ? "Rejoindre Shizu" : "Join Shizu";

  return (
    <Link
      href={href}
      className="inline-block mt-6 bg-[#0F3A7A] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0d3068] transition-colors"
    >
      {label}
    </Link>
  );
}
