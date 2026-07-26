"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  Loader2,
  ArrowLeft,
  MessageCircle,
  Plus,
  Star,
  RefreshCw,
  Hash,
  LogIn,
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
  final_amount: number | null;
  payment_status: string;
  collection_status?: string | null;
  created_at: string | null;
  notes: string | null;
  client_location?: string | null;
}

interface ApiCategory {
  id: number; name: string; name_fr: string; name_en: string;
  subcategories: { service_id: number | null; name: string; name_fr: string; name_en: string }[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
const SHIZU_WA  = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "").replace(/\D/g, "");
const PHONE_KEY   = "shizu_client_phone";
const REF_KEY     = "shizu_client_ref";
const REVIEWED_KEY = "dashboard_reviewed_bookings";

// ── Service name translation ──────────────────────────────────────────────────

const SERVICE_MAP: [string, string][] = [
  ["cleaning",   "Ménage et nettoyage"],
  ["nettoyage",  "Ménage et nettoyage"],
  ["ménage",     "Ménage et nettoyage"],
  ["plumbing",   "Plomberie"],
  ["plomberie",  "Plomberie"],
  ["handyman",   "Bricolage & Réparations"],
  ["bricolage",  "Bricolage & Réparations"],
  ["electrical", "Électricité"],
  ["electr",     "Électricité"],
  ["childcare",  "Garde d'enfants"],
  ["baby",       "Garde d'enfants"],
  ["nounou",     "Garde d'enfants"],
  ["beauty",     "Beauté à domicile"],
  ["beauté",     "Beauté à domicile"],
  ["coiffure",   "Beauté à domicile"],
  ["garden",     "Jardinage et piscine"],
  ["jardinage",  "Jardinage et piscine"],
  ["piscine",    "Jardinage et piscine"],
  ["ac ",        "Climatisation et électroménager"],
  ["clim",       "Climatisation et électroménager"],
  ["electromen", "Climatisation et électroménager"],
  ["senior",     "Aide aux seniors"],
  ["painting",   "Peinture & Rénovation"],
  ["peinture",   "Peinture & Rénovation"],
];

function translateService(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, val] of SERVICE_MAP) {
    if (lower.includes(key)) return val;
  }
  return name;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRef(input: string): string {
  return input.trim().replace(/^#/, "").toUpperCase();
}

/**
 * Miroir front de normalize_phone (backend, shizuverse/utils/phone.py) — les
 * réservations sont stockées en E.164 (+225 + 10 chiffres, 0 compris).
 * Normaliser AVANT envoi rend le lookup indépendant de la version du backend
 * déployé : 0707050154, "07 07 05 01 54", 225…, 00225…, +33… matchent tous.
 */
function normalizePhoneInput(input: string): string {
  let p = input.trim().replace(/[\s\-.()]/g, "");
  p = p.replace(/^\+?(?:00)?225(?:\+?225)+/, "+225"); // double indicatif accidentel
  if (p.startsWith("00")) p = "+" + p.slice(2);       // 00225… -> +225…
  if (p.startsWith("225") && !p.startsWith("+")) p = "+" + p;
  if (p.startsWith("+")) return p;                    // international (CI ou étranger)
  if (p.startsWith("0") && p.length === 10) return "+225" + p; // local CI
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
  return `#SHZ-${new Date().getFullYear()}-${id}`;
}

interface StatusInfo { label: string; bg: string; text: string; dot: string }

function getStatusInfo(status: string, providerName: string | null): StatusInfo {
  if (status === "completed")
    return { label: "Terminée",      bg: "bg-green-50",  text: "text-green-700", dot: "bg-green-500" };
  if (status === "cancelled" || status === "declined" || status === "disputed")
    return { label: "Annulée",       bg: "bg-red-50",    text: "text-red-700",   dot: "bg-red-500"   };
  if (status === "accepted" || status === "in_progress")
    return { label: "En cours",      bg: "bg-amber-50",  text: "text-amber-700", dot: "bg-amber-500" };
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

// ── Rebook routing helpers ────────────────────────────────────────────────────

function findServiceId(serviceName: string, categories: ApiCategory[]): number | null {
  const lower = serviceName.toLowerCase();
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      if (sub.service_id === null) continue;
      const names = [sub.name_fr, sub.name_en, sub.name].map(s => s.toLowerCase());
      if (names.some(n => n && (lower.includes(n) || n.includes(lower)))) return sub.service_id;
    }
    const catNames = [cat.name_fr, cat.name_en, cat.name].map(s => s.toLowerCase());
    if (catNames.some(n => n && (lower.includes(n) || n.includes(lower)))) {
      const first = cat.subcategories.find(s => s.service_id !== null);
      if (first?.service_id) return first.service_id;
    }
  }
  return null;
}

function rebookHref(b: ApiBooking, categories: ApiCategory[], locale: string): string {
  const sid = findServiceId(b.service_name, categories);
  if (!sid) return `/${locale}/services`;
  const loc = b.client_location ?? "";
  const commaIdx = loc.indexOf(",");
  const commune = (commaIdx >= 0 ? loc.slice(0, commaIdx) : loc).trim();
  const address  = commaIdx >= 0 ? loc.slice(commaIdx + 1).trim() : "";
  const qs = new URLSearchParams({ rebook: "true" });
  if (commune) qs.set("commune", commune);
  if (address)  qs.set("address", address);
  return `/${locale}/booking/${sid}?${qs.toString()}`;
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
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [expandedId, setExpandedId]       = useState<number | null>(null);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then(r => r.json())
      .then((data: ApiCategory[]) => setCategories(data))
      .catch(() => {});
  }, []);

  // If client is already logged in, send them straight to their dashboard
  useEffect(() => {
    try {
      if (localStorage.getItem("client_token")) {
        router.replace(`/${locale}/client/dashboard`);
        return;
      }
      const savedPhone = localStorage.getItem(PHONE_KEY);
      const savedRef   = localStorage.getItem(REF_KEY);
      const reviewed   = localStorage.getItem(REVIEWED_KEY);
      if (reviewed) setReviewedIds(new Set(JSON.parse(reviewed)));
      if (savedPhone && savedRef) {
        // Les valeurs sauvegardées avant l'ajout du helper peuvent être brutes.
        const phone = normalizePhoneInput(savedPhone);
        setActivePhone(phone);
        doFetch(phone, savedRef);
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
    const phone = normalizePhoneInput(phoneInput);
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

  // ── Lookup / login gate ────────────────────────────────────────────────────

  if (phase === "lookup") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <button
              onClick={() => showGuestForm ? setShowGuestForm(false) : router.push(`/${locale}`)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
              {showGuestForm
                ? (isFr ? "Se connecter à la place" : "Log in instead")
                : (isFr ? "Retour à l'accueil" : "Back to home")}
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
            </div>

            {!showGuestForm ? (
              /* ── Primary: login CTA ───────────────────────────────── */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center -mt-4 mb-2">
                  {isFr
                    ? "Connectez-vous pour accéder à toutes vos réservations."
                    : "Log in to access all your bookings."}
                </p>
                <button
                  onClick={() => router.push(`/${locale}/login`)}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  {isFr ? "Se connecter pour voir mes réservations" : "Log in to view my bookings"}
                </button>
                <p className="text-center text-sm text-muted-foreground">
                  {isFr ? "Première réservation ?" : "First booking?"}{" "}
                  <button
                    onClick={() => setShowGuestForm(true)}
                    className="text-[#0F3A7A] font-medium hover:underline"
                  >
                    {isFr ? "Suivre sans compte →" : "Track without account →"}
                  </button>
                </p>
              </div>
            ) : (
              /* ── Guest form ───────────────────────────────────────── */
              <form onSubmit={handleLookup} className="space-y-4">
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

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    <Hash className="inline h-3.5 w-3.5 mr-1 mb-0.5" />
                    {isFr ? "Numéro de réservation" : "Booking reference"}
                  </label>
                  <input
                    type="text"
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value)}
                    placeholder="#SHZ-2026-XXXX"
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

                {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {isFr ? "Voir mes réservations" : "View my bookings"}
                </button>
              </form>
            )}
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
              const status      = getStatusInfo(b.status, b.provider_name);
              const isCompleted = b.status === "completed";
              const isRequested = b.status === "requested" || b.status === "pending";
              const isReviewed  = reviewedIds.has(String(b.id));
              const isExpanded  = expandedId === b.id;
              const reviewQs    = new URLSearchParams({
                service:  b.service_name,
                provider: b.provider_name ?? "",
                date:     formatDate(b.appointment_date),
              }).toString();
              const waModifyMsg = encodeURIComponent(
                `Bonjour Shizu, je souhaite modifier ma réservation ${formatRef(b.id)} (${translateService(b.service_name)}).`
              );

              return (
                <div key={b.id} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  {/* Top row: ref + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">{formatRef(b.id)}</p>
                      <p className="font-semibold text-foreground mt-0.5">{translateService(b.service_name)}</p>
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

                  {/* Amount */}
                  {(b.final_amount != null || b.amount_xof != null) && (() => {
                    const effectiveAmt = b.final_amount ?? b.amount_xof!;
                    const fmt = new Intl.NumberFormat("fr-FR").format(effectiveAmt) + " FCFA";
                    const isPaid = (b.collection_status ?? b.payment_status) === "paid";
                    return (
                      <p className="text-sm text-muted-foreground">
                        {isPaid
                          ? <>{isFr ? "Montant réglé" : "Amount paid"}{" : "}<span className="font-semibold text-green-600">{fmt}</span></>
                          : <>{isFr ? "Devis" : "Quote"}{" : "}<span className="font-semibold text-foreground">{fmt}</span></>
                        }
                      </p>
                    );
                  })()}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="rounded-xl bg-muted/40 px-3 py-3 space-y-2 text-sm">
                      {b.provider_name && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{isFr ? "Prestataire" : "Provider"}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{b.provider_name}</span>
                            {b.provider_phone && (
                              <a href={providerWaHref(b.provider_phone, b.id)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 bg-[#25D366] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                <MessageCircle className="h-3 w-3" />
                                WA
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      {b.client_location && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">{isFr ? "Adresse" : "Address"}</span>
                          <span className="text-right">{b.client_location}</span>
                        </div>
                      )}
                      {b.notes && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">{isFr ? "Notes" : "Notes"}</span>
                          <span className="text-right italic text-muted-foreground">{b.notes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {/* Voir détails toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : b.id)}
                      className="flex items-center gap-1.5 border border-input text-muted-foreground hover:text-foreground hover:border-gray-300 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                    >
                      {isExpanded ? (isFr ? "Réduire" : "Collapse") : (isFr ? "Voir détails" : "View details")}
                    </button>

                    {/* Contacter Shizu */}
                    {SHIZU_WA && (
                      <a
                        href={shizuWaHref(b.id, status.label)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5c] text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        💬 {isFr ? "Contacter Shizu" : "Contact Shizu"}
                      </a>
                    )}

                    {/* Modifier — requested only */}
                    {isRequested && SHIZU_WA && (
                      <a
                        href={`https://wa.me/${SHIZU_WA}?text=${waModifyMsg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                      >
                        {isFr ? "Modifier" : "Edit"}
                      </a>
                    )}

                    {/* Rebook — completed */}
                    {isCompleted && (
                      <button
                        onClick={() => router.push(rebookHref(b, categories, locale))}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isFr ? "Réserver à nouveau" : "Book again"}
                      </button>
                    )}

                    {/* Review — completed, not reviewed */}
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
