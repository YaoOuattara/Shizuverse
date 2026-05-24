import { Fragment } from "react";
import Link from "next/link";
import {
  Sparkles,
  Wrench,
  Zap,
  Hammer,
  Baby,
  Scissors,
  ChefHat,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import HomeHero from "@/components/HomeHero";
import ServicesGrid from "@/components/ServicesGrid";
import ProviderCTAButton from "@/components/ProviderCTAButton";
import Footer from "@/components/Footer";

// ── Section 3: How It Works ────────────────────────────────────────────────

function HowItWorks({ locale }: { locale: string }) {
  const isFr = locale === "fr";
  const STEPS = [
    {
      n: 1,
      title: isFr ? "Choisissez un service"  : "Choose a service",
      desc:  isFr ? "Parcourez notre catalogue de services professionnels." : "Browse our catalogue of professional services.",
    },
    {
      n: 2,
      title: isFr ? "Réservez en ligne"      : "Book online",
      desc:  isFr ? "Sélectionnez une date et un créneau qui vous convient." : "Pick a date and time slot that works for you.",
    },
    {
      n: 3,
      title: isFr ? "Confirmez les détails"  : "Confirm the details",
      desc:  isFr ? "Recevez une confirmation et les coordonnées du prestataire." : "Receive confirmation and your provider's contact info.",
    },
    {
      n: 4,
      title: isFr ? "Le prestataire arrive"  : "Provider arrives",
      desc:  isFr ? "Profitez d'un service de qualité à domicile." : "Enjoy quality service at your doorstep.",
    },
  ];

  const ctaHref = `/${locale}/services`;
  const ctaLabel = isFr ? "Réserver maintenant" : "Book now";
  const ctaClass = "bg-green-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-green-700 transition-colors";

  return (
    <section className="bg-white py-10 md:py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-6 md:mb-12">
          {isFr ? "Comment ça marche" : "How It Works"}
        </h2>

        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
          {STEPS.map((step, i) => (
            <Fragment key={step.n}>
              {/* Step card */}
              <div className="w-full md:flex-1 relative grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-0.5 md:flex md:flex-col md:items-start">
                {/* Dashed connector — desktop only */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-10 right-0 border-t-2 border-dashed border-gray-200" />
                )}
                {/* Number circle */}
                <div className="w-10 h-10 rounded-full bg-[#0F3A7A] text-white flex items-center justify-center font-bold text-sm z-10 shrink-0">
                  {step.n}
                </div>
                {/* Title — same row as icon on mobile, below on desktop */}
                <p className="font-semibold text-gray-800 text-sm self-center md:self-auto md:mt-4 col-start-2 md:col-auto">
                  {step.title}
                </p>
                {/* Description — below title, indented on mobile */}
                <p className="text-xs text-gray-400 mt-0.5 col-start-2 md:col-auto md:mt-1">
                  {step.desc}
                </p>
              </div>

            </Fragment>
          ))}
        </div>

        {/* CTA below all steps */}
        <div className="flex justify-center mt-8 md:mt-12">
          <Link href={ctaHref} className={ctaClass}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Section 5: Provider CTA ────────────────────────────────────────────────

function ProviderCTA({ locale }: { locale: string }) {
  const isFr = locale === "fr";
  const PROVIDER_BENEFITS = [
    {
      emoji: "📱",
      title: isFr ? "Recevez des demandes directement" : "Get requests directly",
      desc:  isFr ? "Tableau de bord simple et intuitif"  : "Simple, intuitive dashboard",
    },
    {
      emoji: "💰",
      title: isFr ? "Suivez vos gains en temps réel"   : "Track your earnings live",
      desc:  isFr ? "Historique et statistiques détaillés" : "Detailed history & statistics",
    },
    {
      emoji: "⭐",
      title: isFr ? "Construisez votre réputation"     : "Build your reputation",
      desc:  isFr ? "Avis clients et badges de confiance"  : "Client reviews & trust badges",
    },
    {
      emoji: "📈",
      title: isFr ? "Développez votre activité"        : "Grow your business",
      desc:  isFr ? "Accédez à plus de clients chaque jour" : "Reach more clients every day",
    },
  ];

  return (
    <section className="bg-gray-50 py-16 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        {/* Left */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {isFr ? "Vous êtes prestataire de services ?" : "Are you a service provider?"}
          </h2>
          <p className="text-gray-500 mt-3 leading-relaxed">
            {isFr
              ? "Rejoignez le réseau Shizu et développez votre clientèle à Abidjan. Gérez vos réservations, suivez vos revenus et construisez votre réputation en ligne."
              : "Join the Shizu network and grow your client base in Abidjan. Manage bookings, track your earnings, and build your online reputation."}
          </p>
          <ProviderCTAButton locale={locale} />
        </div>

        {/* Right: 2×2 grid — 2 cards on mobile, 4 on desktop */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          {PROVIDER_BENEFITS.map((b) => (
            <div
              key={b.title}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow"
            >
              <span className="text-2xl">{b.emoji}</span>
              <p className="font-semibold text-gray-800 text-sm mt-2">{b.title}</p>
              <p className="text-xs text-gray-400 mt-1">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <Navbar />
      <HomeHero />
      <ServicesGrid locale={locale} />
      <div className="bg-gray-50 pb-6 text-center">
        <a
          href={`/${locale}/provider/register`}
          className="text-sm text-gray-500 hover:text-gray-800 underline underline-offset-4 transition-colors"
        >
          {locale === "fr" ? "Devenir prestataire →" : "Become a provider →"}
        </a>
      </div>
      <HowItWorks locale={locale} />
      <ProviderCTA locale={locale} />
      <Footer />
    </>
  );
}
