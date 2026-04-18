"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Star, MapPin, Briefcase, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface PublicProvider {
  id: number;
  name: string;
  bio?: string;
  services?: string[];
  zone?: string;
  rating?: number;
  review_count?: number;
}

interface ProviderReview {
  id: number;
  client_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export default function PublicProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? "fr";
  const providerId = params?.id as string;
  const isFr = locale === "fr";

  const [provider, setProvider] = useState<PublicProvider | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    if (!providerId) return;
    // NOTE: Backend endpoint GET /api/providers/:id needs to be implemented in Flask
    fetch(`${FLASK_API}/api/providers/${providerId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setProvider(data);
      })
      .catch(() => {})
      .finally(() => setLoadingProvider(false));
  }, [providerId]);

  useEffect(() => {
    if (!providerId) return;
    // NOTE: Backend endpoint GET /api/providers/:id/reviews needs to be implemented in Flask
    fetch(`${FLASK_API}/api/providers/${providerId}/reviews`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setReviews(data);
      })
      .catch(() => {})
      .finally(() => setLoadingReviews(false));
  }, [providerId]);

  if (loadingProvider) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">
          {isFr ? "Prestataire introuvable." : "Provider not found."}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          {isFr ? "Retour" : "Back"}
        </Button>
      </div>
    );
  }

  const avgRating = provider.rating ?? (reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {isFr ? "Retour" : "Back"}
      </button>

      {/* Provider header */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{provider.name}</h1>
            {avgRating !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({reviews.length > 0 ? reviews.length : provider.review_count ?? 0}{" "}
                  {isFr ? "avis" : "reviews"})
                </span>
              </div>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {isFr ? "Vérifié ✓" : "Verified ✓"}
          </Badge>
        </div>

        {provider.zone && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {provider.zone}
          </div>
        )}

        {provider.bio && (
          <p className="text-sm text-foreground leading-relaxed">{provider.bio}</p>
        )}

        {provider.services && provider.services.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Briefcase className="h-4 w-4" />
              {isFr ? "Services proposés" : "Services offered"}
            </div>
            <div className="flex flex-wrap gap-2">
              {provider.services.map((svc) => (
                <Badge key={svc} variant="outline">{svc}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reviews section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isFr ? "Avis clients" : "Client Reviews"}
        </h2>

        {loadingReviews ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            {isFr
              ? "Aucun avis pour ce prestataire pour l'instant."
              : "No reviews yet for this provider."}
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {review.client_name}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString(
                    isFr ? "fr-FR" : "en-US",
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
