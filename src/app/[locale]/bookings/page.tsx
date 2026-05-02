"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  Loader2,
  ArrowLeft,
  MessageCircle,
  Phone,
  Star,
  RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiBooking {
  id: number;
  service_name: string;
  service_slug: string | null;
  appointment_date: string;
  status: string;
  provider_name: string | null;
  provider_phone: string | null;
  amount_xof: number | null;
  created_at: string | null;
  notes: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const SHIZU_WA = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "").replace(/\D/g, "");
const PHONE_KEY = "shizu_client_phone";
const REVIEWED_KEY = "dashboard_reviewed_bookings";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(input: string): string {
  let p = input.trim().replace(/\s+/g, "");
  if (p.startsWith("00225")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) p = "+225" + p;
  return p;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatRef(id: number): string {
  return `#${id.toString().padStart(4, "0")}`;
}

interface StatusInfo {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

function getStatusInfo(status: string, providerName: string | null): StatusInfo {
  if (status === "completed")
    return { label: "Terminée",      bg: "bg-green-50",  text: "text-green-700", dot: "bg-green-500" };
  if (status === "cancelled" || status === "declined" || status === "disputed")
    return { label: "Annulée",       bg: "bg-red-50",    text: "text-red-700",   dot: "bg-red-500"   };
  if (status === "accepted" || status === "in_progress")
    return { label: "Confirmée",     bg: "bg-green-50",  text: "text-green-700", dot: "bg-green-500" };
  if (providerName)
    return { label: "Assignée",      bg: "bg-blue-50",   text: "text-blue-700",  dot: "bg-blue-500"  };
  return   { label: "Demande reçue", bg: "bg-gray-100",  text: "text-gray-600",  dot: "bg-gray-400"  };
}

function shizuWaHref(bookingId: number, statusLabel: string): string {
  const msg = `Bonjour Shizu, je vous contacte au sujet de ma réservation ${formatRef(bookingId)} (${statusLabel}).`;
  return SHIZU_WA
    ? `https://wa.me/${SHIZU_WA}?text=${encodeURIComponent(msg)}`
    : `#`;
}

function providerWaHref(providerPhone: string, bookingId: number): string {
  const p = providerPhone.replace(/\D/g, "");
  const msg = `Bonjour, je vous contacte pour ma réservation ${formatRef(bookingId)} effectuée via Shizu.`;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();
  const isFr = locale === "fr";

  const [phase, setPhase] = useState<"lookup" | "loading" | "results">("lookup");
  const [phoneInput, setPhoneInput] = useState("");
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PHONE_KEY);
      const reviewed = localStorage.getItem(REVIEWED_KEY);
      if (reviewed) setReviewedIds(new Set(JSON.parse(reviewed)));
      if (saved) {
        setActivePhone(saved);
        doFetch(saved);
      }
    } catch { /* keep defaults */ }
  }, []);

  async function doFetch(phone: string) {
    setPhase("loading");
    setFetchError(null);
    try {
      const res = await fetch(`/api/bookings?client_phone=${encodeURIComponent(phone)}`);
      if (!res.ok) throw new Error("error");
      const data = await res.json();
      const items: ApiBooking[] = data.items ?? [];
      setBookings(items);
      setPhase("results");
      if (items.length > 0) localStorage.setItem(PHONE_KEY, phone);
    } catch {
      setFetchError(
        isFr
          ? "Impossible de charger vos réservations. Vérifiez votre connexion et réessayez."
          : "Could not load your bookings. Check your connection and try again."
      );
      setPhase("lookup");
    }
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    const phone = normalizePhone(phoneInput);
    setActivePhone(phone);
    doFetch(phone);
  }

  function handleReset() {
    localStorage.removeItem(PHONE_KEY);
    setActivePhone(null);
    setPhoneInput("");
    setBookings([]);
    setPhase("lookup");
    setFetchError(null);
  }

  // ── Phone lookup form ──────────────────────────────────────────────────────

  if (phase === "lookup") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <button
              onClick={() => router.push(`/${locale}`)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
              {isFr ? "Retour à l'accueil" : "Back to home"}
            </button>
          </div>
        </header>

        <main className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4 py-12">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F3A7A]/10 mb-4">
                <CalendarDays className="h-7 w-7 text-[#0F3A7A]" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {isFr ? "Mes réservations" : "My Bookings"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {isFr
                  ? "Entrez votre numéro WhatsApp pour retrouver vos réservations."
                  : "Enter your WhatsApp number to view your bookings."}
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {isFr ? "Votre numéro WhatsApp" : "Your WhatsApp number"}
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-input bg-muted text-sm text-muted-foreground font-medium select-none">
                    +225
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="07 00 00 00 00"
                    required
                    autoFocus
                    className="flex-1 rounded-r-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {fetchError && (
                <p className="text-sm text-destructive">{fetchError}</p>
              )}

              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {isFr ? "Voir mes réservations" : "View my bookings"}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-muted-foreground">
              {isFr ? "Pas encore de réservation ?" : "No booking yet?"}{" "}
              <button
                onClick={() => router.push(`/${locale}/services`)}
                className="text-[#0F3A7A] font-medium hover:underline"
              >
                {isFr ? "Réserver un service" : "Book a service"}
              </button>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3A7A]" />
        <p className="text-sm text-muted-foreground">
          {isFr ? "Chargement de vos réservations…" : "Loading your bookings…"}
        </p>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────

  const displayPhone = activePhone ?? "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#0F3A7A]" />
            <h1 className="text-base font-semibold text-foreground">
              {isFr ? "Mes réservations" : "My Bookings"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{displayPhone}</span>
            <button
              onClick={() => doFetch(displayPhone)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isFr ? "Rafraîchir" : "Refresh"}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {isFr ? "Changer de numéro" : "Change number"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h2 className="text-base font-semibold text-foreground">
              {isFr ? "Aucune réservation trouvée" : "No bookings found"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              {isFr
                ? `Aucune réservation associée au numéro ${displayPhone}.`
                : `No bookings linked to ${displayPhone}.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={handleReset}
                className="text-sm border border-input px-4 py-2 rounded-xl hover:bg-muted transition-colors"
              >
                {isFr ? "Essayer un autre numéro" : "Try another number"}
              </button>
              <button
                onClick={() => router.push(`/${locale}/services`)}
                className="text-sm bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {isFr ? "Réserver un service" : "Book a service"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {isFr
                ? `${bookings.length} réservation${bookings.length > 1 ? "s" : ""} trouvée${bookings.length > 1 ? "s" : ""}`
                : `${bookings.length} booking${bookings.length > 1 ? "s" : ""} found`}
            </p>

            {bookings.map((b) => {
              const status = getStatusInfo(b.status, b.provider_name);
              const isCompleted = b.status === "completed";
              const isReviewed = reviewedIds.has(String(b.id));
              const reviewQs = new URLSearchParams({
                service: b.service_name,
                provider: b.provider_name ?? "",
                date: formatDate(b.appointment_date),
              }).toString();

              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-border bg-card p-5 space-y-4"
                >
                  {/* Top row: ref + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">{formatRef(b.id)}</p>
                      <p className="font-semibold text-foreground mt-0.5">{b.service_name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${status.bg} ${status.text}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Date + time */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span>
                      {formatDate(b.appointment_date)} à {formatTime(b.appointment_date)}
                    </span>
                  </div>

                  {/* Provider row */}
                  {b.provider_name && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {isFr ? "Prestataire assigné" : "Assigned provider"}
                        </p>
                        <p className="text-sm font-medium text-foreground">{b.provider_name}</p>
                      </div>
                      {b.provider_phone && (
                        <a
                          href={providerWaHref(b.provider_phone, b.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5c] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {isFr ? "Contacter" : "Contact"}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Amount */}
                  {b.amount_xof != null && (
                    <p className="text-sm text-muted-foreground">
                      {isFr ? "Montant :" : "Amount:"}{" "}
                      <span className="font-semibold text-foreground">
                        {new Intl.NumberFormat("fr-CI").format(b.amount_xof)} FCFA
                      </span>
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Contacter Shizu — always */}
                    {SHIZU_WA && (
                      <a
                        href={shizuWaHref(b.id, status.label)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 border border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {isFr ? "Contacter Shizu" : "Contact Shizu"}
                      </a>
                    )}

                    {/* Laisser un avis — completed + not reviewed */}
                    {isCompleted && !isReviewed && (
                      <button
                        onClick={() =>
                          router.push(`/${locale}/review/${b.id}?${reviewQs}`)
                        }
                        className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                      >
                        <Star className="h-3.5 w-3.5" />
                        {isFr ? "Laisser un avis" : "Leave a review"}
                      </button>
                    )}
                    {isCompleted && isReviewed && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground px-1 py-2">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {isFr ? "Avis laissé" : "Reviewed"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
