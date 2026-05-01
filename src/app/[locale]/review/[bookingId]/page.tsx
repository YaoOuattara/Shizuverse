"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Star, ThumbsUp, ThumbsDown, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REVIEWED_KEY = "dashboard_reviewed_bookings";

function markReviewedInStorage(bookingId: string) {
  try {
    const stored = localStorage.getItem(REVIEWED_KEY);
    const prev: string[] = stored ? JSON.parse(stored) : [];
    const next = Array.from(new Set([...prev, bookingId]));
    localStorage.setItem(REVIEWED_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export default function ReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("reviewPage");

  const bookingId = params.bookingId as string;
  const serviceName = searchParams.get("service") ?? "";
  const providerName = searchParams.get("provider") ?? "";
  const date = searchParams.get("date") ?? "";

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [punctuality, setPunctuality] = useState<boolean | null>(null);
  const [respect, setRespect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!rating) {
      setError(t("errorRequired"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: parseInt(bookingId, 10),
          rating,
          comment: comment.trim() || null,
          punctuality,
          respect,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("errorGeneral"));
        return;
      }
      markReviewedInStorage(bookingId);
      setSubmitted(true);
    } catch {
      setError(t("errorGeneral"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold">{t("successTitle")}</h2>
            <p className="text-muted-foreground">{t("successDesc")}</p>
            <Button onClick={() => router.push(`/${locale}/bookings`)}>
              {t("backToBookings")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const softSkills = [
    { key: "punctuality" as const, value: punctuality, setter: setPunctuality },
    { key: "respect" as const, value: respect, setter: setRespect },
  ];

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-1 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToBookings")}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Booking summary */}
            <div className="rounded-lg bg-muted p-4 space-y-1 text-sm">
              <p className="font-medium text-foreground mb-1">{t("bookingSummary")}</p>
              {serviceName && (
                <p>
                  <span className="text-muted-foreground">{t("service")} : </span>
                  {serviceName}
                </p>
              )}
              {providerName && (
                <p>
                  <span className="text-muted-foreground">{t("provider")} : </span>
                  {providerName}
                </p>
              )}
              {date && (
                <p>
                  <span className="text-muted-foreground">{t("date")} : </span>
                  {date}
                </p>
              )}
            </div>

            {/* Star rating */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("yourRating")}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${
                        star <= (hoveredRating || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Soft skills */}
            <div className="space-y-3">
              <p className="text-sm font-medium">{t("softSkills")}</p>
              {softSkills.map(({ key, value, setter }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{t(key)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setter(value === true ? null : true)}
                      className={`rounded-full p-2 transition-colors ${
                        value === true
                          ? "bg-green-100 text-green-600"
                          : "bg-muted text-muted-foreground hover:bg-green-50 hover:text-green-500"
                      }`}
                      aria-label={`${t(key)} positif`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setter(value === false ? null : false)}
                      className={`rounded-full p-2 transition-colors ${
                        value === false
                          ? "bg-red-100 text-red-600"
                          : "bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-500"
                      }`}
                      aria-label={`${t(key)} négatif`}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("comment")}</p>
              <Textarea
                placeholder={t("commentPlaceholder")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !rating}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
