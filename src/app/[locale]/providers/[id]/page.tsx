"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Star, MapPin, Briefcase, ArrowLeft, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface PublicProvider {
  id: number;
  name: string;
  bio?: string;
  services?: string[];
  zones?: string[];
  profile_photo_url?: string;
  average_rating?: number | null;
  review_count?: number;
  completed_bookings_count?: number;
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

export default function PublicProviderProfilePage() {
  const params     = useParams();
  const router     = useRouter();
  const locale     = (params?.locale as string) ?? "fr";
  const providerId = params?.id as string;
  const isFr       = locale === "fr";

  const [provider, setProvider]               = useState<PublicProvider | null>(null);
  const [reviews, setReviews]                 = useState<ProviderReview[]>([]);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [loadingReviews, setLoadingReviews]   = useState(true);
  const [isExpectedProvider, setIsExpectedProvider] = useState(false);

  // Check localStorage: does the client have an active booking with this provider?
  useEffect(() => {
    if (!providerId) return;
    try {
      const info = JSON.parse(localStorage.getItem("client_info") ?? "null");
      const bookingsRaw = localStorage.getItem("shizu_active_bookings");
      if (bookingsRaw) {
        const bookings = JSON.parse(bookingsRaw);
        const match = bookings.find(
          (b: { provider_id?: number; status?: string }) =>
            String(b.provider_id) === String(providerId) &&
            ["accepted", "in_progress", "requested"].includes(b.status ?? "")
        );
        if (match) setIsExpectedProvider(true);
      }
      // Also check the last known active booking in localStorage
      const cachedInfo = info;
      void cachedInfo; // unused but may extend later
    } catch { /* ignore */ }
  }, [providerId]);

  useEffect(() => {
    if (!providerId) return;
    fetch(`${FLASK_API}/api/providers/${providerId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setProvider(data); })
      .catch(() => {})
      .finally(() => setLoadingProvider(false));
  }, [providerId]);

  useEffect(() => {
    if (!providerId) return;
    fetch(`${FLASK_API}/api/providers/${providerId}/reviews`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (Array.isArray(data)) setReviews(data.slice(0, 3)); })
      .catch(() => {})
      .finally(() => setLoadingReviews(false));
  }, [providerId]);

  if (loadingProvider) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3A7A]" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">{isFr ? "Prestataire introuvable." : "Provider not found."}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          {isFr ? "Retour" : "Back"}
        </Button>
      </div>
    );
  }

  const avgRating    = provider.average_rating ?? null;
  const reviewCount  = provider.review_count ?? reviews.length;
  const initials     = provider.name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {isFr ? "Retour" : "Back"}
      </button>

      {/* Active booking warning */}
      {isExpectedProvider && (
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-amber-800 leading-snug">
            {isFr
              ? "Ce prestataire est attendu chez vous aujourd'hui — vérifiez son identité avant d'ouvrir."
              : "This provider is expected at your home today — verify their identity before opening."}
          </p>
        </div>
      )}

      {/* ID card */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {/* Top blue strip */}
        <div className="bg-[#0F3A7A] h-3" />

        <div className="px-5 pb-5 pt-4 space-y-4">
          {/* Photo + name + ID */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-28 h-28 rounded-full border-4 border-white shadow-md overflow-hidden bg-[#0F3A7A] flex items-center justify-center shrink-0">
              {provider.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={provider.profile_photo_url} alt={provider.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span className="text-3xl font-bold text-white">{initials}</span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{provider.name}</h1>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">ID Shizu: #SP-{provider.id}</p>
            </div>
          </div>

          {/* Verification banner */}
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">
              {isFr ? "Prestataire vérifié Shizu ✓" : "Shizu Verified Provider ✓"}
            </span>
          </div>

          {/* Rating */}
          {avgRating !== null && (
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s}
                  className={`h-4 w-4 ${s <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
              ))}
              <span className="text-sm font-semibold text-gray-800 ml-1">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({reviewCount} {isFr ? "avis" : "reviews"})</span>
            </div>
          )}

          {/* Zone */}
          {provider.zones && provider.zones.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5" />
              {provider.zones.slice(0, 4).join(" · ")}
            </div>
          )}

          {/* Bio */}
          {provider.bio && (
            <p className="text-sm text-gray-600 leading-relaxed text-center">{provider.bio}</p>
          )}

          {/* Services */}
          {provider.services && provider.services.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <Briefcase className="h-3.5 w-3.5" />
                {isFr ? "Ce prestataire intervient à domicile" : "Home services offered"}
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {provider.services.map((svc) => (
                  <span key={svc}
                    className="px-3 py-1 rounded-full bg-[#0F3A7A]/8 border border-[#0F3A7A]/15 text-[#0F3A7A] text-xs font-medium">
                    {svc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats row */}
          {(provider.completed_bookings_count ?? 0) > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
              <div className="text-center">
                <p className="font-bold text-gray-900">{provider.completed_bookings_count}</p>
                <p className="text-xs text-gray-400">{isFr ? "Missions terminées" : "Completed jobs"}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">{avgRating?.toFixed(1) ?? "—"}</p>
                <p className="text-xs text-gray-400">{isFr ? "Note moyenne" : "Avg. rating"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          {isFr ? "Avis clients" : "Client reviews"}
        </h2>

        {loadingReviews ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
            {isFr ? "Aucun avis pour l'instant." : "No reviews yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-100 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {r.client_name.split(" ")[0]}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s}
                        className={`h-3.5 w-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                )}
                {(r.punctuality || r.respect) && (
                  <div className="flex gap-2 flex-wrap">
                    {r.punctuality && (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
                        ✓ {isFr ? "Ponctuel" : "Punctual"}
                      </span>
                    )}
                    {r.respect && (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
                        ✓ {isFr ? "Respectueux" : "Respectful"}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString(isFr ? "fr-FR" : "en-US", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
