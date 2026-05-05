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
  ChevronUp,
  Bell,
  Zap,
  Share2,
  Lightbulb,
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

// Compute 4-state earnings from provider bookings
function computeEarnings(bookings: ProviderBooking[]) {
  type R = ProviderBooking & {
    payment_status?: string;
    payout_status?: string;
    amount_xof?: number | null;
    final_amount?: number | null;
    provider_payout?: number | null;
  };
  const rich = bookings as R[];

  let gagne = 0;     // completed + paid → provider_payout (85% of final)
  let verse = 0;     // payout_status=sent
  let enAttente = 0; // confirmed/accepted, not yet paid (full expected amount)

  for (const b of rich) {
    // Effective payout: stored provider_payout, else 85% of final_amount or amount_xof
    const base = b.final_amount ?? b.amount_xof ?? (typeof b.price === "number" ? b.price : 0);
    const effPayout = b.provider_payout != null ? b.provider_payout : Math.round(base * 0.85);
    if (!base) continue;

    if (b.status === "completed" && b.payment_status === "paid") {
      gagne += effPayout;
    }
    if (b.payout_status === "sent") {
      verse += effPayout;
    }
    if (["confirmed", "accepted", "assigned"].includes(b.status as string) && b.payment_status !== "paid") {
      enAttente += base; // full amount — payment not collected yet
    }
  }

  return { gagne, verse, enAttente, prochainVersement: enAttente };
}

function formatFCFA(amount: number) {
  return new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 0 }).format(amount) + " FCFA";
}

// localStorage keys for filter and booking cache persistence
const STORAGE_KEYS = {
  FILTERS: "provider_dashboard_filters",
  STATS_VISIBLE: "provider_dashboard_stats_visible",
  BOOKINGS: "provider_cached_bookings",
  AVAILABILITY: "provider_available_today",
  COACHING_DISMISSED: "provider_coaching_dismissed",
  WELCOME_DISMISSED: "provider_welcome_dismissed",
};

// Check if viewport is mobile width
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

export default function ProviderDashboard() {
  const t = useTranslations("providerDashboard");
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableToday, setAvailableToday] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [coachingDismissed, setCoachingDismissed] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [coachingShowAll, setCoachingShowAll] = useState(false);
  const [showFloatingWa, setShowFloatingWa] = useState(false);

  // Stats visibility: default true (expanded); hydrated from localStorage on mount
  const [showStats, setShowStats] = useState(true);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  // todo: replace with useProviderBookings() hook when auth context provides providerId
  const [bookings, setBookings] = useState<ProviderBooking[]>([]);

  const [providerInfo, setProviderInfo] = useState<{ id: string | null; verificationStatus: string; rejectionReason: string }>({ id: null, verificationStatus: '', rejectionReason: '' });
  const [avgRating, setAvgRating]       = useState<number | null>(null);
  const [ratingCount, setRatingCount]   = useState<number>(0);

  // Hydrate state from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const info = JSON.parse(localStorage.getItem('provider_info') || 'null');
      if (info) {
        setProviderInfo({
          id: String(info.provider_id ?? info.id ?? ''),
          verificationStatus: info.verification_status ?? '',
          rejectionReason: info.rejection_reason ?? '',
        });
      }
      const savedStats = localStorage.getItem(STORAGE_KEYS.STATS_VISIBLE);
      if (savedStats !== null) {
        setShowStats(JSON.parse(savedStats));
      } else {
        setShowStats(!isMobileViewport());
      }
      const savedFilters = localStorage.getItem(STORAGE_KEYS.FILTERS);
      if (savedFilters) setFilters(JSON.parse(savedFilters));
      const savedAvailability = localStorage.getItem(STORAGE_KEYS.AVAILABILITY);
      if (savedAvailability !== null) setAvailableToday(JSON.parse(savedAvailability));
      if (localStorage.getItem(STORAGE_KEYS.COACHING_DISMISSED) === "1") setCoachingDismissed(true);
      if (localStorage.getItem(STORAGE_KEYS.WELCOME_DISMISSED) === "1") setWelcomeDismissed(true);
      if (info) {
        setProviderName(info.name ?? info.full_name ?? info.company_name ?? "");
      }
      const savedGuide = localStorage.getItem("provider_guide_open");
      if (savedGuide !== null) setGuideOpen(JSON.parse(savedGuide));
    } catch {
      // keep defaults
    }
  }, []);

  // Persist stats visibility to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATS_VISIBLE, JSON.stringify(showStats));
  }, [showStats]);

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
  }, [filters]);

  // Floating WA button: show after scrolling ~400px on mobile
  useEffect(() => {
    const onScroll = () => setShowFloatingWa(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fetch bookings from real API — auto-redirect to login if no token
  useEffect(() => {
    const token = localStorage.getItem("provider_token");
    if (!token) {
      setHasToken(false);
      setIsLoading(false);
      router.replace(`/${locale}/provider/login`);
      return;
    }
    setHasToken(true);

    // Load localStorage cache immediately so the UI isn't blank while fetching
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS) || "null");
      if (Array.isArray(cached) && cached.length > 0) {
        setBookings(cached);
        setIsLoading(false); // show cached data right away
      }
    } catch { /* ignore */ }

    let providerId: string | null = null;
    try {
      const info = JSON.parse(localStorage.getItem("provider_info") || "null");
      providerId = info?.provider_id ?? info?.id ?? null;
    } catch { /* ignore */ }

    const url = `${FLASK_API}/api/provider/bookings${providerId ? `?provider_id=${providerId}` : ""}`;
    // Fetch profile for avg_rating
    fetch(`${FLASK_API}/api/provider/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.avg_rating != null) setAvgRating(data.avg_rating);
        if (data?.review_count != null) setRatingCount(data.review_count);
      })
      .catch(() => {});

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("provider_token");
          localStorage.removeItem("provider_info");
          setHasToken(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped = data.map((b) => ({
            ...b,
            id: String(b.id),
            location: b.location ?? b.client_location ?? undefined,
          }));
          setBookings(mapped);
          localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(mapped));
        }
      })
      .catch(() => {
        // Network/server error — if we have cached data already shown, warn the user
        const hasCached = (() => {
          try { return Array.isArray(JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS) || "null")); } catch { return false; }
        })();
        if (hasCached) {
          toast({
            title: locale === "fr" ? "Données non actualisées" : "Stale data",
            description: locale === "fr"
              ? "Impossible de rafraîchir les réservations. Les données affichées peuvent ne pas être à jour."
              : "Could not refresh bookings. Displayed data may be out of date.",
            variant: "destructive",
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Availability toggle
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
    } catch {
      // silently ignore network errors — localStorage is source of truth for now
    } finally {
      setAvailabilityLoading(false);
    }
  };

  // Filter handlers
  const handleStatusFilter = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleServiceFilter = (value: string) => {
    setFilters((prev) => ({ ...prev, service: value }));
  };

  const handleDateRangeFilter = (range: DateRange) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: range,
      date: range.startDate || range.endDate ? "all" : prev.date,
    }));
  };

  const clearAllFilters = () => {
    setFilters(defaultFilters);
    setSearchQuery("");
  };

  // Derive unique service names from fetched bookings for the filter dropdown
  const serviceNames = [...new Set(bookings.map((b) => b.serviceName).filter(Boolean))].sort();

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.date !== "all" ||
    filters.service !== "all" ||
    filters.dateRange.startDate !== null ||
    filters.dateRange.endDate !== null ||
    searchQuery.trim() !== "";

  // Get conflict info for a booking
  const getBookingConflict = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return null;

    const conflict = checkScheduleConflicts(
      { date: booking.date, time: booking.time, duration: booking.duration },
      bookings.filter((b) => b.status === "confirmed"),
      bookingId
    );

    return conflict.hasConflict ? formatConflictWarning(conflict.conflictingBookings) : null;
  };

  // Booking action handlers
  const handleAcceptBooking = async (bookingId: string): Promise<void> => {
    const booking = bookings.find((b) => b.id === bookingId);

    if (booking) {
      const conflict = checkScheduleConflicts(
        { date: booking.date, time: booking.time, duration: booking.duration },
        bookings.filter((b) => b.status === "confirmed"),
        bookingId
      );
      if (conflict.hasConflict) {
        const warning = formatConflictWarning(conflict.conflictingBookings);
        toast({
          title: t("conflictWarningTitle"),
          description: t("conflictWarningAcceptDesc", { warning }),
          variant: "destructive",
        });
      }
    }

    const token = localStorage.getItem("provider_token");
    const res = await fetch(`${FLASK_API}/api/provider/bookings/${bookingId}/accept`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      toast({
        title: t("failedAcceptTitle"),
        description: t("failedAcceptDesc"),
        variant: "destructive",
      });
      throw new Error("Accept failed");
    }

    // Remove from pending list immediately — moves to confirmed in full list
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, status: "confirmed" as ProviderBookingStatus } : b
      )
    );

    toast({
      title: t("acceptedTitle"),
      description: booking
        ? t("acceptedDesc", { customerName: booking.customerName, serviceName: booking.serviceName })
        : t("acceptedFallback"),
      variant: "success",
    });
  };

  const handleRejectBooking = async (bookingId: string, reason?: string): Promise<void> => {
    const booking = bookings.find((b) => b.id === bookingId);

    const token = localStorage.getItem("provider_token");
    const res = await fetch(`${FLASK_API}/api/provider/bookings/${bookingId}/decline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason ?? "" }),
    });

    if (!res.ok) {
      toast({
        title: t("failedRejectTitle"),
        description: t("failedRejectDesc"),
        variant: "destructive",
      });
      throw new Error("Decline failed");
    }

    // Remove from pending list immediately
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, status: "cancelled" as ProviderBookingStatus } : b
      )
    );

    toast({
      title: t("rejectedTitle"),
      description: booking
        ? t("rejectedDesc", { customerName: booking.customerName })
        : t("rejectedFallback"),
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
    setBookings((prev) =>
      prev.map((b) => b.id === bookingId ? { ...b, status: "in_progress" as ProviderBookingStatus } : b)
    );
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
    setBookings((prev) =>
      prev.map((b) => b.id === bookingId ? { ...b, status: "completed" as ProviderBookingStatus } : b)
    );
    toast({ title: "Mission terminée !", description: "Bravo ! La réservation est marquée comme terminée.", variant: "success" });
  };

  const handleRescheduleBooking = async (
    bookingId: string,
    newDate: string,
    newTime: string
  ): Promise<void> => {
    const booking = bookings.find((b) => b.id === bookingId);

    let hasConflict = false;
    if (booking) {
      const conflict = checkScheduleConflicts(
        { date: newDate, time: newTime, duration: booking.duration },
        bookings.filter((b) => b.status === "confirmed"),
        bookingId
      );

      if (conflict.hasConflict) {
        hasConflict = true;
        const warning = formatConflictWarning(conflict.conflictingBookings);
        toast({
          title: t("conflictWarningTitle"),
          description: t("conflictRescheduleDesc", { warning }),
          variant: "destructive",
        });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const shouldFail = Math.random() < 0.05;
    if (shouldFail) {
      toast({
        title: t("failedRescheduleTitle"),
        description: t("failedRescheduleDesc"),
        variant: "destructive",
      });
      throw new Error("Reschedule failed");
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, date: newDate, time: newTime } : b
      )
    );

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

  // Filter bookings
  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      (booking.customerName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booking.serviceName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booking.customerEmail ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    // "pending" filter tab shows both pending and requested bookings
    const matchesStatus =
      filters.status === "all" ||
      booking.status === filters.status ||
      (filters.status === "pending" && booking.status === "requested");

    let matchesDateRange = true;
    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      const bookingDate = new Date(booking.date);
      if (filters.dateRange.startDate) {
        const startDate = new Date(filters.dateRange.startDate);
        if (bookingDate < startDate) matchesDateRange = false;
      }
      if (filters.dateRange.endDate) {
        const endDate = new Date(filters.dateRange.endDate);
        if (bookingDate > endDate) matchesDateRange = false;
      }
    }

    const matchesDate =
      filters.date === "all" || booking.date === filters.date;

    const matchesService =
      filters.service === "all" || booking.serviceName === filters.service;

    return matchesSearch && matchesStatus && matchesDate && matchesDateRange && matchesService;
  });

  // Status counts — "pending" bucket includes "requested" (both are new requests)
  const statusCounts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === "pending" || b.status === "requested").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  // WhatsApp config — used by inline section and floating button
  const waNumber = process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "";
  const waMsg = encodeURIComponent("Bonjour Shizu, j'ai besoin d'aide avec mon compte prestataire.");
  const waHref = waNumber
    ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${waMsg}`
    : `whatsapp://send?text=${waMsg}`;

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

  // FIX 4A — show login prompt as a clean full-page state, not buried at the bottom
  if (!hasToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <CalendarDays className="mb-4 h-14 w-14 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">
          {locale === "fr" ? "Connectez-vous" : "Log in to continue"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          {locale === "fr"
            ? "Connectez-vous pour voir vos réservations et gérer votre activité."
            : "Log in to view your booking requests and manage your dashboard."}
        </p>
        <Button
          className="mt-6"
          onClick={() => router.push(`/${locale}/provider/login`)}
        >
          {locale === "fr" ? "Se connecter" : "Log In"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-40 bg-background border-b px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground" data-testid="text-header">
                {t("title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStats(!showStats)}
                data-testid="button-toggle-stats"
              >
                {showStats ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    {t("hideStats")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    {t("showStats")}
                  </>
                )}
              </Button>
              {providerInfo.verificationStatus === 'approved' && providerInfo.id && (
                <Button
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50"
                  onClick={() => window.open(`/${locale}/provider/${providerInfo.id}`, '_blank')}
                  data-testid="button-share-profile"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {locale === 'fr' ? 'Partager mon profil' : 'Share my profile'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push(`/${locale}/provider/profile`)}
                data-testid="button-view-my-profile"
              >
                <User className="mr-2 h-4 w-4" />
                {t("myProfile")}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={filters.status} onValueChange={handleStatusFilter}>
                <SelectTrigger
                  className="w-[160px]"
                  data-testid="select-status-filter"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("allStatus", { count: statusCounts.all })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatus", { count: statusCounts.all })}</SelectItem>
                  <SelectItem value="pending">{t("statusPending", { count: statusCounts.pending })}</SelectItem>
                  <SelectItem value="confirmed">{t("statusConfirmed", { count: statusCounts.confirmed })}</SelectItem>
                  <SelectItem value="completed">{t("statusCompleted", { count: statusCounts.completed })}</SelectItem>
                  <SelectItem value="cancelled">{t("statusCancelled", { count: statusCounts.cancelled })}</SelectItem>
                </SelectContent>
              </Select>

              <DateRangeFilter
                value={filters.dateRange}
                onChange={handleDateRangeFilter}
              />

              <Select value={filters.service} onValueChange={handleServiceFilter}>
                <SelectTrigger
                  className="w-[180px]"
                  data-testid="select-service-filter"
                >
                  <SelectValue placeholder={t("allServices")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allServices")}</SelectItem>
                  {serviceNames.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  data-testid="button-clear-filters"
                >
                  <X className="mr-1 h-4 w-4" />
                  {t("clear")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {/* ── Status banner ─────────────────────────────────────────────────── */}
        {hasToken ? (() => {
          const vs = providerInfo.verificationStatus;
          const pid = providerInfo.id;

          if (vs === 'approved') return (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-green-200 bg-[#f0fdf4] px-4 py-3">
              <p className="text-sm font-semibold text-green-800 line-clamp-2">Profil approuvé ✓ · Visible aux clients</p>
              {pid ? (
                <button
                  onClick={() => window.open(`/${locale}/provider/${pid}`, '_blank')}
                  className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Partager mon profil
                </button>
              ) : null}
            </div>
          );

          if (vs === 'submitted') return (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
              <span className="text-base leading-none">⏳</span>
              <p className="text-sm font-medium text-amber-800">En cours de vérification — Nous vous contacterons sous 48h</p>
            </div>
          );

          if (vs === 'rejected') return (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3">
              <p className="text-sm font-medium text-red-800">
                Profil refusé{providerInfo.rejectionReason ? ` · ${providerInfo.rejectionReason}` : ''}
              </p>
              <button
                onClick={() => router.push(`/${locale}/provider/profile`)}
                className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 whitespace-nowrap"
              >
                Modifier mon profil
              </button>
            </div>
          );

          if (vs === 'draft') return (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3">
              <p className="text-sm font-medium text-blue-800">Complétez votre profil pour recevoir des demandes</p>
              <button
                onClick={() => router.push(`/${locale}/provider/profile`)}
                className="shrink-0 text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 whitespace-nowrap"
              >
                Compléter maintenant
              </button>
            </div>
          );

          return null;
        })() : null}

        {/* 1.5 — Welcome banner (approved + 0 completed missions + not dismissed) */}
        {!welcomeDismissed && providerInfo.verificationStatus === 'approved' && statusCounts.completed === 0 && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-[#f0fdf4] px-5 py-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-sm font-semibold text-green-800">
                🎉 Bienvenue{providerName ? ` ${providerName.split(" ")[0]}` : ""} ! Voici comment démarrer :
              </p>
              <button
                onClick={() => { setWelcomeDismissed(true); localStorage.setItem(STORAGE_KEYS.WELCOME_DISMISSED, "1"); }}
                aria-label="Fermer"
                className="text-green-400 hover:text-green-700 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => document.getElementById("availability-toggle")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
              >
                <Zap className="h-3 w-3" />
                1. Activez votre disponibilité →
              </button>
              <button
                onClick={() => providerInfo.id && window.open(`/${locale}/provider/${providerInfo.id}`, "_blank")}
                className="flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
              >
                <Share2 className="h-3 w-3" />
                2. Partagez votre profil →
              </button>
              <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-100/60 px-3 py-1.5 text-xs font-medium text-green-600">
                <Bell className="h-3 w-3" />
                3. Attendez vos premières demandes ✓
              </span>
            </div>
          </div>
        )}

        {/* 2 — Profile completion tip */}
        {hasToken && statusCounts.completed < 3 && !isLoading && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-lg leading-none mt-0.5">💡</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">
                {locale === 'fr' ? 'Complétez votre profil pour attirer plus de clients' : 'Complete your profile to attract more clients'}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {locale === 'fr' ? "Ajoutez une présentation et améliorez-la avec l'IA pour vous démarquer." : 'Add a bio and improve it with AI to stand out.'}
              </p>
            </div>
            <button
              onClick={() => router.push(`/${locale}/provider/profile`)}
              className="shrink-0 text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              {locale === 'fr' ? 'Mon profil →' : 'My profile →'}
            </button>
          </div>
        )}

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
                {locale === "fr" ? "Disponible aujourd'hui" : "Available today"}
              </p>
              <p className={`text-xs mt-0.5 ${availableToday ? "text-green-600" : "text-gray-400"}`}>
                {availableToday
                  ? (locale === "fr" ? "Vous apparaissez comme disponible aux clients" : "You appear as available to clients")
                  : (locale === "fr" ? "Vous n'acceptez pas de nouvelles demandes" : "You are not accepting new requests")}
              </p>
            </div>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={availabilityLoading}
            aria-label={locale === "fr" ? "Basculer la disponibilité" : "Toggle availability"}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${availableToday ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${availableToday ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* 3.5 — Coaching card */}
        {!coachingDismissed && (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-500 shrink-0" />
                <p className="font-semibold text-sm text-blue-900">
                  {locale === "fr" ? "Comment obtenir plus de demandes ?" : "How to get more requests?"}
                </p>
              </div>
              <button
                onClick={() => { setCoachingDismissed(true); localStorage.setItem(STORAGE_KEYS.COACHING_DISMISSED, "1"); }}
                aria-label="Fermer"
                className="text-blue-300 hover:text-blue-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {/* Tip 1 */}
              <div className="flex items-center gap-3 min-h-[44px]">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${availableToday ? "bg-green-100" : "bg-blue-100"}`}>
                  <Zap className={`h-4 w-4 ${availableToday ? "text-green-600" : "text-blue-600"}`} />
                </div>
                <p className="flex-1 text-sm text-foreground">
                  {locale === "fr" ? "Activez votre disponibilité" : "Enable your availability"}
                </p>
                {availableToday ? (
                  <span className="text-xs text-green-600 font-semibold shrink-0">✓ {locale === "fr" ? "Actif" : "Active"}</span>
                ) : (
                  <button
                    onClick={toggleAvailability}
                    disabled={availabilityLoading}
                    className="shrink-0 min-h-[44px] px-2 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {locale === "fr" ? "Activer →" : "Enable →"}
                  </button>
                )}
              </div>
              {/* Tip 2 */}
              <div className="flex items-center gap-3 min-h-[44px]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <p className="flex-1 text-sm text-foreground">
                  {locale === "fr" ? "Complétez votre profil" : "Complete your profile"}
                </p>
                <button
                  onClick={() => router.push(`/${locale}/provider/profile`)}
                  className="shrink-0 min-h-[44px] px-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  {locale === "fr" ? "Voir →" : "View →"}
                </button>
              </div>
              {/* Tip 3 — hidden on mobile behind "Voir plus" */}
              <div className={`flex items-center gap-3 min-h-[44px] ${coachingShowAll ? "" : "hidden sm:flex"}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <Bell className="h-4 w-4 text-blue-600" />
                </div>
                <p className="flex-1 text-sm text-foreground">
                  {locale === "fr" ? "Répondez rapidement aux demandes" : "Respond quickly to requests"}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">&lt; 2h</span>
              </div>
              {/* "Voir plus" — mobile only, shows tip 3 */}
              {!coachingShowAll && (
                <button
                  type="button"
                  onClick={() => setCoachingShowAll(true)}
                  className="sm:hidden text-xs text-blue-500 hover:text-blue-700 font-medium"
                >
                  {locale === "fr" ? "Voir plus →" : "Show more →"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3.6 — Collapsible guide card */}
        <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              const next = !guideOpen;
              setGuideOpen(next);
              localStorage.setItem("provider_guide_open", JSON.stringify(next));
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-blue-900 hover:bg-blue-100/60 transition-colors"
          >
            <span>💡 {locale === "fr" ? "Comment utiliser votre tableau de bord ?" : "How to use your dashboard?"}</span>
            <ChevronDown className={`h-4 w-4 text-blue-400 transition-transform duration-200 ${guideOpen ? "rotate-180" : ""}`} />
          </button>
          {guideOpen && (
            <div className="px-4 pb-4 space-y-2 border-t border-blue-100 pt-3">
              {[
                { icon: "⚡", text: locale === "fr" ? "Disponibilité — Activez-la pour recevoir des demandes" : "Availability — Enable it to receive requests" },
                { icon: "🔔", text: locale === "fr" ? "Nouvelles demandes — Acceptez ou déclinez chaque mission" : "New requests — Accept or decline each mission" },
                { icon: "📅", text: locale === "fr" ? "Planning — Vos missions confirmées à venir" : "Schedule — Your upcoming confirmed missions" },
                { icon: "💰", text: locale === "fr" ? "Revenus — Vos gains en temps réel" : "Earnings — Your real-time income" },
                { icon: "🌟", text: locale === "fr" ? "Performances — Votre note et statistiques" : "Performance — Your rating and stats" },
                { icon: "📤", text: locale === "fr" ? "Partager — Envoyez votre fiche à vos contacts" : "Share — Send your profile to your contacts" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="shrink-0 leading-5">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4 — Earnings module */}
        {(() => {
          const { gagne, enAttente, verse, prochainVersement } = computeEarnings(bookings ?? []);
          const isFr = locale === "fr";
          const cards = [
            { label: isFr ? "Gagné"              : "Earned",        value: gagne,             sub: isFr ? "réservations terminées"       : "completed bookings",       textColor: "text-green-700", bg: "bg-green-50",  border: "border-green-100" },
            { label: isFr ? "En attente"         : "Pending",       value: enAttente,         sub: isFr ? "confirmé, paiement en cours"  : "confirmed, awaiting payout", textColor: "text-amber-700", bg: "bg-amber-50",  border: "border-amber-100" },
            { label: isFr ? "Versé"              : "Paid out",      value: verse,             sub: isFr ? "déjà reversé"                 : "already disbursed",          textColor: "text-blue-700",  bg: "bg-blue-50",   border: "border-blue-100"  },
            { label: isFr ? "Prochain versement" : "Next payout",   value: prochainVersement, sub: isFr ? "estimation prochaine"         : "upcoming estimate",          textColor: "text-gray-700",  bg: "bg-white",     border: "border-gray-100"  },
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
        })() ?? null}

        {/* 5 — WhatsApp support (desktop inline card only) */}
        <div className="hidden sm:flex mb-6 items-center justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <div>
            <p className="font-semibold text-sm text-green-800">{locale === "fr" ? "Besoin d'aide ?" : "Need help?"}</p>
            <p className="text-xs text-green-600 mt-0.5">{locale === "fr" ? "Notre équipe répond en moins de 24h." : "Our team replies within 24h."}</p>
          </div>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5c] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {locale === "fr" ? "Contacter le support" : "Contact support"}
          </a>
        </div>

        {/* 6 — Nouvelles demandes */}
        {(() => {
          const pending = (bookings ?? []).filter((b) => b.status === "pending" || b.status === "requested");
          return (
            <div className="mb-6" data-testid="section-new-requests">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-5 w-5 text-amber-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {locale === "fr" ? "Nouvelles demandes" : "New Requests"}
                </h2>
                {pending.length > 0 && <Badge variant="destructive" className="text-xs">{pending.length}</Badge>}
              </div>
              {pending.length === 0 ? (
                <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-8 text-center">
                  <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">
                    {locale === "fr" ? "Pas encore de demandes" : "No requests yet"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    {locale === "fr"
                      ? "Activez votre disponibilité pour commencer à recevoir des clients"
                      : "Enable your availability to start receiving clients"}
                  </p>
                  {!availableToday ? (
                    <button
                      onClick={toggleAvailability}
                      disabled={availabilityLoading}
                      className="mt-4 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Zap className="h-4 w-4" />
                      {locale === "fr" ? "Activer maintenant" : "Enable now"}
                    </button>
                  ) : (
                    <p className="mt-3 text-xs text-green-600 font-medium">
                      ✓ {locale === "fr" ? "Vous êtes disponible — en attente de demandes" : "You're available — waiting for requests"}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pending.map((booking) => (
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
        })() ?? null}

        {/* 7 — Planning à venir */}
        <div className="mb-6">
          <UpcomingSchedule bookings={bookings} />
        </div>

        {/* 8 — Performances */}
        {(() => {
          const totalWithOutcome = statusCounts.confirmed + statusCounts.completed + statusCounts.cancelled;
          const accepted = statusCounts.confirmed + statusCounts.completed;
          const acceptRate = totalWithOutcome > 0 ? Math.round((accepted / totalWithOutcome) * 100) : null;
          const perfItems = [
            { label: "Note moyenne", value: avgRating !== null ? String(avgRating.toFixed(1)) : "—", sub: ratingCount > 0 ? `${ratingCount} avis` : "Pas encore d'avis" },
            { label: "Missions terminées", value: String(statusCounts.completed), sub: "au total" },
            { label: "Taux d'acceptation", value: acceptRate !== null ? `${acceptRate}%` : "—", sub: totalWithOutcome > 0 ? `${accepted}/${totalWithOutcome} demandes` : "Pas encore de données" },
            { label: "Délai de réponse", value: "< 2h", sub: "estimation" },
          ];
          return (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Performances</h2>
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
        })() ?? null}

        {/* 9 — Récompenses */}
        <div className="mb-6">
          <AchievementBadges bookings={bookings} />
        </div>

        {/* 10 — Booking list */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-4 border-b border-border/50 md:relative md:mx-0 md:px-0 md:py-0 md:mb-4 md:border-b-0 md:bg-transparent md:backdrop-blur-none">
          <StatusTabs value={filters.status} onChange={handleStatusFilter} counts={statusCounts} />
        </div>

        {filteredBookings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="bookings-grid">
            {filteredBookings.map((booking) => (
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
        ) : (
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
        )}
      </main>

      {/* Floating WhatsApp button — mobile only, appears after scrolling */}
      {showFloatingWa && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={locale === "fr" ? "Contacter le support WhatsApp" : "WhatsApp support"}
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
