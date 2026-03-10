import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  Wrench,
  Zap,
  Paintbrush,
  Heart,
  Dumbbell,
  Shield,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import HomeHero from "@/components/HomeHero";

// ── Section 2: Services ────────────────────────────────────────────────────

const SERVICES: { Icon: LucideIcon; name: string; desc: string }[] = [
  { Icon: Sparkles,   name: "Ménage",      desc: "Nettoyage professionnel" },
  { Icon: Wrench,     name: "Plomberie",   desc: "Réparations & installations" },
  { Icon: Zap,        name: "Électricité", desc: "Câblage & dépannage" },
  { Icon: Paintbrush, name: "Peinture",    desc: "Intérieur & extérieur" },
  { Icon: Heart,      name: "Bien-être",   desc: "Massages & soins" },
  { Icon: Dumbbell,   name: "Fitness",     desc: "Coach à domicile" },
  { Icon: Shield,     name: "Sécurité",    desc: "Installation & surveillance" },
  { Icon: Leaf,       name: "Jardinage",   desc: "Entretien & aménagement" },
];

function ServicesGrid({ locale }: { locale: string }) {
  return (
    <section className="bg-gray-50 py-16 px-6">
      <div className="max-w-5xl mx-auto text-center mb-10">
        <h2 className="text-2xl font-bold text-gray-900">Nos Services</h2>
        <p className="text-gray-500 mt-2">
          Des professionnels qualifiés pour chaque besoin
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {SERVICES.map(({ Icon, name, desc }) => (
          <Link
            key={name}
            href={`/${locale}/bookings`}
            className="bg-white rounded-2xl border border-gray-100 p-6 text-center hover:shadow-md hover:border-[#0F3A7A]/20 transition-all cursor-pointer group"
          >
            <Icon className="h-8 w-8 text-[#0F3A7A] mx-auto group-hover:scale-110 transition-transform" />
            <p className="font-semibold text-gray-800 mt-3 group-hover:text-[#0F3A7A] transition-colors">
              {name}
            </p>
            <p className="text-xs text-gray-400 mt-1">{desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Section 3: How It Works ────────────────────────────────────────────────

const STEPS = [
  {
    n: 1,
    title: "Choisissez un service",
    desc: "Parcourez notre catalogue de services professionnels.",
  },
  {
    n: 2,
    title: "Réservez en ligne",
    desc: "Sélectionnez une date et un créneau qui vous convient.",
  },
  {
    n: 3,
    title: "Confirmez les détails",
    desc: "Recevez une confirmation et les coordonnées du prestataire.",
  },
  {
    n: 4,
    title: "Le prestataire arrive",
    desc: "Profitez d'un service de qualité à domicile.",
  },
];

function HowItWorks() {
  return (
    <section className="bg-white py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
          Comment ça marche
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

// ── Section 4: Trust Stats ─────────────────────────────────────────────────

const STATS = [
  { value: "500+", label: "Réservations effectuées" },
  { value: "120+", label: "Prestataires actifs" },
  { value: "4.8★", label: "Note moyenne" },
  { value: "3", label: "Communes desservies" },
];

function TrustStats() {
  return (
    <section className="bg-[#0F3A7A] py-14 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center text-white ${
              i < STATS.length - 1 ? "md:border-r md:border-white/10" : ""
            }`}
          >
            <p className="text-4xl font-bold">{stat.value}</p>
            <p className="text-white/60 text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Section 5: Provider CTA ────────────────────────────────────────────────

const PROVIDER_BENEFITS = [
  { emoji: "📱", title: "Gérez vos réservations", desc: "Tableau de bord simple et intuitif" },
  { emoji: "💰", title: "Suivez vos revenus", desc: "Historique et statistiques détaillés" },
  { emoji: "⭐", title: "Construisez votre réputation", desc: "Avis clients et badges de confiance" },
  { emoji: "📈", title: "Développez votre activité", desc: "Accédez à plus de clients chaque jour" },
];

function ProviderCTA({ locale }: { locale: string }) {
  return (
    <section className="bg-gray-50 py-16 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        {/* Left */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            Vous êtes prestataire de services ?
          </h2>
          <p className="text-gray-500 mt-3 leading-relaxed">
            Rejoignez le réseau Shizuverse et développez votre clientèle à
            Abidjan. Gérez vos réservations, suivez vos revenus et construisez
            votre réputation en ligne.
          </p>
          <Link
            href={`/${locale}/provider`}
            className="inline-block mt-6 bg-[#0F3A7A] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0d3068] transition-colors"
          >
            Rejoindre Shizu
          </Link>
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

const FOOTER_LINKS = {
  Services: ["Ménage", "Plomberie", "Électricité", "Peinture"],
  Plateforme: ["Comment ça marche", "Tarifs", "Prestataires", "Avis clients"],
  Entreprise: ["À propos", "Presse", "Carrières", "Contact"],
};

function Footer({ locale }: { locale: string }) {
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
                {links.map((link) => (
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
          <p>© 2025 Shizuverse. Tous droits réservés.</p>
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
      <HowItWorks />
      <TrustStats />
      <ProviderCTA locale={locale} />
      <Footer locale={locale} />
    </>
  );
}
