"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Calendar, CheckCircle } from "lucide-react";

function BookingCardMockup() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="h-4 w-4 text-[#0F3A7A]" />
        <span className="font-semibold text-gray-800 text-sm">Nouvelle réservation</span>
      </div>

      {/* Service selector */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Service</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 bg-[#0F3A7A]/5 border border-[#0F3A7A]/20 rounded-xl px-4 py-2.5">
            <span className="text-lg">🧹</span>
            <span className="text-sm font-medium text-[#0F3A7A]">Ménage à domicile</span>
            <CheckCircle className="h-4 w-4 text-[#0F3A7A] ml-auto" />
          </div>
          <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-gray-400">
            <span className="text-lg">🔧</span>
            <span className="text-sm">Plomberie</span>
          </div>
        </div>
      </div>

      {/* Date / time */}
      <div className="mb-4 bg-gray-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-600">Mer. 12 Mars · 10h00</span>
      </div>

      {/* Provider row */}
      <div className="mb-5 flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-200 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
          SK
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">Sarah K.</p>
          <p className="text-xs text-yellow-500">⭐ 4.9</p>
        </div>
        <span className="ml-auto text-xs text-green-500 font-medium">Disponible</span>
      </div>

      {/* Confirm button */}
      <button className="w-full bg-[#0F3A7A] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#0d3068] transition-colors">
        Confirmer
      </button>
    </div>
  );
}

const CONTENT = {
  fr: {
    headline: "Nous prenons le relais, vous respirez",
    subtext:
      "Trouvez des prestataires vérifiés pour le ménage, la plomberie, l'électricité et plus encore.",
    cta1: "Réserver un service",
    cta2: "Devenir prestataire",
    trust: ["Prestataires vérifiés", "Paiement sécurisé", "Support 7j/7"],
  },
  en: {
    headline: "We Take Over, So You Can Breathe",
    subtext:
      "Find verified professionals for cleaning, plumbing, electrical work and more.",
    cta1: "Book a service",
    cta2: "Become a provider",
    trust: ["Verified providers", "Secure payment", "7-day support"],
  },
};

export default function HomeHero() {
  const locale = useLocale() as "en" | "fr";
  const c = CONTENT[locale] ?? CONTENT.fr;

  return (
    <section
      className="bg-[#0F3A7A] relative overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center gap-12">
        {/* Left column */}
        <div className="flex-[3] text-white">
          {/* Badge */}
          <span className="inline-block rounded-full bg-white/10 text-white/80 text-xs px-3 py-1 mb-6">
            Abidjan · Côte d&apos;Ivoire
          </span>

          {/* Headline — fix 1: pure white, no span with reduced opacity */}
          <h1 className="text-4xl md:text-5xl font-bold leading-tight text-white">
            {c.headline}
          </h1>

          {/* Subtext */}
          <p className="text-white/70 text-lg mt-4 max-w-lg">{c.subtext}</p>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-4 mt-8">
            <Link
              href={`/${locale}/bookings`}
              className="bg-white text-[#0F3A7A] font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {c.cta1}
            </Link>
            <Link
              href={`/${locale}/provider`}
              className="border border-white/40 text-white px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              {c.cta2}
            </Link>
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap gap-4 mt-6 text-white/60 text-sm">
            {c.trust.map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-white/50" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Right column — fix 2: hidden on mobile, centered */}
        <div className="hidden md:flex flex-[2] w-full justify-center">
          <BookingCardMockup />
        </div>
      </div>
    </section>
  );
}
