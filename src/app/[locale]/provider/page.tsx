"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Filter,
  X,
  CalendarDays,
  User,
  Loader2,
  ChevronDown,
  Bell,
  Zap,
  Share2,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProviderBookingCard from "@/components/ProviderBookingCard";
import NewRequestCard from "@/components/NewRequestCard";
import AchievementBadges from "@/components/AchievementBadges";
import DateRangeFilter, { type DateRange } from "@/components/DateRangeFilter";
import StatusTabs from "@/components/StatusTabs";
import UpcomingSchedule from "@/components/UpcomingSchedule";
import { checkScheduleConflicts, formatConflictWarning } from "@/lib/scheduleConflicts";
import {
  type ProviderBooking,
  type ProviderBookingStatus,
} from "@/data/mockProviderBookings";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
import { useTranslations } from "next-intl";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProviderProfileData {
  avg_rating?: number | null;
  review_count?: number;
  profile_photo_url?: string | null;
  id_document_url?: string | null;
  bio?: string | null;
  mobile_money_number?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  address?: string | null;
  services?: string[];
  name?: string | null;
}

// ── Earnings helper ───────────────────────────────────────────────────────────

function computeEarnings(bookings: ProviderBooking[]) {
  type R = ProviderBooking & {
    payment_status?: string;
    payout_status?: string;
    amount_xof?: number | null;
    final_amount?: number | null;
    provider_payout?: number | null;
  };
  const rich = bookings as R[];
  let gagne = 0, verse = 0, enAttente = 0;
  for (const b of rich) {
    const base = b.final_amount ?? b.amount_xof ?? (typeof b.price === "number" ? b.price : 0);
    const effPayout = b.provider_payout != null ? b.provider_payout : Math.round(base * 0.85);
    if (!base) continue;
    if (b.status === "completed" && b.payment_status === "paid") gagne += effPayout;
    if (b.payout_status === "sent") verse += effPayout;
    if (["confirmed", "accepted", "assigned"].includes(b.status as string) && b.payment_status !== "paid") enAttente += base;
  }
  return { gagne, verse, enAttente, prochainVersement: enAttente };
}

function formatFCFA(amount: number) {
  return new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 0 }).format(amount) + " FCFA";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  FILTERS:            "provider_dashboard_filters",
  STATS_VISIBLE:      "provider_dashboard_stats_visible",
  BOOKINGS:           "provider_cached_bookings",
  AVAILABILITY:       "provider_available_today",
  COACHING_DISMISSED: "provider_coaching_dismissed",
  WELCOME_DISMISSED:  "provider_welcome_dismissed",
  CONSEILS_OPEN:      "provider_conseils_open",
  REWARDS_EXPANDED:   "provider_rewards_expanded",
};

const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 768;

interface DashboardFilters {
  status: string;
  date: string;
  service: string;
  dateRange: DateRange;
}

const defaultFilters: DashboardFilters = {
  status: "all",
  date: "all",
  service: "all",
  dateRange: { startDate: null, endDate: null },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProviderDashboard() {
  const t = useTranslations("providerDashboard");
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";

  const [isLoading, setIsLoading]             = useState(true);
  const [hasToken, setHasToken]               = useState(false);
  const [searchQuery, setSearchQuery]         = useState("");
  const [availableToday, setAvailableToday]   = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [providerName, setProviderName]       = useState("");
  const [showFloatingWa, setShowFloatingWa]   = useState(false);
  const [showStats, setShowStats]             = useState(true);
  const [filters, setFilters]                 = useState<DashboardFilters>(defaultFilters);
  const [bookings, setBookings]               = useState<ProviderBooking[]>([]);
  const [providerInfo, setProviderInfo]       = useState<{ id: string | null; verificationStatus: string; rejectionReason: string }>({ id: null, verificationStatus: "", rejectionReason: "" });
  const [avgRating, setAvgRating]             = useState<number | null>(null);
  const [ratingCount, setRatingCount]         = useState<number>(0);

  // New state
  const [providerProfile, setProviderProfile] = useState<ProviderProfileData | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [conseilsOpen, setConseilsOpen]       = useState(false);
  const [rewardsExpanded, setRewardsExpanded] = useState(false);

  // ── Hydrate from localStorage ──────────────────────────────────────────────

  useEffect(() => {
    try {
      const info = JSON.parse(localStorage.getItem("provider_info") || "null");
      if (info) {
        setProviderInfo({
          id: String(info.provider_id ?? info.id ?? ""),
          verificationStatus: info.verification_status ?? "",
          rejectionReason: info.rejection_reason ?? "",
        });
        setProviderName(info.name ?? info.full_name ?? info.company_name ?? "");
      }
      const savedStats = localStorage.getItem(STORAGE_KEYS.STATS_VISIBLE);
      setShowStats(savedStats !== null ? JSON.parse(savedStats) : !isMobileViewport());
      const savedFilters = localStorage.getItem(STORAGE_KEYS.FILTERS);
      if (savedFilters) setFilters(JSON.parse(savedFilters));
      const savedAvailability = localStorage.getItem(STORAGE_KEYS.AVAILABILITY);
      if (savedAvailability !== null) setAvailableToday(JSON.parse(savedAvailability));
      const savedConseils = localStorage.getItem(STORAGE_KEYS.CONSEILS_OPEN);
      if (savedConseils !== null) setConseilsOpen(JSON.parse(savedConseils));
      const savedRewards = localStorage.getItem(STORAGE_KEYS.REWARDS_EXPANDED);
      if (savedRewards !== null) setRewardsExpanded(JSON.parse(savedRewards));
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.STATS_VISIBLE, JSON.stringify(showStats)); }, [showStats]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters)); }, [filters]);

  // Floating WA
  useEffect(() => {
    const onScroll = () => setShowFloatingWa(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Fetch bookings + profile ───────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem("provider_token");
    if (!token) {
      setHasToken(false);
      setIsLoading(false);
      router.replace(`/${locale}/provider/login`);
      return;
    }
    setHasToken(true);

    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS) || "null");
      if (Array.isArray(cached) && cached.length > 0) {
        setBookings(cached);
        setIsLoading(false);
      }
    } catch { /* ignore */ }

    let providerId: string | null = null;
    try {
      const info = JSON.parse(localStorage.getItem("provider_info") || "null");
      providerId = info?.provider_id ?? info?.id ?? null;
    } catch { /* ignore */ }

    // Fetch profile (ratings + document URLs)
    fetch(`${FLASK_API}/api/provider/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setProviderProfile(data);
        if (data.avg_rating != null) setAvgRating(data.avg_rating);
        if (data.review_count != null) setRatingCount(data.review_count);
        if (data.name) setProviderName(prev => prev || data.name);
      })
      .catch(() => {});

    // Fetch bookings
    const url = `${FLASK_API}/api/provider/bookings${providerId ? `?provider_id=${providerId}` : ""}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem("provider_token");
          localStorage.removeItem("provider_info");
          setHasToken(false);
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map(b => ({
            ...b,
            id: String(b.id),
            location: b.location ?? b.client_location ?? undefined,
          }));
          setBookings(mapped);
          localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(mapped));
        }
      })
      .catch(() => {
        const hasCached = (() => {
          try { return Array.isArray(JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS) || "null")); } catch { return false; }
        })();
        if (hasCached) {
          toast({
            title: isFr ? "Données non actualisées" : "Stale data",
            description: isFr
              ? "Impossible de rafraîchir les réservations. Les données affichées peuvent ne pas être à jour."
              : "Could not refresh bookings. Displayed data may be out of date.",
            variant: "destructive",
          });
        }
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Availability ──────────────────────────────────────────────────────────

  const toggleAvailability = async () => {
    const next = !availableToday;
    setAvailableToday(next);
    localStorage.setItem(STORAGE_KEYS.AVAILABILITY, JSON.stringify(next));
    setAvailabilityLoading(true);
    try {
      const token = localStorage.getItem("provider_token");
      await fetch(`${FLASK_API}/api/provider/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ available_today: next }),
      });
    } catch { /* ignore */ } finally {
      setAvailabilityLoading(false);
    }
  };

  // ── Filter handlers ───────────────────────────────────────────────────────

  const handleStatusFilter  = (value: string) => setFilters(p => ({ ...p, status: value }));
  const handleServiceFilter = (value: string) => setFilters(p => ({ ...p, service: value }));
  const handleDateRangeFilter = (range: DateRange) => setFilters(p => ({ ...p, dateRange: range, date: range.startDate || range.endDate ? "all" : p.date }));
  const clearAllFilters = () => { setFilters(defaultFilters); setSearchQuery(""); };

  // ── Booking action handlers ───────────────────────────────────────────────

  const handleAcceptBooking = async (bookingId: string): Promise<void> => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      const conflict = checkScheduleConflicts(
        { date: booking.date, time: booking.time, duration: booking.duration },
        bookings.filter(b => b.status === "confirmed"),
        bookingId
      );
      if (conflict.hasConflict) {
        toast({ title: t("conflictWarningTitle"), description: t("conflictWarningAcceptDesc", { warning: formatConflictWarning(conflict.conflictingBookings) }), variant: "destructive" });
      }
    }
    const token = localStorage.getItem("provider_token");
    const res = await fetch(`${FLASK_API}/api/provider/bookings/${bookingId}/accept`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      toast({ title: t("failedAcceptTitle"), description: t("failedAcceptDesc"), variant: "destructive" });
      throw new Error("Accept failed");
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "confirmed" as ProviderBookingStatus } : b));
    toast({
      title: t("acceptedTitle"),
      description: booking
        ? t("acceptedDesc", { customerName: booking.customerName, serviceName: booking.serviceName })
        : t("acceptedFallback"),
      variant: "success",
    });
  };

  const handleRejectBooking = async (bookingId: string, reason?: string): Promise<void> => {
    const booking = bookings.find(b => b.id === bookingId);
    const token = localStorage.getItem("provider_token");
    const res = await fetch(`${FLASK_API}/api/provider/bookings/${bookingId}/decline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason ?? "" }),
    });
    if (!res.ok) {
      toast({ title: t("failedRejectTitle"), description: t("failedRejectDesc"), variant: "destructive" });
      throw new Error("Decline failed");
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "cancelled" as ProviderBookingStatus } : b));
    toast({
      title: t("rejectedTitle"),
      description: booking ? t("rejectedDesc", { customerName: booking.customerName }) : t("rejectedFallback"),
      variant: "destructive",
    });
  };

  const handleStartBooking = async (bookingId: string): Promise<void> => {
    const token = localStorage.getItem("provider_token");
    const res = await fetch(`${FLASK_API}/api/provider/bookings/${bookingId}/start`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast({ title: "Erreur", description: "Impossible de démarrer la mission.", variant: "destructive" });
      throw new Error("Start failed");
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "in_progress" as ProviderBookingStatus } : b));
    toast({ title: "Mission démarrée !", description: "Le client est informé que vous êtes arrivé.", variant: "success" });
  };

  const handleCompleteBooking = async (bookingId: string): Promise<void> => {
    const token = localStorage.getItem("provider_token");
    const res = await fetch(`${FLASK_API}/api/provider/bookings/${bookingId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast({ title: "Erreur", description: "Impossible de terminer la mission.", variant: "destructive" });
      throw new Error("Complete failed");
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "completed" as ProviderBookingStatus } : b));
    toast({ title: "Mission terminée !", description: "Bravo ! La réservation est marquée comme terminée.", variant: "success" });
  };

  const handleRescheduleBooking = async (bookingId: string, newDate: string, newTime: string): Promise<void> => {
    const booking = bookings.find(b => b.id === bookingId);
    let hasConflict = false;
    if (booking) {
      const conflict = checkScheduleConflicts(
        { date: newDate, time: newTime, duration: booking.duration },
        bookings.filter(b => b.status === "confirmed"),
        bookingId
      );
      if (conflict.hasConflict) {
        hasConflict = true;
        toast({ title: t("conflictWarningTitle"), description: t("conflictRescheduleDesc", { warning: formatConflictWarning(conflict.conflictingBookings) }), variant: "destructive" });
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    if (Math.random() < 0.05) {
      toast({ title: t("failedRescheduleTitle"), description: t("failedRescheduleDesc"), variant: "destructive" });
      throw new Error("Reschedule failed");
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, date: newDate, time: newTime } : b));
    if (!hasConflict) {
      toast({
        title: t("rescheduledTitle"),
        description: booking
          ? t("rescheduledDesc", { customerName: booking.customerName, date: newDate, time: newTime })
          : t("rescheduledFallback", { date: newDate, time: newTime }),
        variant: "success",
      });
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const getBookingConflict = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return null;
    const conflict = checkScheduleConflicts(
      { date: booking.date, time: booking.time, duration: booking.duration },
      bookings.filter(b => b.status === "confirmed"),
      bookingId
    );
    return conflict.hasConflict ? formatConflictWarning(conflict.conflictingBookings) : null;
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      (booking.customerName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booking.serviceName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booking.customerEmail ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filters.status === "all" || booking.status === filters.status ||
      (filters.status === "pending" && booking.status === "requested");
    let matchesDateRange = true;
    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      const bookingDate = new Date(booking.date);
      if (filters.dateRange.startDate && bookingDate < new Date(filters.dateRange.startDate)) matchesDateRange = false;
      if (filters.dateRange.endDate && bookingDate > new Date(filters.dateRange.endDate)) matchesDateRange = false;
    }
    const matchesDate    = filters.date === "all" || booking.date === filters.date;
    const matchesService = filters.service === "all" || booking.serviceName === filters.service;
    return matchesSearch && matchesStatus && matchesDate && matchesDateRange && matchesService;
  });

  const statusCounts = {
    all:       bookings.length,
    pending:   bookings.filter(b => b.status === "pending" || b.status === "requested").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
  };

  const serviceNames = [...new Set(bookings.map(b => b.serviceName).filter(Boolean))].sort();
  const hasActiveFilters =
    filters.status !== "all" || filters.date !== "all" || filters.service !== "all" ||
    filters.dateRange.startDate !== null || filters.dateRange.endDate !== null || searchQuery.trim() !== "";

  const activeFilterCount = [
    filters.status !== "all",
    filters.service !== "all",
    filters.dateRange.startDate !== null || filters.dateRange.endDate !== null,
  ].filter(Boolean).length;

  const waNumber = process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "";
  const waMsg    = encodeURIComponent("Bonjour Shizu, j'ai besoin d'aide avec mon compte prestataire.");
  const waHref   = waNumber
    ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${waMsg}`
    : `whatsapp://send?text=${waMsg}`;

  // ── Profile completion ────────────────────────────────────────────────────

  const completionFields = [
    { key: "photo", label: isFr ? "Photo de profil"      : "Profile photo",  done: !!providerProfile?.profile_photo_url },
    { key: "id",    label: isFr ? "Pièce d'identité"     : "ID document",    done: !!providerProfile?.id_document_url },
    { key: "bio",   label: isFr ? "Présentation"         : "Bio",            done: (providerProfile?.bio?.length ?? 0) > 50 },
    { key: "mm",    label: isFr ? "Mobile Money"         : "Mobile Money",   done: !!providerProfile?.mobile_money_number },
    { key: "zone",  label: isFr ? "Zones d'intervention" : "Service zones",  done: !!providerProfile?.address },
    { key: "phone", label: isFr ? "Téléphone WhatsApp"   : "WhatsApp",       done: !!providerProfile?.phone_number },
  ];
  const completedFieldCount = completionFields.filter(f => f.done).length;
  const missingFields       = completionFields.filter(f => !f.done);
  const completionPct       = Math.round((completedFieldCount / completionFields.length) * 100);

  // ── Unlocked badge count ──────────────────────────────────────────────────

  const unlockedBadges = [
    statusCounts.completed >= 1,
    statusCounts.completed >= 5,
    avgRating !== null && avgRating >= 4.7 && ratingCount >= 5,
    (() => {
      const total = statusCounts.completed + statusCounts.cancelled;
      return total >= 5 && statusCounts.completed / total >= 0.95;
    })(),
    false, // loyalty champion — requires repeat customer data
  ].filter(Boolean).length;

  // ── Smart onboarding banner ───────────────────────────────────────────────

  const onboardingBanner = (() => {
    // Operational — hide banner
    if (statusCounts.pending > 0 || statusCounts.confirmed > 0) return null;

    const vs = providerInfo.verificationStatus;

    // Profile incomplete (only check when profile loaded)
    if (providerProfile && completionPct < 80) return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-800">
          {isFr ? "Complétez votre profil pour recevoir des demandes" : "Complete your profile to receive requests"}
        </p>
        <button onClick={() => router.push(`/${locale}/provider/profile`)}
          className="shrink-0 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap">
          {isFr ? "Compléter →" : "Complete →"}
        </button>
      </div>
    );

    if (vs === "submitted" || vs === "draft") return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
        <span className="text-base leading-none">⏳</span>
        <p className="text-sm font-medium text-blue-800">
          {isFr
            ? "Vérification en cours — vous serez notifié par WhatsApp sous 48h"
            : "Verification in progress — you'll be notified via WhatsApp within 48h"}
        </p>
      </div>
    );

    if (vs === "rejected") return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm font-medium text-red-800">
          {isFr ? "Profil refusé" : "Profile rejected"}{providerInfo.rejectionReason ? ` · ${providerInfo.rejectionReason}` : ""}
        </p>
        <button onClick={() => router.push(`/${locale}/provider/profile`)}
          className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 whitespace-nowrap">
          {isFr ? "Modifier →" : "Edit →"}
        </button>
      </div>
    );

    if (vs === "approved" && !availableToday) return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-[#f0fdf4] px-4 py-3">
        <p className="text-sm font-medium text-green-800">
          {isFr ? "Activez votre disponibilité pour recevoir des demandes" : "Enable your availability to receive requests"}
        </p>
        <button
          onClick={toggleAvailability}
          disabled={availabilityLoading}
          className="shrink-0 flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
          <Zap className="h-3 w-3" />
          {isFr ? "Activer" : "Enable"}
        </button>
      </div>
    );

    if (vs === "approved" && availableToday && statusCounts.all === 0) return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-green-200 bg-[#f0fdf4] px-4 py-3">
        <span className="text-base leading-none">🟢</span>
        <p className="text-sm font-medium text-green-800">
          {isFr ? "Vous êtes visible ! En attente de votre première demande." : "You're live! Waiting for your first request."}
        </p>
      </div>
    );

    return null;
  })();

  // ── Loading / auth guards ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <CalendarDays className="mb-4 h-14 w-14 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">
          {isFr ? "Connectez-vous" : "Log in to continue"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          {isFr
            ? "Connectez-vous pour voir vos réservations et gérer votre activité."
            : "Log in to view your booking requests and manage your dashboard."}
        </p>
        <Button className="mt-6" onClick={() => router.push(`/${locale}/provider/login`)}>
          {isFr ? "Se connecter" : "Log In"}
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* Filter bottom sheet */}
      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end" onClick={() => setFilterSheetOpen(false)}>
          <div
            className="bg-background rounded-t-2xl border-t border-border p-5 space-y-5 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-base">{isFr ? "Filtres" : "Filters"}</p>
              <button onClick={() => setFilterSheetOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">{isFr ? "Statut" : "Status"}</p>
              <Select value={filters.status} onValueChange={handleStatusFilter}>
                <SelectTrigger data-testid="select-status-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatus", { count: statusCounts.all })}</SelectItem>
                  <SelectItem value="pending">{t("statusPending", { count: statusCounts.pending })}</SelectItem>
                  <SelectItem value="confirmed">{t("statusConfirmed", { count: statusCounts.confirmed })}</SelectItem>
                  <SelectItem value="completed">{t("statusCompleted", { count: statusCounts.completed })}</SelectItem>
                  <SelectItem value="cancelled">{t("statusCancelled", { count: statusCounts.cancelled })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">{isFr ? "Période" : "Date range"}</p>
              <DateRangeFilter value={filters.dateRange} onChange={handleDateRangeFilter} />
            </div>

            {serviceNames.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{isFr ? "Service" : "Service"}</p>
                <Select value={filters.service} onValueChange={handleServiceFilter}>
                  <SelectTrigger data-testid="select-service-filter"><SelectValue placeholder={t("allServices")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allServices")}</SelectItem>
                    {serviceNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {hasActiveFilters && (
                <Button variant="outline" className="flex-1" onClick={() => { clearAllFilters(); setFilterSheetOpen(false); }}>
                  {isFr ? "Réinitialiser" : "Reset"}
                </Button>
              )}
              <Button className="flex-1" onClick={() => setFilterSheetOpen(false)}>
                {isFr ? "Appliquer" : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-background border-b px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <h1 className="text-lg font-semibold text-foreground" data-testid="text-header">{t("title")}</h1>
          <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/provider/profile`)} data-testid="button-view-my-profile">
            <User className="mr-1.5 h-3.5 w-3.5" />
            {t("myProfile")}
          </Button>
        </div>

        {/* Compact filter toolbar — hidden when 0 bookings */}
        {statusCounts.all > 0 && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <button
              onClick={() => setFilterSheetOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-input text-muted-foreground hover:text-foreground hover:border-gray-300"
              }`}
            >
              <Filter className="h-4 w-4" />
              {isFr ? "Filtres" : "Filters"}
              {hasActiveFilters && (
                <span className="bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">

        {/* 1 — Provider ID card */}
        {providerInfo.verificationStatus === "approved" ? (
          <div
            className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden cursor-pointer"
            onClick={() => providerInfo.id && window.open(`/${locale}/provider/${providerInfo.id}`, "_blank")}
          >
            <div className="flex items-center gap-4 p-4">
              {providerProfile?.profile_photo_url ? (
                <img
                  src={providerProfile.profile_photo_url}
                  alt="Photo"
                  className="w-[70px] h-[70px] rounded-full object-cover shrink-0 border-2 border-green-200"
                />
              ) : (
                <div className="w-[70px] h-[70px] rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-2xl shrink-0">
                  {(providerName || "P").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 text-base leading-tight truncate">{providerName}</p>
                <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  Prestataire vérifié ✓
                </span>
                <p className="text-[10px] text-gray-400 mt-0.5 font-mono">ID Shizu #SP-{providerInfo.id}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(providerProfile?.services ?? []).slice(0, 2).map(s => (
                    <span key={s} className="text-[10px] bg-[#0F3A7A]/10 text-[#0F3A7A] px-2 py-0.5 rounded-full font-medium">{s}</span>
                  ))}
                  {providerProfile?.address
                    ? providerProfile.address.split(",").slice(0, 2).map(z => z.trim()).filter(Boolean).map(z => (
                        <span key={z} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{z}</span>
                      ))
                    : null}
                </div>
              </div>
            </div>
            <div className="bg-[#0F3A7A] px-4 py-2.5 flex items-center justify-end">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); providerInfo.id && window.open(`/${locale}/provider/${providerInfo.id}`, "_blank"); }}
                className="flex items-center gap-1.5 text-xs text-white/90 font-semibold hover:text-white transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                {isFr ? "Partager ma fiche →" : "Share my profile →"}
              </button>
            </div>
          </div>
        ) : providerInfo.id ? (
          <div className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg shrink-0">
              {(providerName || "P").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{providerName}</p>
              <p className="text-[10px] text-gray-400 font-mono">ID Shizu #SP-{providerInfo.id}</p>
            </div>
          </div>
        ) : null}

        {/* 2 — Smart onboarding banner */}
        {onboardingBanner}

        {/* 3 — Availability toggle */}
        <div
          id="availability-toggle"
          className={`mb-6 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors ${
            availableToday ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${availableToday ? "bg-green-100" : "bg-gray-200"}`}>
              <Zap className={`h-5 w-5 transition-colors ${availableToday ? "text-green-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${availableToday ? "text-green-800" : "text-gray-700"}`}>
                {isFr ? "Disponible aujourd'hui" : "Available today"}
              </p>
              <p className={`text-xs mt-0.5 ${availableToday ? "text-green-600" : "text-gray-400"}`}>
                {availableToday
                  ? (isFr ? "Vous apparaissez comme disponible aux clients" : "You appear as available to clients")
                  : (isFr ? "Vous n'acceptez pas de nouvelles demandes" : "You are not accepting new requests")}
              </p>
            </div>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={availabilityLoading}
            aria-label={isFr ? "Basculer la disponibilité" : "Toggle availability"}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${availableToday ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${availableToday ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* 4 — Nouvelles demandes */}
        {(() => {
          const pending = bookings.filter(b => b.status === "pending" || b.status === "requested");
          return (
            <div className="mb-6" data-testid="section-new-requests">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-5 w-5 text-amber-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {isFr ? "Nouvelles demandes" : "New Requests"}
                </h2>
                {pending.length > 0 && <Badge variant="destructive" className="text-xs">{pending.length}</Badge>}
              </div>
              {pending.length === 0 ? (
                <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-8 text-center">
                  <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">
                    {isFr ? "Pas encore de demandes" : "No requests yet"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    {isFr
                      ? "Activez votre disponibilité pour commencer à recevoir des clients"
                      : "Enable your availability to start receiving clients"}
                  </p>
                  {!availableToday && (
                    <button
                      onClick={toggleAvailability}
                      disabled={availabilityLoading}
                      className="mt-4 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Zap className="h-4 w-4" />
                      {isFr ? "Activer maintenant" : "Enable now"}
                    </button>
                  )}
                  {availableToday && (
                    <p className="mt-3 text-xs text-green-600 font-medium">
                      ✓ {isFr ? "Vous êtes disponible — en attente de demandes" : "You're available — waiting for requests"}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pending.map(booking => (
                    <NewRequestCard
                      key={booking.id}
                      booking={booking}
                      locale={locale}
                      onAccept={handleAcceptBooking}
                      onDecline={(id, reason) => handleRejectBooking(id, reason)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 5 — Planning à venir */}
        <div className="mb-6">
          <UpcomingSchedule bookings={bookings} />
        </div>

        {/* 6 — Earnings */}
        {(() => {
          const { gagne, enAttente, verse, prochainVersement } = computeEarnings(bookings);
          const cards = [
            { label: isFr ? "Gagné"              : "Earned",       value: gagne,             sub: isFr ? "réservations terminées"      : "completed bookings",          textColor: "text-green-700", bg: "bg-green-50",  border: "border-green-100" },
            { label: isFr ? "En attente"         : "Pending",      value: enAttente,         sub: isFr ? "confirmé, paiement en cours" : "confirmed, awaiting payout",  textColor: "text-amber-700", bg: "bg-amber-50",  border: "border-amber-100" },
            { label: isFr ? "Versé"              : "Paid out",     value: verse,             sub: isFr ? "déjà reversé"                : "already disbursed",           textColor: "text-blue-700",  bg: "bg-blue-50",   border: "border-blue-100"  },
            { label: isFr ? "Prochain versement" : "Next payout",  value: prochainVersement, sub: isFr ? "estimation prochaine"        : "upcoming estimate",           textColor: "text-gray-700",  bg: "bg-white",     border: "border-gray-100"  },
          ];
          return (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {isFr ? "Mes gains" : "My earnings"}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {cards.map(({ label, value, sub, textColor, bg, border }) => (
                  <div key={label} className={`rounded-2xl border ${border} ${bg} px-4 py-4 shadow-sm`}>
                    <p className={`text-xs font-medium ${textColor} mb-1`}>{label}</p>
                    <p className={`text-lg font-bold tabular-nums leading-tight ${textColor}`}>{formatFCFA(value)}</p>
                    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 7 — Dynamic profile completion */}
        {missingFields.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-amber-800">
                {isFr ? `Profil complété à ${completionPct}%` : `Profile ${completionPct}% complete`}
              </p>
              <button
                onClick={() => router.push(`/${locale}/provider/profile`)}
                className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
              >
                {isFr ? "Compléter →" : "Complete →"}
              </button>
            </div>
            <div className="w-full bg-amber-200 rounded-full h-1.5 mb-3">
              <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingFields.map(f => (
                <span key={f.key} className="text-xs bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                  ⚠ {f.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 8 — Conseils Shizu */}
        {(() => {
          const allTips = [
            !availableToday && {
              icon: "⚡",
              text: isFr ? "Activez votre disponibilité pour recevoir des demandes" : "Enable your availability to receive requests",
              onAction: toggleAvailability,
              actionLabel: isFr ? "Activer →" : "Enable →",
            },
            (providerProfile?.bio?.length ?? 0) <= 50 && {
              icon: "✍️",
              text: isFr ? "Rédigez une présentation (50 mots min.) pour rassurer les clients" : "Write a bio (50+ words) to reassure clients",
              onAction: () => router.push(`/${locale}/provider/profile`),
              actionLabel: isFr ? "Compléter →" : "Complete →",
            },
            !providerProfile?.profile_photo_url && {
              icon: "📷",
              text: isFr ? "Ajoutez une photo de profil pour inspirer confiance" : "Add a profile photo to build trust",
              onAction: () => router.push(`/${locale}/provider/profile`),
              actionLabel: isFr ? "Mon profil →" : "My profile →",
            },
            {
              icon: "🔔",
              text: isFr ? "Répondez rapidement aux demandes — idéalement en moins de 2h" : "Respond quickly to requests — ideally within 2h",
            },
            {
              icon: "📤",
              text: isFr ? "Partagez votre fiche pour obtenir des clients directement" : "Share your profile to get direct clients",
              onAction: () => providerInfo.id && window.open(`/${locale}/provider/${providerInfo.id}`, "_blank"),
              actionLabel: isFr ? "Partager →" : "Share →",
            },
          ].filter(Boolean) as Array<{ icon: string; text: string; onAction?: () => void; actionLabel?: string }>;
          const tips = allTips.slice(0, 4);
          return (
            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  const next = !conseilsOpen;
                  setConseilsOpen(next);
                  localStorage.setItem(STORAGE_KEYS.CONSEILS_OPEN, JSON.stringify(next));
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-blue-900 hover:bg-blue-100/60 transition-colors"
              >
                <span>💡 {isFr ? "Conseils Shizu" : "Shizu Tips"}</span>
                <ChevronDown className={`h-4 w-4 text-blue-400 transition-transform duration-200 ${conseilsOpen ? "rotate-180" : ""}`} />
              </button>
              {conseilsOpen && (
                <div className="px-4 pb-4 border-t border-blue-100 pt-3 space-y-3">
                  {tips.map((tip, i) => (
                    <div key={i} className="flex items-center gap-3 min-h-[44px]">
                      <span className="text-base shrink-0">{tip.icon}</span>
                      <p className="flex-1 text-sm text-blue-800">{tip.text}</p>
                      {tip.onAction && tip.actionLabel && (
                        <button onClick={tip.onAction} className="shrink-0 min-h-[44px] px-2 text-xs font-semibold text-blue-600 hover:underline">
                          {tip.actionLabel}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 9 — Performances */}
        {(() => {
          const totalWithOutcome = statusCounts.confirmed + statusCounts.completed + statusCounts.cancelled;
          const accepted   = statusCounts.confirmed + statusCounts.completed;
          const acceptRate = totalWithOutcome > 0 ? Math.round((accepted / totalWithOutcome) * 100) : null;
          const perfItems  = [
            { label: isFr ? "Note moyenne"       : "Avg rating",      value: avgRating !== null ? avgRating.toFixed(1) : "—",    sub: ratingCount > 0 ? `${ratingCount} ${isFr ? "avis" : "reviews"}` : (isFr ? "Pas encore d'avis" : "No reviews yet") },
            { label: isFr ? "Missions terminées" : "Completed",        value: String(statusCounts.completed),                    sub: isFr ? "au total" : "total" },
            { label: isFr ? "Taux d'acceptation" : "Acceptance rate",  value: acceptRate !== null ? `${acceptRate}%` : "—",     sub: totalWithOutcome > 0 ? `${accepted}/${totalWithOutcome}` : (isFr ? "Pas encore de données" : "No data yet") },
            { label: isFr ? "Délai de réponse"   : "Response time",    value: "< 2h",                                            sub: isFr ? "estimation" : "estimate" },
          ];
          return (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {isFr ? "Performances" : "Performance"}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {perfItems.map(({ label, value, sub }) => (
                  <div key={label} className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                    <p className="text-base font-semibold text-foreground tabular-nums">{value}</p>
                    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 10 — Récompenses (compact collapsible) */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => {
              const next = !rewardsExpanded;
              setRewardsExpanded(next);
              localStorage.setItem(STORAGE_KEYS.REWARDS_EXPANDED, JSON.stringify(next));
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">
                {isFr
                  ? `Progression : ${unlockedBadges}/5 badges débloqués`
                  : `Progress: ${unlockedBadges}/5 badges unlocked`}
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${rewardsExpanded ? "rotate-180" : ""}`} />
          </button>
          {rewardsExpanded && (
            <div className="border-t border-gray-100 px-4 pb-4 pt-3">
              <AchievementBadges bookings={bookings} />
            </div>
          )}
        </div>

        {/* 11 — Booking list */}
        {statusCounts.all > 0 && (
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-4 border-b border-border/50 md:relative md:mx-0 md:px-0 md:py-0 md:mb-4 md:border-b-0 md:bg-transparent md:backdrop-blur-none">
            <StatusTabs value={filters.status} onChange={handleStatusFilter} counts={statusCounts} />
          </div>
        )}

        {filteredBookings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="bookings-grid">
            {filteredBookings.map(booking => (
              <ProviderBookingCard
                key={booking.id}
                booking={booking}
                conflictWarning={getBookingConflict(booking.id)}
                onAccept={handleAcceptBooking}
                onReject={handleRejectBooking}
                onReschedule={handleRescheduleBooking}
                onStart={handleStartBooking}
                onComplete={handleCompleteBooking}
              />
            ))}
          </div>
        ) : statusCounts.all > 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
            <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">{t("noBookingsTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters ? t("noBookingsWithFilters") : t("noBookingsEmpty")}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearAllFilters} data-testid="button-clear-filters-empty">
                {t("clearAllFilters")}
              </Button>
            )}
          </div>
        ) : null}
      </main>

      {/* Floating WhatsApp — mobile only */}
      {showFloatingWa && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={isFr ? "Contacter le support WhatsApp" : "WhatsApp support"}
          className="sm:hidden fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg hover:bg-[#1ebe5c] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
