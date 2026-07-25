"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { CheckCircle, Search, Zap, CalendarCheck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface ApiCategory {
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
}

const CONTENT = {
  fr: {
    badge: "Abidjan · Côte d'Ivoire",
    headline: "On s'occupe de tout. Vous gagnez du temps.",
    subtext:
      "Réservez un prestataire vérifié à Abidjan en quelques minutes.",
    searchPlaceholder: "Quel est votre besoin ?",
    searchBtn: "Rechercher",
    urgentBtn: "Besoin urgent — 2h",
    planBtn: "Planifier un service",
    browseAll: "Parcourir toutes les catégories →",
    // Libellé du bouton prestataire — sujet à arbitrage (Marie-Paule), ne
    // changer QUE cette valeur.
    becomeProvider: "Devenir prestataire",
    trust: ["Prestataires vérifiés", "Réponse en 2h", "Support 7j/7"],
    availability: "Disponible aujourd'hui dans plusieurs quartiers d'Abidjan",
  },
  en: {
    badge: "Abidjan · Côte d'Ivoire",
    headline: "We handle it all. You save time.",
    subtext:
      "Book a verified provider in Abidjan in minutes.",
    searchPlaceholder: "What do you need?",
    searchBtn: "Search",
    urgentBtn: "Urgent — within 2h",
    planBtn: "Plan a service",
    browseAll: "Browse all categories →",
    // Provider button label — pending arbitration (Marie-Paule), change ONLY
    // this value.
    becomeProvider: "Become a provider",
    trust: ["Verified providers", "Response within 2h", "7-day support"],
    availability: "Available today across multiple Abidjan neighbourhoods",
  },
};

export default function HomeHero() {
  const locale = useLocale() as "en" | "fr";
  const c = CONTENT[locale] ?? CONTENT.fr;
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [chipsLoading, setChipsLoading] = useState(true);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setChipsLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    router.push(`/${locale}/services${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  // Show up to 8 chips so the row doesn't overflow on mobile
  const chips = categories.slice(0, 8);

  // Skeleton widths mirror the natural spread of real category name lengths
  const SKELETON_WIDTHS = ["w-16", "w-20", "w-24", "w-14", "w-20", "w-18", "w-16", "w-22"];

  return (
    <section
      id="hero-section"
      className="bg-[#0F3A7A] relative overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-16 md:py-20 text-center">

        {/* Location badge */}
        <span className="inline-block rounded-full bg-white/10 text-white/80 text-xs px-3 py-1 mb-6">
          {c.badge}
        </span>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl font-bold leading-tight text-white">
          {c.headline}
        </h1>

        {/* Sub-headline */}
        <p className="text-white/70 text-lg mt-4 max-w-xl mx-auto leading-relaxed">
          {c.subtext}
        </p>

        {/* ── Search bar ─────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="mt-8 flex gap-2 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="search-bar"
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={c.searchPlaceholder}
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors whitespace-nowrap text-sm"
          >
            {c.searchBtn}
          </button>
        </form>

        {/* ── Category chips (from API) ──────────────────────────────── */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {chipsLoading
            ? SKELETON_WIDTHS.map((w, i) => (
                <span
                  key={i}
                  className={`${w} h-7 rounded-full bg-white/20 animate-pulse`}
                />
              ))
            : chips.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/${locale}/services?category=${cat.id}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/20"
                >
                  {locale === "fr" ? (cat.name_fr || cat.name) : (cat.name_en || cat.name)}
                </Link>
              ))}
        </div>

        {/* ── Two urgency paths ──────────────────────────────────────── */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
          <Link
            href={`/${locale}/services?urgency=urgent`}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
          >
            <Zap className="h-4 w-4 shrink-0" />
            {c.urgentBtn}
          </Link>
          <Link
            href={`/${locale}/services`}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
          >
            <CalendarCheck className="h-4 w-4 shrink-0" />
            {c.planBtn}
          </Link>
        </div>

        {/* ── Secondary browse link (end of the client path) ─────────── */}
        <p className="mt-2">
          <Link
            href={`/${locale}/services`}
            className="text-white/50 hover:text-white/80 text-sm transition-colors"
          >
            {c.browseAll}
          </Link>
        </p>

        {/* ── Provider block (secondary button — recruitment sprint) ─── */}
        <div className="mt-4 max-w-lg mx-auto">
          <Link
            href={`/${locale}/provider/register`}
            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
          >
            <Wrench className="h-4 w-4 shrink-0" />
            {c.becomeProvider}
          </Link>
          <p className="mt-2">
            <Link
              href={`/${locale}/provider/login`}
              className="text-white/35 hover:text-white/60 text-xs transition-colors"
            >
              {locale === "fr" ? "Déjà prestataire ? → Accéder à mon espace" : "Already a provider? → My account"}
            </Link>
          </p>
        </div>

        {/* ── Trust chips ────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {c.trust.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
            >
              <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
              {item}
            </span>
          ))}
        </div>

        {/* ── Availability signal ────────────────────────────────────── */}
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-white/50">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
          {c.availability}
        </p>

      </div>
    </section>
  );
}
