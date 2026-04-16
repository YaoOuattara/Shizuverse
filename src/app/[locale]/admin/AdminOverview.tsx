"use client";
/**
 * Admin Overview Page
 * 
 * Dashboard with KPIs computed from centralized store.
 * Includes date range filter, recent bookings, and top providers.
 */

import AdminLayout from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Calendar,
  Banknote,
  Users,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Mail,
  Phone,
  Pause,
  Play,
  Loader2,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAdminStats } from "@/hooks/useAdminApi";
import { useAdminStore, type AdminBooking, type AdminProvider, type DateRangeOption, type VerificationStatus } from "@/data/adminStore";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/currency";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const verificationStyles: Record<VerificationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  suspended: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const verificationLabels: Record<VerificationStatus, { fr: string; en: string }> = {
  draft:     { fr: "Brouillon",  en: "Draft"     },
  submitted: { fr: "En attente", en: "Pending"   },
  approved:  { fr: "Approuvé",   en: "Approved"  },
  rejected:  { fr: "Refusé",     en: "Rejected"  },
  suspended: { fr: "Suspendu",   en: "Suspended" },
};

const dateRangeOptionsDef: { value: DateRangeOption; fr: string; en: string }[] = [
  { value: "today", fr: "Aujourd'hui", en: "Today"   },
  { value: "7d",    fr: "7 jours",     en: "7 days"  },
  { value: "30d",   fr: "30 jours",    en: "30 days" },
];

export default function AdminOverview() {
  const { toast } = useToast();
  const params = useParams();
  const isFr = (params?.locale as string) === 'fr';
  const dateRangeOptions = dateRangeOptionsDef.map(o => ({ value: o.value, label: isFr ? o.fr : o.en }));
  const getVerifLabel = (s: VerificationStatus) => verificationLabels[s]?.[isFr ? 'fr' : 'en'] ?? s;
  const {
    dateRange, 
    setDateRange, 
    getKPIs, 
    getFilteredBookings, 
    providers,
    updateBookingStatus,
    updateProviderStatus,
    approveProvider,
    suspendProvider,
    toggleProviderListed,
  } = useAdminStore();
  
  const { stats: liveStats } = useAdminStats();
  const mockKpis = getKPIs();
  const kpis = {
    ...mockKpis,
    totalBookings: liveStats?.total_bookings ?? mockKpis.totalBookings,
    pendingBookings: liveStats?.pending ?? mockKpis.pendingBookings,
    confirmedBookings: liveStats?.confirmed ?? mockKpis.confirmedBookings,
    completedBookings: liveStats?.completed ?? mockKpis.completedBookings,
    cancelledBookings: liveStats?.cancelled ?? mockKpis.cancelledBookings,
    totalProviders: liveStats?.total_providers ?? mockKpis.totalProviders,
  };
  const filteredBookings = getFilteredBookings();
  const recentBookings = filteredBookings.slice(0, 5);
  
  const topProviders = useMemo(() => {
    const providerRevenue = new Map<string, number>();
    filteredBookings
      .filter(b => b.status === 'completed')
      .forEach(b => {
        const current = providerRevenue.get(b.providerId) || 0;
        providerRevenue.set(b.providerId, current + b.price);
      });
    
    return [...providers]
      .map(p => ({
        ...p,
        filteredRevenue: providerRevenue.get(p.id) || 0,
      }))
      .sort((a, b) => b.filteredRevenue - a.filteredRevenue)
      .slice(0, 5);
  }, [providers, filteredBookings]);

  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AdminProvider | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleProviderStatus = async (provider: AdminProvider) => {
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newStatus = provider.status === 'active' ? 'paused' : 'active';
    updateProviderStatus(provider.id, newStatus);
    setSelectedProvider(prev => prev ? { ...prev, status: newStatus } : null);

    toast({
      title: "Status Updated",
      description: `Provider is now ${newStatus}.`,
    });
    setIsUpdating(false);
  };

  const handleApproveProvider = async (providerId: string) => {
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    approveProvider(providerId);
    setSelectedProvider(prev => prev ? { 
      ...prev, 
      verificationStatus: 'approved',
      listed: true,
      reviewedAt: new Date().toISOString().split('T')[0],
    } : null);

    toast({
      title: "Provider Approved",
      description: "Provider has been approved and listed.",
    });
    setIsUpdating(false);
  };

  const handleSuspendProvider = async (providerId: string) => {
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    suspendProvider(providerId);
    setSelectedProvider(prev => prev ? { 
      ...prev, 
      verificationStatus: 'suspended',
      listed: false,
    } : null);

    toast({
      title: "Provider Suspended",
      description: "Provider has been suspended.",
      variant: "destructive",
    });
    setIsUpdating(false);
  };

  const handleToggleListed = async (providerId: string, currentListed: boolean) => {
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    toggleProviderListed(providerId);
    setSelectedProvider(prev => prev ? { ...prev, listed: !currentListed } : null);

    toast({
      title: currentListed ? "Provider Unlisted" : "Provider Listed",
      description: currentListed 
        ? "Provider is now hidden from clients."
        : "Provider is now visible to clients.",
    });
    setIsUpdating(false);
  };

  return (
    <AdminLayout title={isFr ? "Tableau de bord" : "Overview"}>
      {liveStats && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <strong>Live:</strong> {liveStats.total_bookings} {isFr ? "réservations" : "bookings"} · {liveStats.pending} {isFr ? "en attente" : "pending"} · {liveStats.confirmed} {isFr ? "confirmées" : "confirmed"} · {liveStats.completed} {isFr ? "terminées" : "completed"} · {liveStats.total_providers} {isFr ? "prestataires" : "providers"}
        </div>
      )}
      <div className="space-y-6">
        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{isFr ? "Période :" : "Show:"}</span>
          <div className="flex gap-1">
            {dateRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={dateRange === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange(option.value)}
                data-testid={`button-range-${option.value}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4" data-testid="grid-kpis">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Total réservations" : "Total Bookings"}</p>
                  <p className="text-2xl font-bold" data-testid="kpi-total-bookings">{kpis.totalBookings}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "En attente" : "Pending"}</p>
                  <p className="text-2xl font-bold text-amber-600" data-testid="kpi-pending">{kpis.pendingBookings}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Confirmées" : "Confirmed"}</p>
                  <p className="text-2xl font-bold text-blue-600" data-testid="kpi-confirmed">{kpis.confirmedBookings}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Terminées" : "Completed"}</p>
                  <p className="text-2xl font-bold text-emerald-600" data-testid="kpi-completed">{kpis.completedBookings}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Annulées" : "Cancelled"}</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="kpi-cancelled">{kpis.cancelledBookings}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Volume total (GMV)" : "Total GMV"}</p>
                  <p className="text-2xl font-bold" data-testid="kpi-gmv">{formatMoney(kpis.totalGMV)}</p>
                </div>
                <Banknote className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Note moyenne" : "Avg Rating"}</p>
                  <p className="text-2xl font-bold" data-testid="kpi-avg-rating">{kpis.avgRating.toFixed(1)}</p>
                </div>
                <Star className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Prestataires actifs" : "Active Providers"}</p>
                  <p className="text-2xl font-bold" data-testid="kpi-active-providers">
                    {kpis.activeProviders}/{kpis.totalProviders}
                  </p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isFr ? "Prestataires éligibles" : "Eligible Providers"}</p>
                  <p className="text-2xl font-bold text-emerald-600" data-testid="kpi-eligible-providers">
                    {kpis.eligibleProviders}
                  </p>
                  <p className="text-xs text-muted-foreground">{isFr ? "Approuvés + listés" : "Approved + Listed"}</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings & Top Providers */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Bookings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isFr ? "Réservations récentes" : "Recent Bookings"}</CardTitle>
              <CardDescription>{isFr ? "Activité récente" : "Latest booking activity"}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {recentBookings.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  {isFr ? "Aucune réservation sur cette période" : "No bookings found in this period"}
                </div>
              ) : (
                <div className="divide-y" data-testid="list-recent-bookings">
                  {recentBookings.map((booking) => (
                    <button
                      key={booking.id}
                      onClick={() => setSelectedBooking(booking)}
                      className="w-full flex items-center justify-between p-3 hover-elevate text-left"
                      data-testid={`booking-row-${booking.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{booking.clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {booking.serviceName} with {booking.providerName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge className={`text-xs ${statusColors[booking.status]}`}>
                          {booking.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Providers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isFr ? "Top prestataires" : "Top Providers"}</CardTitle>
              <CardDescription>{isFr ? "Par chiffre d'affaires" : "By revenue"}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topProviders.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  {isFr ? "Aucun prestataire trouvé" : "No providers found"}
                </div>
              ) : (
                <div className="divide-y" data-testid="list-top-providers">
                  {topProviders.map((provider, index) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider)}
                      className="w-full flex items-center justify-between p-3 hover-elevate text-left"
                      data-testid={`provider-row-${provider.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{provider.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-500" />
                              {provider.rating}
                            </span>
                            <Badge 
                              className={`text-xs ${provider.status === 'active' 
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {provider.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-sm font-medium text-emerald-600">
                          {formatMoney(provider.filteredRevenue)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking Detail Sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isFr ? "Détail réservation" : "Booking Details"}</SheetTitle>
          </SheetHeader>
          {selectedBooking && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <Badge className={`${statusColors[selectedBooking.status]}`}>
                  {selectedBooking.status}
                </Badge>
                <span className="text-lg font-bold">{formatMoney(selectedBooking.price)}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">{isFr ? "Client" : "Client"}</h4>
                  <p className="font-medium">{selectedBooking.clientName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Mail className="h-4 w-4" />
                    <span>{selectedBooking.clientEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Phone className="h-4 w-4" />
                    <span>{selectedBooking.clientPhone}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">{isFr ? "Service" : "Service"}</h4>
                  <p className="font-medium">{selectedBooking.serviceName}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.serviceCategory}</p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">{isFr ? "Prestataire" : "Provider"}</h4>
                  <p className="font-medium">{selectedBooking.providerName}</p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">{isFr ? "Horaire" : "Schedule"}</h4>
                  <p className="font-medium">{selectedBooking.date}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.time} ({selectedBooking.duration})</p>
                </div>
              </div>

              {/* Actions */}
              {selectedBooking.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateBookingStatus(selectedBooking.id, 'confirmed');
                      setSelectedBooking({ ...selectedBooking, status: 'confirmed' });
                    }}
                    data-testid="button-confirm-booking"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isFr ? "Confirmer" : "Confirm"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      updateBookingStatus(selectedBooking.id, 'cancelled');
                      setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                    }}
                    data-testid="button-cancel-booking"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {isFr ? "Annuler" : "Cancel"}
                  </Button>
                </div>
              )}
              
              {selectedBooking.status === 'confirmed' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateBookingStatus(selectedBooking.id, 'completed');
                      setSelectedBooking({ ...selectedBooking, status: 'completed' });
                    }}
                    data-testid="button-complete-booking"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isFr ? "Marquer terminée" : "Mark Completed"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      updateBookingStatus(selectedBooking.id, 'cancelled');
                      setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                    }}
                    data-testid="button-cancel-confirmed"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {isFr ? "Annuler" : "Cancel"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Provider Detail Sheet */}
      <Sheet open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isFr ? "Détail prestataire" : "Provider Details"}</SheetTitle>
          </SheetHeader>
          {selectedProvider && (
            <div className="space-y-6 mt-6">
              {/* Status Badges */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={verificationStyles[selectedProvider.verificationStatus]}>
                    {getVerifLabel(selectedProvider.verificationStatus)}
                  </Badge>
                  {selectedProvider.verificationStatus === 'approved' && (
                    <Badge 
                      variant="outline"
                      className={selectedProvider.listed 
                        ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                        : "border-muted"
                      }
                    >
                      {selectedProvider.listed ? (
                        <><Eye className="h-3 w-3 mr-1" /> Listed</>
                      ) : (
                        <><EyeOff className="h-3 w-3 mr-1" /> Unlisted</>
                      )}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    className={selectedProvider.status === 'active' 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    }
                  >
                    {selectedProvider.status}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">{selectedProvider.rating || "-"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">{isFr ? "Prestataire" : "Provider"}</h4>
                  <p className="font-medium text-lg">{selectedProvider.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Mail className="h-4 w-4" />
                    <span>{selectedProvider.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Phone className="h-4 w-4" />
                    <span>{selectedProvider.phone}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">{isFr ? "Services" : "Services"}</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedProvider.services.map((service) => (
                      <Badge key={service} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">{isFr ? "Statistiques" : "Stats"}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <p className="text-2xl font-bold">{selectedProvider.completedBookings}</p>
                      <p className="text-xs text-muted-foreground">{isFr ? "Terminées" : "Completed"}</p>
                    </div>
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <p className="text-2xl font-bold text-emerald-600">{formatMoney(selectedProvider.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{isFr ? "Chiffre d'affaires" : "Total Revenue"}</p>
                    </div>
                  </div>
                </div>

                {/* Verification Actions for Submitted Providers */}
                {selectedProvider.verificationStatus === 'submitted' && (
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Examiner la demande" : "Review Application"}</h4>
                    <Button
                      className="w-full"
                      onClick={() => handleApproveProvider(selectedProvider.id)}
                      disabled={isUpdating}
                      data-testid="button-approve-provider"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      )}
                      {isFr ? "Approuver" : "Approve Provider"}
                    </Button>
                  </div>
                )}

                {/* Actions for Approved Providers */}
                {selectedProvider.verificationStatus === 'approved' && (
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Gérer le prestataire" : "Manage Provider"}</h4>
                    
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleToggleListed(selectedProvider.id, selectedProvider.listed)}
                      disabled={isUpdating}
                      data-testid="button-toggle-listed"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : selectedProvider.listed ? (
                        <EyeOff className="h-4 w-4 mr-2" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      {selectedProvider.listed ? (isFr ? "Délister" : "Unlist Provider") : (isFr ? "Lister" : "List Provider")}
                    </Button>

                    <Button
                      variant={selectedProvider.status === "active" ? "outline" : "default"}
                      className="w-full"
                      onClick={() => handleToggleProviderStatus(selectedProvider)}
                      disabled={isUpdating}
                      data-testid="button-toggle-provider-status"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : selectedProvider.status === "active" ? (
                        <Pause className="h-4 w-4 mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {selectedProvider.status === "active" ? (isFr ? "Suspendre l'activité" : "Pause Operations") : (isFr ? "Reprendre l'activité" : "Resume Operations")}
                    </Button>

                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleSuspendProvider(selectedProvider.id)}
                      disabled={isUpdating}
                      data-testid="button-suspend-provider"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 mr-2" />
                      )}
                      Suspend Provider
                    </Button>
                  </div>
                )}

                {/* Actions for Suspended Providers */}
                {selectedProvider.verificationStatus === 'suspended' && (
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Réintégrer" : "Reinstate Provider"}</h4>
                    <Button
                      className="w-full"
                      onClick={() => handleApproveProvider(selectedProvider.id)}
                      disabled={isUpdating}
                      data-testid="button-reinstate-provider"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      )}
                      {isFr ? "Réintégrer" : "Reinstate Provider"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
