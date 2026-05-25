"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { CheckCircle, Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const CONTENT = {
  fr: {
    title: "À propos de Shizu",
    subtitle: "Nous prenons le relais",
    p1: "Shizu est une marketplace de services à domicile fondée à Abidjan en 2026. Notre mission est d'aider les ménages et petites entreprises à trouver des prestataires de confiance, rapidement et facilement.",
    p2: "Chaque prestataire sur Shizu est vérifié manuellement par notre équipe avant d'apparaître sur la plateforme. La confiance est au cœur de tout ce que nous faisons.",
    contactTitle: "Nous contacter",
    contactText: "Pour toute question, écrivez-nous à",
    cta: "Réserver un service",
    values: [
      "Prestataires vérifiés manuellement",
      "Disponible à Abidjan et environs",
      "Support 7 jours sur 7",
    ],
  },
  en: {
    title: "About Shizu",
    subtitle: "We take over, so you can breathe",
    p1: "Shizu is a home services marketplace founded in Abidjan in 2026. Our mission is to help households and small businesses find trusted service providers, quickly and easily.",
    p2: "Every provider on Shizu is manually verified by our team before appearing on the platform. Trust is at the heart of everything we do.",
    contactTitle: "Contact us",
    contactText: "For any questions, reach us at",
    cta: "Book a service",
    values: [
      "Manually verified providers",
      "Available in Abidjan and surroundings",
      "7-day support",
    ],
  },
};

export default function AboutPage() {
  const locale = useLocale() as "en" | "fr";
  const c = CONTENT[locale] ?? CONTENT.fr;

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="bg-[#0D2B6B] py-20 px-6 text-center">
        <p className="text-sm font-medium text-white/50 uppercase tracking-widest mb-3">
          Shizu · 2026
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          {c.title}
        </h1>
        <p className="text-lg text-white/70 max-w-xl mx-auto">
          {c.subtitle}
        </p>
      </section>

      {/* Body */}
      <main className="bg-white py-16 px-6">
        <div className="max-w-2xl mx-auto space-y-12">

          {/* Mission paragraphs */}
          <section className="space-y-5">
            <p className="text-gray-700 leading-relaxed">{c.p1}</p>
            <p className="text-gray-700 leading-relaxed">{c.p2}</p>
          </section>

          {/* Values chips */}
          <section className="flex flex-col gap-3">
            {c.values.map((v) => (
              <div key={v} className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-[#0D2B6B] shrink-0" />
                <span className="text-sm text-gray-700">{v}</span>
              </div>
            ))}
          </section>

          {/* Contact card */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {c.contactTitle}
            </h2>
            <div className="border border-gray-200 rounded-2xl p-6 flex items-start gap-4">
              <div className="h-9 w-9 rounded-full bg-[#0D2B6B]/10 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-[#0D2B6B]" />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {c.contactText}{" "}
                <a
                  href="mailto:contact@shizu.pro"
                  className="font-medium text-[#0D2B6B] hover:underline"
                >
                  contact@shizu.pro
                </a>
              </p>
            </div>
          </section>

          {/* CTA */}
          <div className="flex justify-center pt-2">
            <Link
              href={`/${locale}/booking`}
              className="bg-green-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-green-700 transition-colors"
            >
              {c.cta}
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
