"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Plus, MessageCircle, Star, Loader2, ChevronRight } from "lucide-react";

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
  created_at: string | null;
  notes: string | null;
  client_location: string | null;
}

interface ClientInfo {
  id: number;
  name: string;
  phone: string;
  account_type: string;
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
    return { label: "Terminée",      bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" };
  if (status === "cancelled" || status === "declined" || status === "disputed")
    return { label: "Annulée",       bg: "bg-red-50",   text: "text-red-700",   dot: "bg-red-500"   };
  if (status === "accepted" || status === "in_progress")
    return { label: "En cours",      bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
  if (provider)
    return { label: "Assignée",      bg: "bg-blue-50",  text: "text-blue-700",  dot: "bg-blue-500"  };
  return   { label: "Demande reçue", bg: "bg-gray-100", text: "text-gray-600",  dot: "bg-gray-400"  };
}

const ACTIVE_STATUSES = new Set(["requested", "pending", "accepted", "in_progress"]);
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

// ── Component ────────────────────────────────────────────────────────────────

type Filter = "all" | "active" | "done" | "cancelled";

export default function ClientDashboard() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();

  const [client, setClient]           = useState<ClientInfo | null>(null);
  const [bookings, setBookings]       = useState<ApiBooking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<Filter>("all");
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

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
      .then(data => { if (data) setBookings(data.items ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeBooking = useMemo(
    () => bookings.find(b => ACTIVE_STATUSES.has(b.status)) ?? null,
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

  function handleLogout() {
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_info");
    router.push(`/${locale}`);
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
                  {(b.provider_name || b.amount_xof != null) && (
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {b.provider_name && <span className="font-medium text-gray-700">{b.provider_name}</span>}
                      {b.amount_xof != null && (
                        <span>{new Intl.NumberFormat("fr-CI").format(b.amount_xof)} FCFA</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {/* Completed actions */}
                    {isCompleted && (
                      <button
                        onClick={() => router.push(b.service_slug ? `/${locale}/booking/${b.service_slug}` : `/${locale}/services`)}
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
                        onClick={() => router.push(b.service_slug ? `/${locale}/booking/${b.service_slug}` : `/${locale}/services`)}
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
