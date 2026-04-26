"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, MapPin, Star, Wrench, Share2, Calendar,
  Loader2, AlertCircle,
} from "lucide-react";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface ProviderData {
  id: number;
  name: string;
  bio: string;
  profile_photo_url: string;
  serviceArea: string;
  zones: string[];
  services: string[];
  average_rating: number | null;
  review_count: number;
  completed_bookings_count: number;
  verification_status: string;
}

interface ApiSubcategory { id: number; name: string; name_fr: string; name_en: string; service_id: number | null }
interface ApiCategory    { id: number; name: string; name_fr: string; name_en: string; subcategories: ApiSubcategory[] }

// Find the best service_id for a given service name by scanning the category tree.
// Tries partial name matching against category and subcategory names; falls back to
// the first available service_id in the entire catalog.
function findServiceId(serviceName: string, categories: ApiCategory[]): number | null {
  const lower = serviceName.toLowerCase().trim();
  const firstWord = lower.split(/\s+/)[0];

  for (const cat of categories) {
    const catFr = (cat.name_fr || cat.name).toLowerCase();
    const catEn = (cat.name_en || cat.name).toLowerCase();
    const catMatch = lower.includes(catFr) || catFr.includes(firstWord) ||
                     lower.includes(catEn) || catEn.includes(firstWord);
    if (catMatch) {
      const sub = cat.subcategories.find(s => s.service_id !== null);
      if (sub?.service_id) return sub.service_id;
    }
    for (const sub of cat.subcategories) {
      const subFr = (sub.name_fr || sub.name).toLowerCase();
      const subEn = (sub.name_en || sub.name).toLowerCase();
      if (lower.includes(subFr) || subFr.includes(firstWord) ||
          lower.includes(subEn) || subEn.includes(firstWord)) {
        if (sub.service_id !== null) return sub.service_id;
      }
    }
  }
  // Fallback: first service_id in catalog
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      if (sub.service_id !== null) return sub.service_id;
    }
  }
  return null;
}

export default function ProviderCardPage() {
  const params = useParams();
  const id = params?.id as string;
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";

  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Fetch provider and categories in parallel
    Promise.all([
      fetch(`${FLASK_API}/api/providers/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`${FLASK_API}/api/services/categories`).then(r => r.ok ? r.json() : []),
    ])
      .then(([providerData, cats]) => {
        setProvider(providerData);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Resolve booking URL: /[locale]/booking/[serviceId]?provider=[id]&providerName=[name]
  const bookingHref = (() => {
    if (!provider) return `/${locale}/services`;
    const firstService = provider.services[0] ?? "";
    const serviceId = firstService ? findServiceId(firstService, categories) : null;
    if (!serviceId) return `/${locale}/services`;
    const params = new URLSearchParams({
      provider: String(provider.id),
      providerName: provider.name,
    });
    return `/${locale}/booking/${serviceId}?${params.toString()}`;
  })();

  const shareUrl = `https://www.shizu.pro/fr/provider/${id}`;

  const buildWhatsAppText = (p: ProviderData) => {
    const servicesLine = p.services.length > 0 ? `🔧 ${p.services.join(', ')}` : "";
    const zonesLine = p.zones.length > 0 ? `📍 ${p.zones.slice(0, 3).join(', ')}` : "";
    return encodeURIComponent(
      `Je vous recommande ce prestataire sur Shizu !\n` +
      `👤 ${p.name}\n` +
      (servicesLine ? servicesLine + '\n' : '') +
      `✅ Prestataire vérifié\n` +
      (zonesLine ? zonesLine + '\n' : '') +
      `Réservez ici : ${shareUrl}`
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3A7A]" />
      </div>
    );
  }

  if (notFound || !provider) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold text-gray-800">
          {isFr ? "Prestataire introuvable" : "Provider not found"}
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          {isFr
            ? "Ce prestataire n'est pas disponible ou n'est plus actif."
            : "This provider is not available or is no longer active."}
        </p>
        <Link
          href={`/${locale}/services`}
          className="mt-6 inline-block bg-[#0F3A7A] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0d3068] transition-colors"
        >
          {isFr ? "Voir tous les services" : "Browse all services"}
        </Link>
      </div>
    );
  }

  const initial = provider.name ? provider.name[0].toUpperCase() : "?";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header band ─────────────────────────────────────────────────── */}
      <div className="bg-[#0F3A7A] px-4 pt-10 pb-16 text-center relative overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Photo */}
        <div className="flex justify-center mb-4">
          {provider.profile_photo_url ? (
            <img
              src={provider.profile_photo_url}
              alt={provider.name}
              className="h-24 w-24 rounded-full object-cover border-4 border-white/30 shadow-lg"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold text-white">{initial}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <h1 className="text-2xl font-bold text-white">{provider.name}</h1>

        {/* Verified badge */}
        {provider.verification_status === "approved" && (
          <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isFr ? "Prestataire vérifié" : "Verified provider"}
          </span>
        )}

        {/* Services */}
        {provider.services.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {provider.services.slice(0, 5).map(svc => (
              <span key={svc} className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-medium">
                {svc}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Card body ────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-lg w-full mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-gray-50 py-3 px-2">
              <p className="text-lg font-bold text-gray-900">
                {provider.average_rating !== null ? provider.average_rating.toFixed(1) : "—"}
              </p>
              <div className="flex justify-center gap-0.5 mt-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star
                    key={n}
                    className={`h-3 w-3 ${provider.average_rating && n <= Math.round(provider.average_rating) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{isFr ? "Note" : "Rating"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 py-3 px-2">
              <p className="text-lg font-bold text-gray-900">{provider.completed_bookings_count}</p>
              <p className="text-xs text-gray-500 mt-1">{isFr ? "Missions" : "Jobs"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 py-3 px-2">
              <p className="text-lg font-bold text-gray-900">2h</p>
              <p className="text-xs text-gray-500 mt-1">{isFr ? "Délai urgence" : "Urgent ETA"}</p>
            </div>
          </div>

          {/* Bio */}
          {provider.bio && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                {isFr ? "Présentation" : "About"}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{provider.bio}</p>
            </div>
          )}

          {/* Zones */}
          {provider.zones.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {isFr ? "Zones d'intervention" : "Service Areas"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {provider.zones.map(zone => (
                  <span key={zone} className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* CTAs */}
          <div className="space-y-3">
            <Link
              href={bookingHref}
              className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-5 rounded-xl transition-colors text-sm"
            >
              <Calendar className="h-4 w-4 shrink-0" />
              {isFr ? "Réserver ce prestataire" : "Book this provider"}
            </Link>

            <a
              href={`whatsapp://send?text=${provider ? buildWhatsAppText(provider) : ""}`}
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5c] text-white font-semibold py-3 px-5 rounded-xl transition-colors text-sm"
            >
              <Share2 className="h-4 w-4 shrink-0" />
              {isFr ? "Partager sur WhatsApp" : "Share on WhatsApp"}
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 py-6">
          <span className="font-semibold text-[#0F3A7A]">shizu.pro</span>
          {" · "}
          {isFr ? "Prestataires vérifiés Abidjan" : "Verified providers in Abidjan"}
        </p>
      </div>
    </div>
  );
}
