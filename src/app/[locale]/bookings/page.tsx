"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  Loader2,
  ArrowLeft,
  MessageCircle,
  Star,
  RefreshCw,
  Hash,
} from "lucide-react";
import PhoneInput from "@/components/PhoneInput";

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

const SHIZU_WA  = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "").replace(/\D/g, "");
const PHONE_KEY   = "shizu_client_phone";
const REF_KEY     = "shizu_client_ref";
const REVIEWED_KEY = "dashboard_reviewed_bookings";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRef(input: string): string {
  return input.trim().replace(/^#/, "").toUpperCase();
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
  return `#SHZ-${new Date().getFullYear()}-${id}`;
}

interface StatusInfo { label: string; bg: string; text: string; dot: string }

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
  const ref = formatRef(bookingId);
  const msg = `Bonjour Shizu, je vous contacte au sujet de ma réservation ${ref} (${statusLabel}).`;
  return SHIZU_WA ? `https://wa.me/${SHIZU_WA}?text=${encodeURIComponent(msg)}` : "#";
}

function providerWaHref(providerPhone: string, bookingId: number): string {
  const p = providerPhone.replace(/\D/g, "");
  const msg = `Bonjour, je vous contacte pour ma réservation ${formatRef(bookingId)} effectuée via Shizu.`;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const params  = useParams();
  const locale  = (params?.locale as string) ?? "fr";
  const router  = useRouter();
  const isFr    = locale === "fr";

  const [phase, setPhase]           = useState<"lookup" | "loading" | "results">("lookup");
  const [phoneInput, setPhoneInput] = useState("");
  const [refInput, setRefInput]     = useState("");
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [bookings, setBookings]     = useState<ApiBooking[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  // Hydrate from localStorage — auto-fetch if both phone + ref are stored
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem(PHONE_KEY);
      const savedRef   = localStorage.getItem(REF_KEY);
      const reviewed   = localStorage.getItem(REVIEWED_KEY);
      if (reviewed) setReviewedIds(new Set(JSON.parse(reviewed)));
      if (savedPhone && savedRef) {
        setActivePhone(savedPhone);
        doFetch(savedPhone, savedRef);
      }
    } catch { /* keep defaults */ }
  }, []);

  async function doFetch(phone: string, ref: string) {
    setPhase("loading");
    setFetchError(null);
    try {
      const url = `/api/bookings?client_phone=${encodeURIComponent(phone)}&ref=${encodeURIComponent(ref)}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error("network");
      const data = await res.json();
      const items: ApiBooking[] = data.items ?? [];
      setBookings(items);
      setPhase("results");
      // Persist credentials only if lookup succeeded with results
      if (items.length > 0) {
        localStorage.setItem(PHONE_KEY, phone);
        localStorage.setItem(REF_KEY, ref);
      }
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
    if (!phoneInput.trim() || !refInput.trim()) return;
    const phone = phoneInput.replace(/\s+/g, "");
    const ref   = normalizeRef(refInput);
    setActivePhone(phone);
    doFetch(phone, ref);
  }

  function handleReset() {
    localStorage.removeItem(PHONE_KEY);
    localStorage.removeItem(REF_KEY);
    setActivePhone(null);
    setPhoneInput("");
    setRefInput("");
    setBookings([]);
    setPhase("lookup");
    setFetchError(null);
  }

  const canSubmit = phoneInput.replace(/\D/g, "").length >= 6 && refInput.trim().length > 0;

  // ── Phone + ref lookup form ────────────────────────────────────────────────

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
                  ? "Entrez votre numéro WhatsApp et votre référence de réservation."
                  : "Enter your WhatsApp number and booking reference."}
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              {/* Phone field */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {isFr ? "Numéro WhatsApp" : "WhatsApp number"}
                </label>
                <PhoneInput
                  defaultValue={phoneInput}
                  onChange={setPhoneInput}
                  autoFocus
                  required
                />
              </div>

              {/* Reference field */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <Hash className="inline h-3.5 w-3.5 mr-1 mb-0.5" />
                  {isFr ? "Numéro de réservation" : "Booking reference"}
                </label>
                <input
                  type="text"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder="#SHZ-2025-XXXX"
                  required
                  autoComplete="off"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground placeholder:font-sans"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isFr
                    ? "Reçu sur WhatsApp après votre réservation"
                    : "Received on WhatsApp after your booking"}
                </p>
              </div>

              {fetchError && (
                <p className="text-sm text-destructive">{fetchError}</p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
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
              onClick={() => {
                const savedRef = localStorage.getItem(REF_KEY) ?? "";
                doFetch(displayPhone, savedRef);
              }}
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
                ? `Aucune réservation associée à ce numéro et cette référence.`
                : `No bookings found for this number and reference.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={handleReset}
                className="text-sm border border-input px-4 py-2 rounded-xl hover:bg-muted transition-colors"
              >
                {isFr ? "Réessayer" : "Try again"}
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
              const status     = getStatusInfo(b.status, b.provider_name);
              const isCompleted = b.status === "completed";
              const isReviewed  = reviewedIds.has(String(b.id));
              const reviewQs    = new URLSearchParams({
                service:  b.service_name,
                provider: b.provider_name ?? "",
                date:     formatDate(b.appointment_date),
              }).toString();

              return (
                <div key={b.id} className="rounded-2xl border border-border bg-card p-5 space-y-4">
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
                    <span>{formatDate(b.appointment_date)} à {formatTime(b.appointment_date)}</span>
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

                    {isCompleted && !isReviewed && (
                      <button
                        onClick={() => router.push(`/${locale}/review/${b.id}?${reviewQs}`)}
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
