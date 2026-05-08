"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Plus, MessageCircle, Star, Loader2, ChevronRight, KeyRound, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiBooking {
  id: number;
  service_name: string;
  service_slug: string | null;
  appointment_date: string;
  status: string;
  provider_name: string | null;
  provider_phone: string | null;
  provider_id: number | null;
  amount_xof: number | null;
  final_amount: number | null;
  payment_status: string;
  created_at: string | null;
  notes: string | null;
  client_location: string | null;
  payment_tier?: string | null;
  deposit_amount?: number | null;
}

interface ClientInfo {
  id: number;
  name: string;
  phone: string;
  account_type: string;
}

interface ApiCategory {
  id: number; name: string; name_fr: string; name_en: string;
  subcategories: { service_id: number | null; name: string; name_fr: string; name_en: string }[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
const SHIZU_WA  = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "").replace(/\D/g, "");

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

function initials(name: string): string {
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

function bookingRef(b: ApiBooking): string {
  const yr = b.created_at ? new Date(b.created_at).getFullYear() : new Date().getFullYear();
  return `#SHZ-${yr}-${b.id}`;
}

interface StatusBadge { label: string; bg: string; text: string; dot: string }

function statusBadge(status: string, provider: string | null): StatusBadge {
  if (status === "completed")
    return { label: "Terminée",          bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500"  };
  if (status === "cancelled" || status === "declined" || status === "disputed")
    return { label: "Annulée",           bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500"    };
  if (status === "pending_payment")
    return { label: "Paiement en attente", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500"  };
  if (status === "accepted" || status === "in_progress")
    return { label: "En cours",          bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500"  };
  if (provider)
    return { label: "Assignée",          bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"   };
  return   { label: "Demande reçue",     bg: "bg-gray-100",  text: "text-gray-600",   dot: "bg-gray-400"   };
}

const ACTIVE_STATUSES = new Set(["requested", "pending", "accepted", "in_progress", "pending_payment"]);
const CANCELLED_STATUSES = new Set(["cancelled", "declined", "disputed"]);

function waShizuHref(b: ApiBooking): string {
  const msg = `Bonjour Shizu, je vous contacte au sujet de ma réservation ${bookingRef(b)}.`;
  return SHIZU_WA ? `https://wa.me/${SHIZU_WA}?text=${encodeURIComponent(msg)}` : "#";
}

function waProviderHref(phone: string, b: ApiBooking): string {
  const p = phone.replace(/\D/g, "");
  const msg = `Bonjour, je vous contacte pour ma réservation ${bookingRef(b)} via Shizu.`;
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

// ── Component ────────────────────────────────────────────────────────────────

type Filter = "all" | "active" | "done" | "cancelled";

export default function ClientDashboard() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();

  const [client, setClient]           = useState<ClientInfo | null>(null);

  // Password change state
  const [pwOpen, setPwOpen]           = useState(false);
  const [pwCurrent, setPwCurrent]     = useState("");
  const [pwNew, setPwNew]             = useState("");
  const [pwConfirm, setPwConfirm]     = useState("");
  const [pwShowCurrent, setPwShowCurrent] = useState(false);
  const [pwShowNew, setPwShowNew]     = useState(false);
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwDone, setPwDone]           = useState(false);
  const [pwError, setPwError]         = useState<string | null>(null);
  const [categories, setCategories]         = useState<ApiCategory[]>([]);
  const [bookings, setBookings]             = useState<ApiBooking[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState<Filter>("all");
  const [reviewedIds, setReviewedIds]       = useState<Set<string>>(new Set());
  const [paymentDeclaredIds, setPaymentDeclaredIds] = useState<Set<number>>(new Set());
  const [declaringPayment, setDeclaringPayment]     = useState<number | null>(null);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then(r => r.json())
      .then((data: ApiCategory[]) => setCategories(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("client_token");
    if (!token) { router.replace(`/${locale}/login`); return; }

    try {
      const info = JSON.parse(localStorage.getItem("client_info") ?? "null");
      if (info) setClient(info);
      const reviewed = localStorage.getItem("dashboard_reviewed_bookings");
      if (reviewed) setReviewedIds(new Set(JSON.parse(reviewed)));
    } catch { /* keep defaults */ }

    fetch(`${FLASK_API}/api/client/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem("client_token");
          localStorage.removeItem("client_info");
          router.replace(`/${locale}/login`);
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        const items: ApiBooking[] = data.items ?? [];
        setBookings(items);
        // Persist the active provider_id so /provider/[id] can show the arrival banner
        const activeItem = items.find(b => ACTIVE_STATUSES.has(b.status) && b.provider_id);
        try {
          if (activeItem?.provider_id) {
            localStorage.setItem("shizu_active_provider_id", String(activeItem.provider_id));
          } else {
            localStorage.removeItem("shizu_active_provider_id");
          }
        } catch { /* ignore */ }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeBooking = useMemo(
    () => bookings.find(b => ACTIVE_STATUSES.has(b.status) && b.status !== "pending_payment") ?? null,
    [bookings]
  );

  const pendingPaymentBookings = useMemo(
    () => bookings.filter(b => b.status === "pending_payment"),
    [bookings]
  );

  const filtered = useMemo(() => {
    if (filter === "active")    return bookings.filter(b => ACTIVE_STATUSES.has(b.status));
    if (filter === "done")      return bookings.filter(b => b.status === "completed");
    if (filter === "cancelled") return bookings.filter(b => CANCELLED_STATUSES.has(b.status));
    return bookings;
  }, [bookings, filter]);

  const totalCount     = bookings.length;
  const completedCount = bookings.filter(b => b.status === "completed").length;

  async function handlePasswordChange() {
    if (pwSaving) return;
    setPwError(null);
    if (pwNew !== pwConfirm) { setPwError("Les mots de passe ne correspondent pas."); return; }
    if (pwNew.length < 6) { setPwError("Minimum 6 caractères."); return; }
    setPwSaving(true);
    try {
      const token = localStorage.getItem("client_token");
      const res = await fetch(`${FLASK_API}/api/client/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPwError(data.error ?? "Erreur."); return; }
      setPwDone(true);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch {
      setPwError("Erreur réseau.");
    } finally {
      setPwSaving(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_info");
    router.push(`/${locale}`);
  }

  async function handleDeclarePayment(bookingId: number) {
    setDeclaringPayment(bookingId);
    try {
      const token = localStorage.getItem("client_token");
      await fetch(`${FLASK_API}/api/bookings/${bookingId}/payment-declared`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      setPaymentDeclaredIds(prev => new Set([...prev, bookingId]));
    } catch { /* silent */ } finally {
      setDeclaringPayment(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3A7A]" />
      </div>
    );
  }

  const displayName = client?.name ?? "vous";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-[#0F3A7A] px-4 pt-6 pb-5 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Name row */}
          <div className="flex items-center justify-between gap-3">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                {initials(client?.name ?? "?")}
              </div>
              <div className="min-w-0">
                <p className="text-white/60 text-xs leading-none mb-0.5">Bonjour 👋</p>
                <p className="text-white font-bold text-base leading-tight truncate">{displayName}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                onClick={() => router.push(`/${locale}/services`)}
                className="flex items-center gap-1.5 border border-white/40 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Réserver
              </button>
              <button
                onClick={handleLogout}
                className="text-white/40 hover:text-white/70 text-[11px] transition-colors"
              >
                Déconnexion
              </button>
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: String(totalCount),     label: "Réservations" },
              { value: String(completedCount), label: "Terminées" },
              { value: "—",                    label: "Note moy." },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5 text-center">
                <p className="text-white font-bold text-lg leading-none">{value}</p>
                <p className="text-white/60 text-[10px] mt-1 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 sm:px-6 space-y-4">

        {/* ── Active booking ───────────────────────────────────────────── */}
        {activeBooking && (
          <div className="rounded-2xl bg-[#f0fdf4] border-2 border-green-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Réservation active</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">{translateService(activeBooking.service_name)}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatDate(activeBooking.appointment_date)} · {formatTime(activeBooking.appointment_date)}
                {activeBooking.client_location ? ` · ${activeBooking.client_location.split(",")[0]}` : ""}
              </p>
            </div>

            {activeBooking.provider_name ? (
              <>
                <div className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-green-100">
                  <div className="w-9 h-9 rounded-full bg-[#0F3A7A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {activeBooking.provider_name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{activeBooking.provider_name}</p>
                    <p className="text-xs text-green-600 font-medium">Prestataire vérifié ✓</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {activeBooking.provider_phone && (
                    <a href={waProviderHref(activeBooking.provider_phone, activeBooking)}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5c] text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Contacter {activeBooking.provider_name.split(" ")[0]}
                    </a>
                  )}
                  {activeBooking.provider_id && (
                    <button
                      onClick={() => router.push(`/${locale}/provider/${activeBooking.provider_id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-semibold px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <ChevronRight className="h-3.5 w-3.5" />
                      Voir fiche
                    </button>
                  )}
                </div>
              </>
            ) : (
              SHIZU_WA ? (
                <a href={waShizuHref(activeBooking)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 border border-[#25D366] text-[#25D366] hover:bg-green-50 text-xs font-semibold px-3 py-2 rounded-xl transition-colors w-full">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Contacter Shizu
                </a>
              ) : null
            )}
          </div>
        )}

        {/* ── Pending payment cards ────────────────────────────────────── */}
        {pendingPaymentBookings.map(b => {
          const alreadyDeclared = paymentDeclaredIds.has(b.id);
          const amt = b.final_amount ?? b.amount_xof;
          const fmtAmt = amt != null ? new Intl.NumberFormat("fr-FR").format(amt) + " FCFA" : null;
          const waMsg = `Bonjour Shizu, je dois effectuer le paiement pour ma réservation ${bookingRef(b)}${fmtAmt ? ` (${fmtAmt})` : ""}. Pouvez-vous m'envoyer les coordonnées de paiement ?`;
          return (
            <div key={b.id} className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Paiement en attente</p>
                  <p className="font-bold text-gray-900 mt-0.5">{translateService(b.service_name)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{bookingRef(b)}</p>
                </div>
                {fmtAmt && (
                  <span className="ml-auto shrink-0 font-bold text-amber-800">{fmtAmt}</span>
                )}
              </div>
              {alreadyDeclared ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">Paiement déclaré — en attente de confirmation Shizu</span>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {SHIZU_WA && (
                    <a href={`https://wa.me/${SHIZU_WA}?text=${encodeURIComponent(waMsg)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Obtenir instructions
                    </a>
                  )}
                  <button
                    disabled={declaringPayment === b.id}
                    onClick={() => handleDeclarePayment(b.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors">
                    {declaringPayment === b.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle className="h-3.5 w-3.5" />}
                    J&apos;ai effectué le paiement
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Filter chips ─────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
          {([
            { key: "all",       label: "Toutes" },
            { key: "active",    label: "En cours" },
            { key: "done",      label: "Terminées" },
            { key: "cancelled", label: "Annulées" },
          ] as { key: Filter; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-[#0F3A7A] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#0F3A7A]/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Booking list ─────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Aucune réservation</p>
            <p className="text-xs text-gray-400 mt-1">Vos réservations apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => {
              const badge      = statusBadge(b.status, b.provider_name);
              const isCompleted = b.status === "completed";
              const isCancelled = CANCELLED_STATUSES.has(b.status);
              const isActive    = ACTIVE_STATUSES.has(b.status);
              const isReviewed  = reviewedIds.has(String(b.id));
              const commune     = b.client_location?.split(",")[0]?.trim() ?? null;
              const reviewQs    = new URLSearchParams({
                service:  b.service_name,
                provider: b.provider_name ?? "",
                date:     formatDate(b.appointment_date),
              }).toString();

              return (
                <div key={b.id}
                  className={`bg-white rounded-2xl border border-gray-100 p-4 space-y-3 ${isCancelled ? "opacity-70" : ""}`}>

                  {/* Top: service + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-mono">{bookingRef(b)}</p>
                      <p className="font-bold text-gray-900 mt-0.5 leading-tight">{translateService(b.service_name)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${badge.bg} ${badge.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>

                  {/* Date · time · commune */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatDate(b.appointment_date)} · {formatTime(b.appointment_date)}</span>
                    {commune && <><span className="text-gray-300">·</span><span>{commune}</span></>}
                  </div>

                  {/* Provider + amount */}
                  {(b.provider_name || b.final_amount != null || b.amount_xof != null) && (
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {b.provider_name && <span className="font-medium text-gray-700">{b.provider_name}</span>}
                      {(() => {
                        const effectiveAmt = b.final_amount ?? b.amount_xof;
                        if (effectiveAmt == null) return null;
                        const fmt = new Intl.NumberFormat("fr-FR").format(effectiveAmt) + " FCFA";
                        if (b.payment_status === "paid") {
                          return <span className="text-green-600 font-semibold">Réglé · {fmt}</span>;
                        }
                        return <span className="text-gray-500">Devis · {fmt}</span>;
                      })()}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {/* Completed actions */}
                    {isCompleted && (
                      <button
                        onClick={() => router.push(rebookHref(b, categories, locale))}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                        Réserver à nouveau
                      </button>
                    )}
                    {isCompleted && !isReviewed && (
                      <button
                        onClick={() => router.push(`/${locale}/review/${b.id}?${reviewQs}`)}
                        className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                        <Star className="h-3.5 w-3.5" />
                        Laisser un avis
                      </button>
                    )}
                    {isCompleted && isReviewed && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 py-2">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        Avis laissé
                      </span>
                    )}

                    {/* Cancelled: only rebook */}
                    {isCancelled && (
                      <button
                        onClick={() => router.push(rebookHref(b, categories, locale))}
                        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                        Réserver à nouveau
                      </button>
                    )}

                    {/* Active: contact Shizu */}
                    {isActive && SHIZU_WA && (
                      <a href={waShizuHref(b)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Contacter Shizu
                      </a>
                    )}

                    {/* All cards: WA outline (skip if already shown as primary) */}
                    {!isActive && SHIZU_WA && (
                      <a href={waShizuHref(b)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 border border-gray-200 text-gray-500 hover:border-[#25D366] hover:text-[#25D366] text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Contacter Shizu
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── New booking CTA ──────────────────────────────────────────── */}
        <button
          onClick={() => router.push(`/${locale}/services`)}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm mt-2">
          <Plus className="h-4 w-4" />
          Nouvelle réservation
        </button>

        {/* Password change */}
        {!pwOpen ? (
          <button
            onClick={() => { setPwOpen(true); setPwDone(false); setPwError(null); }}
            className="flex items-center justify-center gap-1.5 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
            <KeyRound className="h-3.5 w-3.5" />
            Changer mon mot de passe
          </button>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" />
                Changer mon mot de passe
              </p>
              <button onClick={() => { setPwOpen(false); setPwDone(false); setPwError(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {pwDone ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Mot de passe mis à jour.</span>
              </div>
            ) : (
              <>
                {/* Current password */}
                <div className="relative">
                  <input type={pwShowCurrent ? "text" : "password"} value={pwCurrent}
                    onChange={e => setPwCurrent(e.target.value)}
                    placeholder="Mot de passe actuel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <button type="button" onClick={() => setPwShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {pwShowCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* New password */}
                <div className="relative">
                  <input type={pwShowNew ? "text" : "password"} value={pwNew}
                    onChange={e => setPwNew(e.target.value)}
                    placeholder="Nouveau mot de passe (6 car. min.)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <button type="button" onClick={() => setPwShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {pwShowNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Confirm */}
                <input type="password" value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />

                {pwError && <p className="text-xs text-red-600">{pwError}</p>}

                <button onClick={handlePasswordChange}
                  disabled={!pwCurrent || !pwNew || !pwConfirm || pwSaving}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                  {pwSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Mettre à jour
                </button>
              </>
            )}
          </div>
        )}

        {/* WA help link */}
        {SHIZU_WA && (
          <p className="text-center text-xs text-gray-400 pb-6">
            Besoin d&apos;aide ?{" "}
            <a
              href={`https://wa.me/${SHIZU_WA}?text=${encodeURIComponent("Bonjour Shizu, j'ai besoin d'aide.")}`}
              target="_blank" rel="noopener noreferrer"
              className="text-green-600 hover:underline">
              Contactez Shizu sur WhatsApp
            </a>
          </p>
        )}
      </main>
    </div>
  );
}
