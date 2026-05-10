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

// ── Section 6: Footer ──────────────────────────────────────────────────────

function Footer({ locale }: { locale: string }) {
  const isFr = locale === "fr";

  // Desktop: 3 full columns
  const DESKTOP_COLS = isFr
    ? {
        Services:   ["Ménage & Nettoyage", "Plomberie", "Électricité", "Bricolage & Réparations", "Nounou & Baby-sitting", "Beauté à domicile", "Jardinage & Piscine", "Climatisation & Électroménager", "Aide aux seniors"],
        Plateforme: ["Comment ça marche", "Tarifs", "Prestataires", "Avis clients"],
        Entreprise: ["À propos", "Presse", "Carrières", "Contact"],
      }
    : {
        Services:  ["Cleaning", "Plumbing", "Electrical", "Handyman", "Childcare", "Beauty at Home", "Garden & Pool", "AC & Appliances", "Senior Care"],
        Platform:  ["How It Works", "Pricing", "Providers", "Reviews"],
        Company:   ["About", "Press", "Careers", "Contact"],
      };

  // Mobile: col 1 = top 5 services
  const MOBILE_SERVICES = isFr
    ? ["Ménage & Nettoyage", "Plomberie", "Électricité", "Bricolage", "Nounou"]
    : ["Cleaning", "Plumbing", "Electrical", "Handyman", "Childcare"];

  // Mobile: col 2 = visible links + accordion
  const MOBILE_VISIBLE = isFr
    ? [
        { label: "Comment ça marche", href: "#" },
        { label: "Devenir prestataire", href: `/${locale}/provider/register` },
        { label: "À propos", href: "#" },
      ]
    : [
        { label: "How It Works", href: "#" },
        { label: "Become a provider", href: `/${locale}/provider/register` },
        { label: "About", href: "#" },
      ];

  const MOBILE_ACCORDION = isFr
    ? ["Presse", "Carrières", "Contact"]
    : ["Press", "Careers", "Contact"];

  const linkClass = "text-white/70 text-sm hover:text-white transition-colors";

  return (
    <footer className="bg-[#0F3A7A] text-white py-10 px-6">
      <div className="max-w-5xl mx-auto">

        {/* ── Mobile footer: 2 columns ── */}
        <div className="md:hidden grid grid-cols-2 gap-6 mb-8">
          {/* Col 1: top services */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
              Services
            </p>
            <ul className="space-y-2">
              {MOBILE_SERVICES.map((s) => (
                <li key={s}>
                  <a href="#" className={linkClass}>{s}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 2: key links + accordion */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
              {isFr ? "Liens" : "Links"}
            </p>
            <ul className="space-y-2">
              {MOBILE_VISIBLE.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className={linkClass}>{l.label}</a>
                </li>
              ))}
            </ul>
            <details className="mt-3 group">
              <summary className="list-none cursor-pointer text-white/40 text-xs hover:text-white/70 transition-colors flex items-center gap-1 select-none">
                {isFr ? "Plus d'infos" : "More info"}
                <span className="group-open:rotate-180 inline-block transition-transform">▾</span>
              </summary>
              <ul className="mt-2 space-y-2">
                {MOBILE_ACCORDION.map((l) => (
                  <li key={l}>
                    <a href="#" className={linkClass}>{l}</a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>

        {/* ── Desktop footer: 3 columns ── */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 mb-10">
          {Object.entries(DESKTOP_COLS).map(([category, links]) => (
            <div key={category}>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                {category}
              </p>
              <ul className="space-y-2">
                {(links as string[]).map((link) => (
                  <li key={link}>
                    <a href="#" className={linkClass}>{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <p>© 2025 Shizu · Abidjan, Côte d&apos;Ivoire</p>
          <div className="flex gap-4">
            <Link href="/en" className="hover:text-white transition-colors">EN</Link>
            <Link href="/fr" className="hover:text-white transition-colors">FR</Link>
          </div>
        </div>
      </div>
    </footer>
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
      <Footer locale={locale} />
    </>
  );
}
