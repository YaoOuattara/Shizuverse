import Link from "next/link";
import Navbar from "@/components/Navbar";
import HomeHero from "@/components/HomeHero";

// ── Section 2: Services ────────────────────────────────────────────────────

const SERVICES = [
  { emoji: "🧹", name: "Ménage", desc: "Nettoyage professionnel" },
  { emoji: "🔧", name: "Plomberie", desc: "Réparations & installations" },
  { emoji: "⚡", name: "Électricité", desc: "Câblage & dépannage" },
  { emoji: "🎨", name: "Peinture", desc: "Intérieur & extérieur" },
  { emoji: "💆", name: "Bien-être", desc: "Massages & soins" },
  { emoji: "🏋️", name: "Fitness", desc: "Coach à domicile" },
  { emoji: "🛡️", name: "Sécurité", desc: "Installation & surveillance" },
  { emoji: "🌿", name: "Jardinage", desc: "Entretien & aménagement" },
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
        {SERVICES.map((s) => (
          <Link
            key={s.name}
            href={`/${locale}/bookings`}
            className="bg-white rounded-2xl border border-gray-100 p-6 text-center hover:shadow-md hover:border-[#0F3A7A]/20 transition-all cursor-pointer group"
          >
            <span className="text-4xl">{s.emoji}</span>
            <p className="font-semibold text-gray-800 mt-3 group-hover:text-[#0F3A7A] transition-colors">
              {s.name}
            </p>
            <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
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

function HummingbirdIconWhite() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C9 3 6.5 5 6 8c-1.5 0-3 1-3 2.5 0 1 .6 1.8 1.5 2.2L3 16h3l1-2.5c.5.3 1 .5 1.5.5h1L10 17h2l1.5-3.5C16 13 18 10.5 18 8c0-2.8-2.7-5-6-5z" fill="white" fillOpacity="0.9"/>
      <path d="M9.5 8.5c0 .8-.7 1.5-1.5 1.5S6.5 9.3 6.5 8.5 7.2 7 8 7s1.5.7 1.5 1.5z" fill="#0F3A7A"/>
      <path d="M18 8c0 0 2-1 4-1-1.5 1-2 2.5-2 2.5" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Footer({ locale }: { locale: string }) {
  return (
    <footer className="bg-[#0F3A7A] text-white py-10 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Logo row */}
        <div className="flex items-center gap-2 mb-2">
          <HummingbirdIconWhite />
          <span className="font-bold tracking-widest text-lg">SHIZU</span>
        </div>
        <p className="text-white/50 text-sm mb-10">Nous Prenons Le Relais</p>

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
