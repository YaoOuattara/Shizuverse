"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Search, Zap, CalendarCheck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface ApiCategory {
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
  // Present in the API payload — used to route a chip straight to the booking
  // flow of its category's first service (T-28).
  subcategories?: { service_id: number | null }[];
}

const CONTENT = {
  fr: {
    badge: "Abidjan · Côte d'Ivoire",
    headline: "On s'occupe de tout. Vous gagnez du temps.",
    subtext:
      "Décrivez votre besoin. On vous envoie le bon professionnel, vérifié par nos soins.",
    searchPlaceholder: "Quel est votre besoin ?",
    searchBtn: "Envoyer",
    urgentBtn: "Besoin urgent — 2h",
    planBtn: "Planifier un service",
    browseAll: "Parcourir toutes les catégories →",
    // Libellé du bouton prestataire — sujet à arbitrage (Marie-Paule), ne
    // changer QUE cette valeur.
    becomeProvider: "Proposer mes services",
    moreChips: (n: number) => `+ ${n} autres`,
    heroImageAlt: "Prestataire Shizu arrivant chez un client à Abidjan",
    trust: ["Prestataires vérifiés", "Confirmé sous 2h", "Joignables 7j/7"],
  },
  en: {
    badge: "Abidjan · Côte d'Ivoire",
    headline: "We handle it all. You save time.",
    subtext:
      "Tell us what you need. We send you the right professional, vetted by our team.",
    searchPlaceholder: "What do you need?",
    searchBtn: "Send",
    urgentBtn: "Urgent — within 2h",
    planBtn: "Plan a service",
    browseAll: "Browse all categories →",
    // Provider button label — pending arbitration (Marie-Paule), change ONLY
    // this value.
    becomeProvider: "Offer my services",
    moreChips: (n: number) => `+ ${n} more`,
    heroImageAlt: "Shizu provider arriving at a client's home in Abidjan",
    trust: ["Vetted professionals", "Confirmed within 2h", "Reachable 7/7"],
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

  // Concierge entry (T-21/T-28): the typed text becomes the initial
  // description of a FREE booking request — not a catalog search. This is what
  // makes the "Envoyer" button true.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    router.push(`/${locale}/booking/demande${q ? `?desc=${encodeURIComponent(q)}` : ""}`);
  };

  // Chip → the booking flow of the category's first service; a category with
  // no bookable service degrades to a free request seeded with its name.
  const chipHref = (cat: ApiCategory): string => {
    const sid = cat.subcategories?.find((s) => s.service_id != null)?.service_id;
    if (sid != null) return `/${locale}/booking/${sid}`;
    const label = locale === "fr" ? (cat.name_fr || cat.name) : (cat.name_en || cat.name);
    return `/${locale}/booking/demande?desc=${encodeURIComponent(label)}`;
  };

  // 4 chips + "+ N autres" → the CTAs climb back above the fold (design lot).
  const chips = categories.slice(0, 4);
  const moreCount = Math.max(0, categories.length - 4);

  // Skeleton widths mirror the natural spread of real category name lengths
  const SKELETON_WIDTHS = ["w-16", "w-20", "w-24", "w-14", "w-16"];

  return (
    <section id="hero-section" className="relative isolate overflow-hidden bg-[#EDF4FC]">
      {/* ── Background photo (temporary) — two regimes ─────────────────
          < md : a banner in the normal flow at the top of the hero. Full
          bleed behind a phone-width panel left the photo as a blurred frame
          and dropped the human moment, which is the whole reason the photo
          is here. Stacked instead: photo on top, content below on the flat
          #EDF4FC. The image is 1672×941 and the banner is wider than that
          ratio, so cover shows the FULL width — both people stay in frame
          and only the vertical crop is steered. The crop window tightens as
          the viewport widens (79% of the image at 393px, 41% at 767px), so
          object-position is set for the WORST case: the provider's hair
          starts at 7% of the image height, and 10% keeps it clear at 767px
          while barely moving the 393px framing.
          ≥ md : unchanged — absolute full bleed behind the panel.
          `isolate` on the section is what makes the negative z-indexes paint
          ABOVE the opaque bg-[#EDF4FC] fallback instead of under it. Note
          -z-20 is md-only: on mobile the banner is in flow, and a negative
          z-index there would bury it under that same opaque background. */}
      <div className="relative h-44 w-full md:absolute md:inset-0 md:h-auto md:-z-20">
        <Image
          src="/images/hero/hero-provider-arrival.jpg"
          alt={c.heroImageAlt}
          fill
          sizes="100vw"
          priority
          className="object-cover object-[50%_10%] md:object-center"
        />
      </div>
      {/* Legibility overlay — md only. Below md nothing sits on the photo. */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_75%_at_50%_45%,rgba(237,244,252,0.50)_0%,rgba(237,244,252,0.26)_55%,rgba(237,244,252,0.04)_100%)]"
      />

      {/* ── Text column ────────────────────────────────────────────────
          < md : plain, on the flat #EDF4FC under the banner. No panel — with
          nothing behind the text there is nothing to defend against.
          ≥ md : the translucent panel. The photo is a placeholder and the
          real ones will have an unpredictable composition, so legibility
          cannot depend on where the subject happens to sit. The panel gives
          every line — including the two small links (browse-all,
          already-a-provider) — a light ground of its own. Frosted rather than
          opaque so the photo still reads through.
          Text colours are untouched: the palette is locked.
          md:w-[calc(100%-2rem)] is the gutter that keeps the panel's rounded
          corners off the viewport edges between md and 2xl. */}
      <div className="max-w-2xl mx-auto px-6 py-8 text-center md:w-[calc(100%-2rem)] md:my-10 md:py-12 md:rounded-3xl md:bg-white/80 md:backdrop-blur-lg md:ring-1 md:ring-white/60 md:shadow-[0_2px_32px_rgba(13,43,107,0.08)]">

        {/* Location badge */}
        <span className="inline-block rounded-full bg-white border border-[#B5D4F4] text-[#185FA5] text-xs px-3 py-1 mb-6">
          {c.badge}
        </span>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl font-bold leading-tight text-[#0D2B6B]">
          {c.headline}
        </h1>

        {/* Sub-headline */}
        <p className="text-[#185FA5] text-lg mt-4 max-w-xl mx-auto leading-relaxed">
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
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 bg-white border border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
            />
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors whitespace-nowrap text-sm"
          >
            {c.searchBtn}
          </button>
        </form>

        {/* ── Category chips: 4 + "+ N autres" (fold discipline) ─────── */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {chipsLoading
            ? SKELETON_WIDTHS.map((w, i) => (
                <span
                  key={i}
                  className={`${w} h-7 rounded-full bg-[#B5D4F4]/40 animate-pulse`}
                />
              ))
            : (
              <>
                {chips.map((cat) => (
                  <Link
                    key={cat.id}
                    href={chipHref(cat)}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-white hover:bg-[#E8F0FB] text-[#0F3A7A] text-xs font-medium transition-colors border border-[#B5D4F4]"
                  >
                    {locale === "fr" ? (cat.name_fr || cat.name) : (cat.name_en || cat.name)}
                  </Link>
                ))}
                {moreCount > 0 && (
                  <Link
                    href={`/${locale}/services`}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-white hover:bg-[#E8F0FB] text-[#0F3A7A] text-xs font-medium transition-colors border border-[#B5D4F4]"
                  >
                    {c.moreChips(moreCount)}
                  </Link>
                )}
              </>
            )}
        </div>

        {/* ── Two urgency paths ──────────────────────────────────────── */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
          <Link
            href={`/${locale}/booking/demande?urgency=urgent_2h`}
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
            className="text-[#185FA5] hover:text-[#0D2B6B] text-sm transition-colors"
          >
            {c.browseAll}
          </Link>
        </p>

        {/* ── Provider block (secondary button — recruitment sprint) ───
            Dark-on-light outline of the design system (cf. ProviderCTAButton). */}
        <div className="mt-4 max-w-lg mx-auto">
          <Link
            href={`/${locale}/provider/register`}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-[#0F3A7A] border border-[#0F3A7A] text-[#0F3A7A] hover:text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
          >
            <Wrench className="h-4 w-4 shrink-0" />
            {c.becomeProvider}
          </Link>
          <p className="mt-2">
            <Link
              href={`/${locale}/provider/login`}
              className="text-[#888780] hover:text-[#0D2B6B] text-xs transition-colors"
            >
              {locale === "fr" ? "Déjà prestataire ? → Accéder à mon espace" : "Already a provider? → My account"}
            </Link>
          </p>
        </div>

      </div>

      {/* ── Trust band — the ONLY dark moment of the hero (authority).
          Full width, replaces the old trust chips + availability line
          (dropped: documented cosmetic toggle). */}
      <div className="bg-[#0D2B6B] py-3 px-4">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[#B5D4F4] text-center">
          {c.trust.map((item, i) => (
            <span key={item} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">·</span>}
              {item}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
