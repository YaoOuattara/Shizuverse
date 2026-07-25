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
  MessageCircle,
  UserCheck,
  Home,
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
  // 3 warm cards (design conciergerie) — the numbered-notice layout is gone.
  const STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
    {
      icon: MessageCircle,
      title: isFr ? "Dites-nous ce qu'il vous faut" : "Tell us what you need",
      desc:  isFr ? "Une fuite, un ménage, une panne — décrivez, c'est tout." : "A leak, a cleaning, a breakdown — just describe it.",
    },
    {
      icon: UserCheck,
      title: isFr ? "On choisit le bon professionnel" : "We pick the right professional",
      desc:  isFr ? "Vérifié par nos soins, confirmé sous 2h sur WhatsApp." : "Vetted by our team, confirmed within 2h on WhatsApp.",
    },
    {
      icon: Home,
      title: isFr ? "Il arrive. Vous êtes tranquille." : "They arrive. You relax.",
      desc:  isFr ? "Vous suivez tout, on reste joignables 7j/7." : "You track everything, we stay reachable 7/7.",
    },
  ];

  const ctaHref = `/${locale}/services`;
  const ctaLabel = isFr ? "Réserver maintenant" : "Book now";
  const ctaClass = "bg-green-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-green-700 transition-colors";

  return (
    <section id="how-it-works" className="bg-[#E8F0FB] py-10 md:py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6 md:mb-12">
          <h2 className="text-2xl font-bold text-[#0D2B6B]">
            {isFr ? "Comment ça marche" : "How It Works"}
          </h2>
          <p className="text-[#185FA5] mt-2">
            {isFr ? "Vous demandez. On gère." : "You ask. We handle it."}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {STEPS.map((step) => (
            <div key={step.title} className="bg-white rounded-2xl p-6 text-left">
              <div className="w-12 h-12 rounded-xl bg-[#E8F0FB] flex items-center justify-center mb-4">
                <step.icon className="h-6 w-6 text-[#0F3A7A]" />
              </div>
              <p className="font-semibold text-[#0D2B6B]">{step.title}</p>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{step.desc}</p>
            </div>
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
