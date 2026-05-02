"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Star, MapPin, Calendar, Share2, Loader2, AlertCircle, Check,
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

interface ProviderReview {
  id: number;
  client_name: string;
  rating: number;
  comment?: string;
  punctuality?: boolean | null;
  respect?: boolean | null;
  created_at: string;
}

interface ApiSubcategory { id: number; name: string; name_fr: string; name_en: string; service_id: number | null }
interface ApiCategory    { id: number; name: string; name_fr: string; name_en: string; subcategories: ApiSubcategory[] }

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
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      if (sub.service_id !== null) return sub.service_id;
    }
  }
  return null;
}

export default function ProviderCardPage() {
  const params = useParams();
  const id     = params?.id as string;
  const locale = (params?.locale as string) ?? "fr";
  const isFr   = locale === "fr";

  const [provider, setProvider]     = useState<ProviderData | null>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [reviews, setReviews]       = useState<ProviderReview[]>([]);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [isExpected, setIsExpected] = useState(false);

  // Check if client has an active booking with this provider
  useEffect(() => {
    if (!id) return;
    try {
      const storedId = localStorage.getItem("shizu_active_provider_id");
      if (storedId && String(storedId) === String(id)) setIsExpected(true);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${FLASK_API}/api/providers/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`${FLASK_API}/api/services/categories`).then(r => r.ok ? r.json() : []),
      fetch(`${FLASK_API}/api/providers/${id}/reviews`).then(r => r.ok ? r.json() : []),
    ])
      .then(([providerData, cats, revs]) => {
        setProvider(providerData);
        setCategories(Array.isArray(cats) ? cats : []);
        setReviews(Array.isArray(revs) ? revs.slice(0, 3) : []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const bookingHref = (() => {
    if (!provider) return `/${locale}/services`;
    const firstService = provider.services[0] ?? "";
    const serviceId = firstService ? findServiceId(firstService, categories) : null;
    if (!serviceId) return `/${locale}/services`;
    const q = new URLSearchParams({ provider: String(provider.id), providerName: provider.name });
    return `/${locale}/booking/${serviceId}?${q.toString()}`;
  })();

  const shareUrl = `https://www.shizu.pro/${locale}/provider/${id}`;

  const waShareText = provider ? encodeURIComponent(
    `Je vous recommande ce prestataire sur Shizu !\n` +
    `👤 ${provider.name}\n` +
    (provider.services.length > 0 ? `🔧 ${provider.services.join(", ")}\n` : "") +
    `✅ Prestataire vérifié\n` +
    (provider.zones.length > 0 ? `📍 ${provider.zones.slice(0, 3).join(", ")}\n` : "") +
    `Réservez ici : ${shareUrl}`
  ) : "";

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
        <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
        <h1 className="text-xl font-semibold text-gray-800">
          {isFr ? "Prestataire introuvable" : "Provider not found"}
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          {isFr
            ? "Ce prestataire n'est pas disponible ou n'est plus actif."
            : "This provider is not available or is no longer active."}
        </p>
        <Link href={`/${locale}/services`}
          className="mt-6 inline-block bg-[#0F3A7A] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0d3068] transition-colors">
          {isFr ? "Voir tous les services" : "Browse all services"}
        </Link>
      </div>
    );
  }

  const initial   = provider.name ? provider.name[0].toUpperCase() : "?";
  const avgRating = provider.average_rating;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ── AMBER ARRIVAL BANNER ───────────────────────────────────────── */}
      {isExpected && (
        <div style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
          className="px-5 py-4">
          <div className="max-w-lg mx-auto flex items-start gap-3">
            <span className="text-2xl leading-none shrink-0 mt-0.5">🔒</span>
            <div>
              <p className="font-bold text-white text-sm leading-snug">
                {isFr ? "Ce prestataire est attendu chez vous" : "This provider is expected at your home"}
              </p>
              <p className="text-white/80 text-xs mt-1 leading-relaxed">
                {isFr
                  ? "Avant d'ouvrir, vérifiez que la personne correspond à la photo et au nom ci-dessous."
                  : "Before opening, verify the person matches the photo and name below."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div
        className="bg-[#0F3A7A] px-4 pt-10 pb-8 text-center relative overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {/* Photo + checkmark overlay */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            {provider.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={provider.profile_photo_url}
                alt={provider.name}
                className="h-[110px] w-[110px] rounded-full object-cover border-4 border-white shadow-xl"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="h-[110px] w-[110px] rounded-full bg-white/15 border-4 border-white shadow-xl flex items-center justify-center">
                <span className="text-4xl font-bold text-white">{initial}</span>
              </div>
            )}
            {/* Verified checkmark overlay */}
            {provider.verification_status === "approved" && (
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-green-500 border-2 border-white flex items-center justify-center shadow-md">
                <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <h1 className="text-[22px] font-bold text-white leading-tight">{provider.name}</h1>

        {/* Verified badge */}
        {provider.verification_status === "approved" && (
          <span className="inline-flex items-center gap-1.5 mt-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(34,197,94,0.25)",
              border: "1px solid rgba(34,197,94,0.50)",
              color: "#86efac",
            }}>
            <Star className="h-3 w-3 fill-current" />
            {isFr ? "Prestataire vérifié Shizu ★" : "Shizu Verified Provider ★"}
          </span>
        )}

        {/* Service chips */}
        {provider.services.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3.5">
            {provider.services.slice(0, 5).map(svc => (
              <span key={svc}
                className="px-2.5 py-1 rounded-full text-xs font-medium text-white/90"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                {svc}
              </span>
            ))}
          </div>
        )}

        {/* ID badge */}
        <div className="flex justify-center mt-4">
          <span
            className="font-mono text-xs tracking-widest px-4 py-1.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.55)" }}
          >
            ID SHIZU · #SP-{provider.id}
          </span>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-3">

        {/* Stats bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {/* Rating */}
            <div className="py-4 px-3 text-center">
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {avgRating !== null && avgRating !== undefined ? avgRating.toFixed(1) : "—"}
              </p>
              <div className="flex justify-center gap-0.5 mt-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n}
                    className={`h-2.5 w-2.5 ${avgRating && n <= Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{isFr ? "Note" : "Rating"}</p>
            </div>
            {/* Missions */}
            <div className="py-4 px-3 text-center">
              <p className="text-lg font-bold text-gray-900 tabular-nums">{provider.completed_bookings_count}</p>
              <p className="text-[10px] text-gray-400 mt-2">{isFr ? "Missions" : "Jobs"}</p>
            </div>
            {/* Urgency ETA */}
            <div className="py-4 px-3 text-center">
              <p className="text-lg font-bold text-gray-900">2h</p>
              <p className="text-[10px] text-gray-400 mt-2">{isFr ? "Délai urgence" : "Urgent ETA"}</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {provider.bio && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isFr ? "Présentation" : "About"}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{provider.bio}</p>
          </div>
        )}

        {/* Zones */}
        {provider.zones.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {isFr ? "Zones d'intervention" : "Service Areas"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {provider.zones.map(zone => (
                <span key={zone}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
                  {zone}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {isFr ? "Avis clients" : "Client Reviews"}
          </p>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              {isFr ? "Aucun avis pour l'instant." : "No reviews yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="space-y-1.5 border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">
                      {r.client_name.split(" ")[0]}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s}
                          className={`h-3 w-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-gray-600 leading-relaxed">{r.comment}</p>
                  )}
                  {(r.punctuality || r.respect) && (
                    <div className="flex gap-1.5 flex-wrap">
                      {r.punctuality && (
                        <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
                          ✓ {isFr ? "Ponctuel" : "Punctual"}
                        </span>
                      )}
                      {r.respect && (
                        <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
                          ✓ {isFr ? "Respectueux" : "Respectful"}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400">
                    {new Date(r.created_at).toLocaleDateString(isFr ? "fr-FR" : "en-US", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="space-y-3 pt-1">
          <Link href={bookingHref}
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 px-5 rounded-2xl transition-colors text-sm shadow-sm shadow-green-200">
            <Calendar className="h-4 w-4 shrink-0" />
            {isFr ? "Réserver ce prestataire" : "Book this provider"}
          </Link>

          <a href={`whatsapp://send?text=${waShareText}`}
            className="flex items-center justify-center gap-2 w-full border-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white font-semibold py-3 px-5 rounded-2xl transition-colors text-sm">
            <Share2 className="h-4 w-4 shrink-0" />
            {isFr ? "Partager sur WhatsApp" : "Share on WhatsApp"}
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 py-4">
          <span className="font-semibold text-[#0F3A7A]">shizu.pro</span>
          {" · "}
          {isFr ? "Prestataires vérifiés Abidjan" : "Verified providers in Abidjan"}
        </p>
      </div>
    </div>
  );
}
