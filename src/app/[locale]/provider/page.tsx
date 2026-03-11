"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import ProviderBookingCard from "@/components/ProviderBookingCard";
import dynamic from "next/dynamic";
const RevenueBreakdown = dynamic(() => import("@/components/RevenueBreakdown"), { ssr: false });
import AchievementBadges from "@/components/AchievementBadges";
import DateRangeFilter, { type DateRange } from "@/components/DateRangeFilter";
import StatusTabs from "@/components/StatusTabs";
import UpcomingSchedule from "@/components/UpcomingSchedule";
import { checkScheduleConflicts, formatConflictWarning } from "@/lib/scheduleConflicts";
import {
  mockProviderBookings,
  providerServiceNames,
  type ProviderBooking,
  type ProviderBookingStatus,
} from "@/data/mockProviderBookings";
import { useTranslations } from "next-intl";

// localStorage keys for filter persistence
const STORAGE_KEYS = {
  FILTERS: "provider_dashboard_filters",
  BOOKINGS: "provider_dashboard_bookings",
  STATS_VISIBLE: "provider_dashboard_stats_visible",
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
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Stats visibility: default collapsed on mobile, expanded on desktop
  const [showStats, setShowStats] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STATS_VISIBLE);
      if (saved !== null) {
        return JSON.parse(saved);
      }
      return !isMobileViewport();
    } catch {
      return !isMobileViewport();
    }
  });

  // Load filters from localStorage
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FILTERS);
      return saved ? JSON.parse(saved) : defaultFilters;
    } catch {
      return defaultFilters;
    }
  });

  // Load bookings from localStorage or use mock data
  // todo: replace with useProviderBookings() hook when auth context provides providerId
  const [bookings, setBookings] = useState<ProviderBooking[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      return saved ? JSON.parse(saved) : mockProviderBookings;
    } catch {
      return mockProviderBookings;
    }
  });

  // Persist stats visibility to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATS_VISIBLE, JSON.stringify(showStats));
  }, [showStats]);

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
  }, [filters]);

  // Persist bookings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  }, [bookings]);

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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

    await new Promise((resolve) => setTimeout(resolve, 500));

    const shouldFail = Math.random() < 0.05;
    if (shouldFail) {
      toast({
        title: t("failedAcceptTitle"),
        description: t("failedAcceptDesc"),
        variant: "destructive",
      });
      throw new Error("Accept failed");
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, status: "confirmed" as ProviderBookingStatus } : b
      )
    );

    const booking2 = bookings.find((b) => b.id === bookingId);
    const hasConflict = booking2 && checkScheduleConflicts(
      { date: booking2.date, time: booking2.time, duration: booking2.duration },
      bookings.filter((b) => b.status === "confirmed"),
      bookingId
    ).hasConflict;

    if (!hasConflict) {
      toast({
        title: t("acceptedTitle"),
        description: booking
          ? t("acceptedDesc", { customerName: booking.customerName, serviceName: booking.serviceName })
          : t("acceptedFallback"),
        variant: "success",
      });
    }
  };

  const handleRejectBooking = async (bookingId: string): Promise<void> => {
    const booking = bookings.find((b) => b.id === bookingId);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const shouldFail = Math.random() < 0.05;
    if (shouldFail) {
      toast({
        title: t("failedRejectTitle"),
        description: t("failedRejectDesc"),
        variant: "destructive",
      });
      throw new Error("Reject failed");
    }

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
      booking.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.customerEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filters.status === "all" || booking.status === filters.status;

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

  // Status counts
  const statusCounts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

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
              <Button
                variant="outline"
                onClick={() => router.push("/provider/profile")}
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
                  {providerServiceNames.map((service) => (
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
        {showStats && (
          <div className="space-y-4 mb-6" data-testid="stats-section">
            <div className="grid gap-4 lg:grid-cols-2">
              <RevenueBreakdown
                bookings={bookings}
                dateRange={filters.dateRange}
                serviceFilter={filters.service}
              />
              <AchievementBadges bookings={bookings} />
            </div>
            <UpcomingSchedule bookings={bookings} />
          </div>
        )}

        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-4 border-b border-border/50 md:relative md:mx-0 md:px-0 md:py-0 md:mb-4 md:border-b-0 md:bg-transparent md:backdrop-blur-none">
          <StatusTabs
            value={filters.status}
            onChange={handleStatusFilter}
            counts={statusCounts}
          />
        </div>

        {filteredBookings.length > 0 ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="bookings-grid"
          >
            {filteredBookings.map((booking) => (
              <ProviderBookingCard
                key={booking.id}
                booking={booking}
                conflictWarning={getBookingConflict(booking.id)}
                onAccept={handleAcceptBooking}
                onReject={handleRejectBooking}
                onReschedule={handleRescheduleBooking}
              />
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-testid="empty-state"
          >
            <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">
              {t("noBookingsTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters ? t("noBookingsWithFilters") : t("noBookingsEmpty")}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={clearAllFilters}
                data-testid="button-clear-filters-empty"
              >
                {t("clearAllFilters")}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
