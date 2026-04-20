import Link from "next/link";
import Image from "next/image";
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
  const STEPS = [
    {
      n: 1,
      title: locale === 'fr' ? "Choisissez un service"    : "Choose a service",
      desc:  locale === 'fr' ? "Parcourez notre catalogue de services professionnels." : "Browse our catalogue of professional services.",
    },
    {
      n: 2,
      title: locale === 'fr' ? "Réservez en ligne"        : "Book online",
      desc:  locale === 'fr' ? "Sélectionnez une date et un créneau qui vous convient." : "Pick a date and time slot that works for you.",
    },
    {
      n: 3,
      title: locale === 'fr' ? "Confirmez les détails"    : "Confirm the details",
      desc:  locale === 'fr' ? "Recevez une confirmation et les coordonnées du prestataire." : "Receive confirmation and your provider's contact info.",
    },
    {
      n: 4,
      title: locale === 'fr' ? "Le prestataire arrive"    : "Provider arrives",
      desc:  locale === 'fr' ? "Profitez d'un service de qualité à domicile." : "Enjoy quality service at your doorstep.",
    },
  ];

  return (
    <section className="bg-white py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
          {locale === 'fr' ? 'Comment ça marche' : 'How It Works'}
        </h2>
        <div className="flex flex-col md:flex-row items-start gap-8">
          {STEPS.map((step, i) => (
            <div key={step.n} className="flex-1 flex flex-col items-center text-center relative">
              {/* Dashed connector — desktop only */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-5 left-[calc(50%+20px)] right-0 border-t-2 border-dashed border-gray-200" />
              )}
              <div className="w-10 h-10 rounded-full bg-[#0F3A7A] text-white flex items-center justify-center font-bold text-sm z-10">
                {step.n}
              </div>
              <p className="font-semibold text-gray-800 mt-4 text-sm">{step.title}</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[160px]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section 4: Trust Chips ────────────────────────────────────────────────

function TrustChips({ locale }: { locale: string }) {
  const CHIPS = locale === 'fr'
    ? ["Prestataires vérifiés", "Paiement sécurisé", "Support 7j/7"]
    : ["Verified providers",    "Secure payment",    "7-day support"];

  return (
    <section className="bg-white border-b border-gray-100 py-6 px-6">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-3">
        {CHIPS.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700"
          >
            <span className="h-2 w-2 rounded-full bg-[#0F3A7A]" />
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
}

// ── Section 5: Provider CTA ────────────────────────────────────────────────

function ProviderCTA({ locale }: { locale: string }) {
  const PROVIDER_BENEFITS = [
    { emoji: "📱", title: locale === 'fr' ? "Gérez vos réservations"       : "Manage your bookings",       desc: locale === 'fr' ? "Tableau de bord simple et intuitif"    : "Simple, intuitive dashboard" },
    { emoji: "💰", title: locale === 'fr' ? "Suivez vos revenus"           : "Track your earnings",        desc: locale === 'fr' ? "Historique et statistiques détaillés"  : "Detailed history & statistics" },
    { emoji: "⭐", title: locale === 'fr' ? "Construisez votre réputation" : "Build your reputation",      desc: locale === 'fr' ? "Avis clients et badges de confiance"   : "Client reviews & trust badges" },
    { emoji: "📈", title: locale === 'fr' ? "Développez votre activité"   : "Grow your business",         desc: locale === 'fr' ? "Accédez à plus de clients chaque jour" : "Reach more clients every day" },
  ];

  return (
    <section className="bg-gray-50 py-16 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        {/* Left */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {locale === 'fr'
              ? "Vous êtes prestataire de services ?"
              : "Are you a service provider?"}
          </h2>
          <p className="text-gray-500 mt-3 leading-relaxed">
            {locale === 'fr'
              ? "Rejoignez le réseau Shizu et développez votre clientèle à Abidjan. Gérez vos réservations, suivez vos revenus et construisez votre réputation en ligne."
              : "Join the Shizu network and grow your client base in Abidjan. Manage bookings, track your earnings, and build your online reputation."}
          </p>
          <ProviderCTAButton locale={locale} />
        </div>

        {/* Right: 2×2 benefits */}
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
  const FOOTER_LINKS = locale === 'fr'
    ? {
        Services:   ['Ménage & Nettoyage', 'Nounou & Baby-sitting', 'Beauté à domicile', 'Bricolage & Réparations', 'Traiteur & Cuisine', 'Jardinage & Piscine'],
        Plateforme: ['Comment ça marche', 'Tarifs', 'Prestataires', 'Avis clients'],
        Entreprise: ['À propos', 'Presse', 'Carrières', 'Contact'],
      }
    : {
        Services:  ['Cleaning', 'Childcare', 'Beauty at Home', 'Handyman', 'Catering & Cooking', 'Garden & Pool'],
        Platform:  ['How It Works', 'Pricing', 'Providers', 'Reviews'],
        Company:   ['About', 'Press', 'Careers', 'Contact'],
      };
  return (
    <footer className="bg-[#0F3A7A] text-white py-10 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Logo row */}
        <div className="mb-10">
          <Image
            src={locale === 'fr' ? '/FR Logo Shizu.PNG' : '/EN Logo Shizu.PNG'}
            alt="Shizu"
            width={100}
            height={100}
            className="rounded-xl mb-2"
          />
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10">
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                {category}
              </p>
              <ul className="space-y-2">
                {(links as string[]).map((link) => (
                  <li key={link}>
                    <a href="#" className="text-white/70 text-sm hover:text-white transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <p>© 2025 Shizu. {locale === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
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
      <TrustChips locale={locale} />
      <ServicesGrid locale={locale} />
      <ProviderCTA locale={locale} />
      <HowItWorks locale={locale} />
      <Footer locale={locale} />
    </>
  );
}
