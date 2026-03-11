"use client";

import { useState, useEffect } from "react";
import BookingCard, { type BookingCardProps, type BookingStatus } from "@/components/BookingCard";
import BookingModal, { type BookingWithNotes, type PreSelectedProvider } from "@/components/BookingModal";
import ProviderProfileModal from "@/components/ProviderProfileModal";
import ReviewModal from "@/components/ReviewModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, CalendarDays, Loader2, X, Plus } from "lucide-react";
import {
  serviceTypes,
  providerNames,
  bookingDates,
} from "@/data/mockBookings";
import {
  mockProviders,
  mockReviews,
  getEligibleProviders,
  type Provider,
  type Review,
} from "@/data/mockProviders";
import { useToast } from "@/hooks/use-toast";
import { useTranslations, useLocale } from "next-intl";
import { trackEvent } from "@/lib/analytics";

// localStorage keys for persistence
const STORAGE_KEYS = {
  BOOKINGS: "dashboard_bookings",
  REVIEWS: "dashboard_reviews",
  REVIEWED_BOOKINGS: "dashboard_reviewed_bookings",
  FILTERS: "dashboard_filters",
} as const;

// Helper to safely parse JSON from localStorage
function getStoredData<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export default function BookingsPage() {
  const t = useTranslations("bookingsPage");
  const locale = useLocale();

  // Load saved filters from localStorage
  const savedFilters = getStoredData(STORAGE_KEYS.FILTERS, {
    statusFilter: "all",
    dateFilter: "all",
    serviceTypeFilter: "all",
    providerFilter: "all",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(savedFilters.statusFilter);
  const [dateFilter, setDateFilter] = useState<string>(savedFilters.dateFilter);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>(savedFilters.serviceTypeFilter);
  const [providerFilter, setProviderFilter] = useState<string>(savedFilters.providerFilter);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<BookingWithNotes | null>(null);

  // Provider profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [providerReviews, setProviderReviews] = useState<Review[]>([]);
  const [preSelectedProvider, setPreSelectedProvider] = useState<PreSelectedProvider | null>(null);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [bookingToReview, setBookingToReview] = useState<BookingCardProps | null>(null);

  // todo: remove mock functionality - replace with API data
  const [reviews, setReviews] = useState<Review[]>(() =>
    getStoredData(STORAGE_KEYS.REVIEWS, mockReviews)
  );
  const [reviewedBookings, setReviewedBookings] = useState<Set<string>>(() =>
    new Set(getStoredData<string[]>(STORAGE_KEYS.REVIEWED_BOOKINGS, []))
  );
  const [providers, setProviders] = useState<Provider[]>(() => getEligibleProviders(mockProviders));

  const { toast } = useToast();

  // todo: remove mock functionality - replace useState with useQuery for real API data
  const [bookings, setBookings] = useState<BookingCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify({
      statusFilter,
      dateFilter,
      serviceTypeFilter,
      providerFilter,
    }));
  }, [statusFilter, dateFilter, serviceTypeFilter, providerFilter]);

  // Persist reviews to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
  }, [reviews]);

  // Persist reviewed bookings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REVIEWED_BOOKINGS, JSON.stringify(Array.from(reviewedBookings)));
  }, [reviewedBookings]);

  const clientPhone = typeof window !== "undefined"
    ? localStorage.getItem("shizu_client_phone")
    : null;

  useEffect(() => {
    const loadBookings = async () => {
      setIsLoading(true);
      try {
        if (clientPhone) {
          const res = await fetch(`/api/bookings?client_phone=${encodeURIComponent(clientPhone)}`);
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            const mapped = data.items.map((b: { id: number; service_name: string; service_slug: string; appointment_date: string; status: BookingStatus; notes?: string; provider_name?: string }) => ({
              id: String(b.id),
              serviceName: b.service_name,
              serviceType: b.service_slug,
              providerName: b.provider_name || (locale === "fr" ? "En attente d'assignation" : "Awaiting assignment"),
              providerId: "pending",
              date: new Date(b.appointment_date).toLocaleDateString(
                locale === "fr" ? "fr-FR" : "en-US",
                { month: "short", day: "numeric", year: "numeric" }
              ),
              time: new Date(b.appointment_date).toLocaleTimeString(
                locale === "fr" ? "fr-FR" : "en-US",
                { hour: "2-digit", minute: "2-digit" }
              ),
              status: b.status,
              notes: b.notes,
            }));
            setBookings(mapped);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to load bookings:", e);
      }
      // No phone or no bookings from API — show empty state
      setBookings(getStoredData<BookingCardProps[]>(STORAGE_KEYS.BOOKINGS, []));
      setIsLoading(false);
    };
    loadBookings();
  }, [clientPhone, locale]);

  // Persist bookings to localStorage
  useEffect(() => {
    if (!isLoading && bookings.length > 0) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    }
  }, [bookings, isLoading]);

  const handleBookingCreated = (newBooking: BookingWithNotes) => {
    setBookings((prev) => [newBooking, ...prev]);
    setPreSelectedProvider(null);
    toast({
      title: t("requestSent"),
      description: t("requestSentDesc"),
      variant: "success",
    });
  };

  const handleEditBooking = (booking: BookingCardProps) => {
    setBookingToEdit(booking as BookingWithNotes);
    setIsEditModalOpen(true);
  };

  const handleBookingUpdated = (updatedBooking: BookingWithNotes) => {
    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === updatedBooking.id ? updatedBooking : booking
      )
    );
    setBookingToEdit(null);
    toast({
      title: t("bookingUpdated"),
      description: t("bookingUpdatedDesc", { service: updatedBooking.serviceName, provider: updatedBooking.providerName }),
      variant: "success",
    });
  };

  // todo: remove mock functionality - replace with API call for cancel
  const handleCancelBooking = async (bookingId: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const bookingToCancel = bookings.find((b) => b.id === bookingId);
    setBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
    toast({
      title: t("bookingCancelled"),
      description: bookingToCancel
        ? t("bookingCancelledDesc", { service: bookingToCancel.serviceName, provider: bookingToCancel.providerName })
        : t("bookingCancelled"),
      variant: "destructive",
    });
  };

  // todo: remove mock functionality - replace with API call for status update
  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus): Promise<void> => {
    const statusLabels: Record<BookingStatus, string> = {
      confirmed: t("confirmed"),
      pending: t("pending"),
      cancelled: t("cancelled"),
      completed: t("completed"),
      under_review: t("under_review"),
      assigned: t("assigned"),
    };

    await new Promise((resolve) => setTimeout(resolve, 600));

    // Mock error scenario: 10% chance of failure for demonstration
    const shouldFail = Math.random() < 0.1;
    if (shouldFail) {
      toast({
        title: t("statusUpdateFailed"),
        description: t("statusUpdateFailedDesc"),
        variant: "destructive",
      });
      throw new Error("Status update failed");
    }

    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId ? { ...booking, status: newStatus } : booking
      )
    );

    toast({
      title: t("statusUpdated", { status: statusLabels[newStatus] }),
      description: t("statusUpdatedDesc"),
      variant: "success",
    });
  };

  // Handle accepting a quote - updates booking to confirmed
  const handleAcceptQuote = async (bookingId: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId
          ? { ...booking, quoteStatus: "accepted" as const, status: "confirmed" as BookingStatus }
          : booking
      )
    );

    toast({
      title: t("quoteAccepted"),
      description: t("quoteAcceptedDesc"),
      variant: "success",
    });
  };

  // Handle declining a quote - cancels the booking request
  const handleDeclineQuote = async (bookingId: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId
          ? { ...booking, quoteStatus: "declined" as const, status: "cancelled" as BookingStatus }
          : booking
      )
    );

    toast({
      title: t("quoteDeclined"),
      description: t("quoteDeclinedDesc"),
      variant: "destructive",
    });
  };

  // todo: remove mock functionality - replace with API call for viewing provider profile
  const handleViewProfile = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider) {
      const providerReviewsList = reviews.filter((r) => r.providerId === provider.id);
      setSelectedProvider(provider);
      setProviderReviews(providerReviewsList);
      setIsProfileModalOpen(true);
    }
  };

  // todo: remove mock functionality - replace with API call for booking from profile
  const handleBookFromProfile = (provider: Provider) => {
    setPreSelectedProvider({
      name: provider.name,
      serviceType: provider.serviceType,
    });
    setIsProfileModalOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenReviewModal = (booking: BookingCardProps) => {
    setBookingToReview(booking);
    setIsReviewModalOpen(true);
  };

  // todo: remove mock functionality - replace with API call for submitting review
  const handleSubmitReview = (
    bookingId: string,
    providerId: string,
    rating: number,
    comment: string
  ) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    const newReview: Review = {
      id: `review-${Date.now()}`,
      providerId: provider.id,
      bookingId,
      reviewerName: "You",
      rating,
      comment: comment || "No comment provided.",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };

    setReviews((prev) => [newReview, ...prev]);
    setReviewedBookings((prev) => new Set(Array.from(prev).concat(bookingId)));

    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === provider.id) {
          const totalRating = p.averageRating * p.totalReviews + rating;
          const newTotalReviews = p.totalReviews + 1;
          return {
            ...p,
            averageRating: Math.round((totalRating / newTotalReviews) * 10) / 10,
            totalReviews: newTotalReviews,
          };
        }
        return p;
      })
    );

    toast({
      title: t("reviewSubmitted"),
      description: t("reviewSubmittedDesc", { name: provider.name }),
      variant: "success",
    });
  };

  const hasBookingBeenReviewed = (bookingId: string): boolean => {
    return reviewedBookings.has(bookingId) || reviews.some((r) => r.bookingId === bookingId);
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      booking.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.providerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || booking.status === statusFilter;
    const matchesDate = dateFilter === "all" || booking.date === dateFilter;
    const matchesServiceType =
      serviceTypeFilter === "all" || booking.serviceType === serviceTypeFilter;
    const matchesProvider =
      providerFilter === "all" || booking.providerName === providerFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDate &&
      matchesServiceType &&
      matchesProvider
    );
  });

  const hasActiveFilters =
    statusFilter !== "all" ||
    dateFilter !== "all" ||
    serviceTypeFilter !== "all" ||
    providerFilter !== "all" ||
    searchQuery !== "";

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
    setServiceTypeFilter("all");
    setProviderFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1
                className="text-2xl font-semibold text-foreground"
                data-testid="text-dashboard-title"
              >
                {t("title")}
              </h1>
            </div>
            <Button
              onClick={() => { setIsCreateModalOpen(true); trackEvent("booking_started"); }}
              data-testid="button-new-booking"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("newBooking")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="gap-1"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4" />
                {t("clearFilters")}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-[140px]"
                data-testid="select-status-filter"
              >
                <SelectValue placeholder={t("statusLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                <SelectItem value="pending">{t("pending")}</SelectItem>
                <SelectItem value="completed">{t("completed")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger
                className="w-[160px]"
                data-testid="select-date-filter"
              >
                <SelectValue placeholder={t("dateLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allDates")}</SelectItem>
                {bookingDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={serviceTypeFilter}
              onValueChange={setServiceTypeFilter}
            >
              <SelectTrigger
                className="w-[150px]"
                data-testid="select-service-type-filter"
              >
                <SelectValue placeholder={t("serviceTypeLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allServices")}</SelectItem>
                {serviceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger
                className="w-[180px]"
                data-testid="select-provider-filter"
              >
                <SelectValue placeholder={t("providerLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allProviders")}</SelectItem>
                {providerNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-testid="loading-state"
          >
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-base font-medium text-muted-foreground">
              {t("loadingBookings")}
            </p>
          </div>
        ) : filteredBookings.length > 0 ? (
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            data-testid="grid-bookings"
          >
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                {...booking}
                onEdit={handleEditBooking}
                onCancel={handleCancelBooking}
                onStatusChange={handleStatusChange}
                onViewProfile={handleViewProfile}
                onLeaveReview={handleOpenReviewModal}
                onAcceptQuote={handleAcceptQuote}
                onDeclineQuote={handleDeclineQuote}
                hasReview={hasBookingBeenReviewed(booking.id)}
              />
            ))}
          </div>
        ) : hasActiveFilters ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-testid="empty-state-filtered"
          >
            <Search className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">
              {t("noResultsTitle")}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("noResultsDesc")}
            </p>
            <Button
              className="mt-4"
              onClick={clearAllFilters}
              data-testid="button-clear-filters-empty"
            >
              {t("clearFilters")}
            </Button>
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
              {t("noBookingsDesc")}
            </p>
            <Button
              className="mt-4"
              onClick={() => { setIsCreateModalOpen(true); trackEvent("booking_started"); }}
              data-testid="button-create-first"
            >
              {t("createFirst")}
            </Button>
          </div>
        )}
      </main>

      <BookingModal
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open) setPreSelectedProvider(null);
        }}
        mode="create"
        onSubmit={handleBookingCreated}
        preSelectedProvider={preSelectedProvider}
      />

      <BookingModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        mode="edit"
        booking={bookingToEdit}
        onSubmit={handleBookingUpdated}
      />

      <ProviderProfileModal
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
        provider={selectedProvider}
        reviews={providerReviews}
        onBookNow={handleBookFromProfile}
      />

      <ReviewModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        booking={bookingToReview}
        onSubmit={handleSubmitReview}
      />
    </div>
  );
}
