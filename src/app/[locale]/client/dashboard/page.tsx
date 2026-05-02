"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays, Plus, MessageCircle, Star, Loader2,
  LogOut, ChevronRight,
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

const ACTIVE_STATUSES = new Set(["requested", "accepted", "in_progress"]);

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

type Filter = "all" | "active" | "done";

export default function ClientDashboard() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();
  const isFr   = locale === "fr";

  const [client, setClient]       = useState<ClientInfo | null>(null);
  const [bookings, setBookings]   = useState<ApiBooking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>("all");
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
      .then(data => {
        if (data) setBookings(data.items ?? []);
      })
      .catch(() => { /* show empty state */ })
      .finally(() => setLoading(false));
  }, []);

  const activeBooking = useMemo(
    () => bookings.find(b => ACTIVE_STATUSES.has(b.status)) ?? null,
    [bookings]
  );

  const filtered = useMemo(() => {
    if (filter === "active") return bookings.filter(b => ACTIVE_STATUSES.has(b.status));
    if (filter === "done")   return bookings.filter(b => b.status === "completed");
    return bookings;
  }, [bookings, filter]);

  function handleLogout() {
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_info");
    router.push(`/${locale}`);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3A7A]" />
      </div>
    );
  }

  const displayName = client?.name ?? (isFr ? "vous" : "you");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Dark blue header ─────────────────────────────────────────── */}
      <header className="bg-[#0F3A7A] px-4 pt-6 pb-5 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initials(client?.name ?? "?")}
            </div>
            <div>
              <p className="text-white/60 text-xs">
                {isFr ? "Bonjour," : "Hello,"}
              </p>
              <p className="text-white font-semibold text-base leading-tight">{displayName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {isFr ? "Déconnexion" : "Log out"}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 sm:px-6 space-y-5">

        {/* ── Active booking highlight ───────────────────────────────── */}
        {activeBooking && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                {isFr ? "Réservation en cours" : "Active booking"}
              </p>
            </div>
            <p className="font-semibold text-gray-900">{activeBooking.service_name}</p>
            <p className="text-sm text-gray-500">
              {formatDate(activeBooking.appointment_date)} à {formatTime(activeBooking.appointment_date)}
            </p>
            {activeBooking.provider_name && (
              <p className="text-sm text-gray-600">
                {isFr ? "Prestataire :" : "Provider:"}{" "}
                <span className="font-medium">{activeBooking.provider_name}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {activeBooking.provider_phone && (
                <a
                  href={waProviderHref(activeBooking.provider_phone, activeBooking)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5c] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {isFr ? "Contacter mon prestataire" : "Contact provider"}
                </a>
              )}
              {SHIZU_WA && (
                <a
                  href={waShizuHref(activeBooking)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 border border-[#25D366] text-[#25D366] hover:bg-green-50 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {isFr ? "Contacter Shizu" : "Contact Shizu"}
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Filter chips ───────────────────────────────────────────── */}
        <div className="flex gap-2">
          {(["all", "active", "done"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-[#0F3A7A] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#0F3A7A]/40"
              }`}
            >
              {f === "all"    && (isFr ? "Toutes" : "All")}
              {f === "active" && (isFr ? "En cours" : "Active")}
              {f === "done"   && (isFr ? "Terminées" : "Completed")}
            </button>
          ))}
        </div>

        {/* ── Booking list ───────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              {isFr ? "Aucune réservation" : "No bookings yet"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {isFr ? "Vos réservations apparaîtront ici." : "Your bookings will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => {
              const badge      = statusBadge(b.status, b.provider_name);
              const isCompleted = b.status === "completed";
              const isReviewed  = reviewedIds.has(String(b.id));
              const commune     = b.client_location?.split(",")[0] ?? null;
              const reviewQs    = new URLSearchParams({
                service:  b.service_name,
                provider: b.provider_name ?? "",
                date:     formatDate(b.appointment_date),
              }).toString();

              return (
                <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400 font-mono">{bookingRef(b)}</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{b.service_name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${badge.bg} ${badge.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(b.appointment_date)} · {formatTime(b.appointment_date)}
                    </span>
                    {commune && <span>{commune}</span>}
                  </div>

                  {/* Provider */}
                  {b.provider_name && (
                    <p className="text-xs text-gray-500">
                      {isFr ? "Prestataire :" : "Provider:"}{" "}
                      <span className="font-medium text-gray-700">{b.provider_name}</span>
                    </p>
                  )}

                  {/* Amount */}
                  {b.amount_xof != null && (
                    <p className="text-xs text-gray-500">
                      {new Intl.NumberFormat("fr-CI").format(b.amount_xof)} FCFA
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {/* Contacter mon prestataire — confirmed with phone */}
                    {(b.status === "accepted" || b.status === "in_progress") && b.provider_phone && (
                      <a
                        href={waProviderHref(b.provider_phone, b)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5c] text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {isFr ? "Contacter mon prestataire" : "Contact provider"}
                      </a>
                    )}

                    {/* Réserver à nouveau — completed */}
                    {isCompleted && (
                      <button
                        onClick={() => router.push(
                          b.service_slug
                            ? `/${locale}/booking/${b.service_slug}`
                            : `/${locale}/services`
                        )}
                        className="flex items-center gap-1.5 border border-[#0F3A7A] text-[#0F3A7A] hover:bg-[#0F3A7A] hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                        {isFr ? "Réserver à nouveau" : "Book again"}
                      </button>
                    )}

                    {/* Laisser un avis / Avis laissé */}
                    {isCompleted && !isReviewed && (
                      <button
                        onClick={() => router.push(`/${locale}/review/${b.id}?${reviewQs}`)}
                        className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <Star className="h-3.5 w-3.5" />
                        {isFr ? "Laisser un avis" : "Leave a review"}
                      </button>
                    )}
                    {isCompleted && isReviewed && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 py-1.5">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {isFr ? "Avis laissé" : "Reviewed"}
                      </span>
                    )}

                    {/* Contacter Shizu — always */}
                    {SHIZU_WA && (
                      <a
                        href={waShizuHref(b)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 border border-gray-200 text-gray-500 hover:border-[#25D366] hover:text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {isFr ? "Contacter Shizu" : "Contact Shizu"}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── New booking CTA ────────────────────────────────────────── */}
        <button
          onClick={() => router.push(`/${locale}/services`)}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-2xl transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          {isFr ? "Nouvelle réservation" : "New booking"}
        </button>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {SHIZU_WA && (
        <footer className="text-center py-5 px-4">
          <a
            href={`https://wa.me/${SHIZU_WA}?text=${encodeURIComponent("Bonjour Shizu, j'ai besoin d'aide.")}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {isFr ? "Besoin d'aide" : "Need help"}
          </a>
        </footer>
      )}
    </div>
  );
}
