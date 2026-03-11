"use client";
/**
 * Admin Bookings Page
 * 
 * List with filters, detail drawer, status timeline, and admin actions.
 * Uses centralized admin store for state management.
 */

import { useState, useMemo } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  StickyNote,
  Loader2,
  MapPin,
  Banknote,
  Building2,
  ArrowRight,
  CalendarClock,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useAdminStore, type AdminBooking, type StatusHistoryEntry } from "@/data/adminStore";
import { useAdminBookings, type ApiBooking } from "@/hooks/useAdminApi";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { formatMoney } from "@/lib/currency";
import { 
  getPricingSuggestion, 
  ZONES_LIST,
  URGENCY_OPTIONS,
  TIME_PREFERENCE_OPTIONS,
  type PricingSuggestion,
  type UrgencyLevel,
  type TimePreference,
} from "@/utils/pricingEngine";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  under_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  assigned: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const formatDate = (iso: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const paymentColors: Record<string, string> = {
  unpaid: "bg-amber-100/50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  pending: "bg-amber-100/50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  paid: "bg-emerald-100/50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
  refunded: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const payoutColors: Record<string, string> = {
  not_due: "bg-gray-100/50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400",
  due: "bg-amber-100/50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  sent: "bg-emerald-100/50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
  failed: "bg-red-100/50 text-red-800 dark:bg-red-900/20 dark:text-red-400",
};

const getPaymentStatusLabels = (isFr: boolean): Record<string, string> => ({
  unpaid:   isFr ? 'Non payé'           : 'Unpaid',
  pending:  isFr ? 'Paiement en attente': 'Payment Pending',
  paid:     isFr ? 'Payé'               : 'Paid',
  refunded: isFr ? 'Remboursé'          : 'Refunded',
});

const getPayoutStatusLabels = (isFr: boolean): Record<string, string> => ({
  not_due: isFr ? 'Pas encore dû' : 'Not Due',
  due:     isFr ? 'Dû'            : 'Due',
  sent:    isFr ? 'Envoyé'        : 'Sent',
  failed:  isFr ? 'Échoué'        : 'Failed',
});

const statusOptions = ["all", "pending", "under_review", "assigned", "confirmed", "completed", "cancelled"];

const getDefaultTimeline = (isFr: boolean) => [
  { status: 'pending',   label: isFr ? 'En attente' : 'Pending'   },
  { status: 'confirmed', label: isFr ? 'Confirmé'   : 'Confirmed' },
  { status: 'completed', label: isFr ? 'Terminé'    : 'Completed' },
];

const getStatusLabels = (isFr: boolean): Record<string, string> => ({
  pending:      isFr ? 'En attente'        : 'Pending',
  under_review: isFr ? "En cours d'examen" : 'Under Review',
  assigned:     isFr ? 'Prestataire assigné': 'Provider Assigned',
  confirmed:    isFr ? 'Confirmé'           : 'Confirmed',
  completed:    isFr ? 'Terminé'            : 'Completed',
  cancelled:    isFr ? 'Annulé'             : 'Cancelled',
  rescheduled:  isFr ? 'Reprogrammé'        : 'Rescheduled',
});

function StatusTimeline({ currentStatus, statusHistory, createdAt, isFr }: {
  currentStatus: AdminBooking['status'];
  statusHistory?: StatusHistoryEntry[];
  createdAt: string;
  isFr: boolean;
}) {
  const statusLabels = getStatusLabels(isFr);
  const defaultTimeline = getDefaultTimeline(isFr);
  const isCancelled = currentStatus === 'cancelled';

  if (statusHistory && statusHistory.length > 0) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">
          {isFr ? "Suivi du statut" : "Status Timeline"}
        </h4>
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="relative pl-4">
            <div className="absolute -left-[9px] w-4 h-4 rounded-full bg-muted border-2 border-background" />
            <div className="text-sm">
              <span className="font-medium">{isFr ? "Créé" : "Created"}</span>
              <span className="text-xs text-muted-foreground ml-2">{createdAt}</span>
            </div>
          </div>
          {statusHistory.map((entry, index) => {
            const isLatest = index === statusHistory.length - 1;
            const isCancelledEntry = entry.status === 'cancelled';
            return (
              <div key={index} className="relative pl-4">
                <div className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 border-background
                  ${isCancelledEntry ? 'bg-red-500' : isLatest ? 'bg-blue-500' : 'bg-emerald-500'}
                `} />
                <div className="text-sm">
                  <span className="font-medium">{statusLabels[entry.status] || entry.status}</span>
                  {entry.actor && (
                    <Badge variant="outline" className="ml-2 text-xs">{entry.actor}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">
                    {entry.timestamp ? format(parseISO(entry.timestamp), 'MMM d, yyyy HH:mm') : ''}
                  </span>
                  {entry.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  const getStepState = (step: string) => {
    if (isCancelled) {
      return step === 'pending' ? 'completed' : 'cancelled';
    }
    const statusOrder = ['pending', 'confirmed', 'completed'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm text-muted-foreground">
        {isFr ? "Suivi du statut" : "Status Timeline"}
      </h4>
      <div className="flex items-center gap-2">
        {defaultTimeline.map((step, index) => {
          const state = getStepState(step.status);
          return (
            <div key={step.status} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                    ${state === 'completed' ? 'bg-emerald-500 text-white' : ''}
                    ${state === 'current' ? 'bg-blue-500 text-white ring-2 ring-blue-200 dark:ring-blue-800' : ''}
                    ${state === 'upcoming' ? 'bg-muted text-muted-foreground' : ''}
                    ${state === 'cancelled' ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  {state === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className={`text-xs mt-1 ${state === 'current' ? 'font-medium' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              {index < defaultTimeline.length - 1 && (
                <ArrowRight className={`h-4 w-4 ${state === 'completed' ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
              )}
            </div>
          );
        })}
        
        {isCancelled && (
          <>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 text-white">
                <XCircle className="h-4 w-4" />
              </div>
              <span className="text-xs mt-1 font-medium text-red-600 dark:text-red-400">{isFr ? "Annulé" : "Cancelled"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminBookings() {
  const params = useParams();
  const isFr = (params?.locale as string) === "fr";
  const statusLabels = getStatusLabels(isFr);
  const paymentStatusLabels = getPaymentStatusLabels(isFr);
  const payoutStatusLabels = getPayoutStatusLabels(isFr);
  const { toast } = useToast();
  const { bookings: apiBookings, loading: bookingsLoading } = useAdminBookings();
  const { providers, reviews, services } = useAdminStore();
  const bookings = useMemo<AdminBooking[]>(
    () =>
      apiBookings.map((b: ApiBooking): AdminBooking => ({
        id: String(b.id),
        clientName: b.clientName,
        clientEmail: "",
        clientPhone: b.clientPhone,
        providerName: b.providerName || "En attente",
        providerPhone: b.providerPhone || undefined,
        providerId: "",
        serviceName: b.serviceName,
        serviceCategory: b.serviceSlug,
        date: b.date,
        time: "",
        duration: "",
        status: (b.status as AdminBooking["status"]) || "pending",
        price: 0,
        currency: "XOF",
        baseAmount: 0,
        platformFeeAmount: 0,
        providerPayoutAmount: 0,
        paymentStatus: "unpaid",
        payoutStatus: "not_due",
        notes: b.notes,
        createdAt: b.createdAt,
      })),
    [apiBookings]
  );
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Modal states
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  
  // Inline assign state (for under_review rows)
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);
  const [inlineProviderName, setInlineProviderName] = useState("");
  const [inlineProviderPhone, setInlineProviderPhone] = useState("");

  // Quote modal state
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteZone, setQuoteZone] = useState("");
  const [quoteUrgency, setQuoteUrgency] = useState<UrgencyLevel>("normal");
  const [quoteTimePreference, setQuoteTimePreference] = useState<TimePreference>("anytime");
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [pricingSuggestion, setPricingSuggestion] = useState<PricingSuggestion | null>(null);

  const eligibleProviders = useMemo(() => {
    return providers.filter(p => 
      p.verificationStatus === 'approved' && p.listed && p.status === 'active'
    );
  }, [providers]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesSearch =
        searchQuery === "" ||
        booking.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.clientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, statusFilter]);

  const getReviewForBooking = (bookingId: string) => {
    return reviews.find(r => r.bookingId === bookingId);
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: AdminBooking["status"]) => {
    setIsUpdating(true);
    try {
      await adminApi.updateBookingStatus(Number(bookingId), newStatus);
    } catch (err) {
      console.error("Failed to update booking status:", err);
    }

    if (selectedBooking?.id === bookingId) {
      setSelectedBooking(prev => prev ? { ...prev, status: newStatus } : null);
    }

    toast({
      title: isFr ? "Statut mis à jour" : "Status Updated",
      description: isFr
        ? `Réservation → ${statusLabels[newStatus] || newStatus}`
        : `Booking status changed to ${newStatus}.`,
      duration: 3000,
    });
    setIsUpdating(false);
  };

  const handleStatusChange = async (bookingId: string, newStatus: string, extra?: { provider_name?: string; provider_phone?: string }) => {
    try {
      if (newStatus === 'assigned' && extra?.provider_name) {
        await adminApi.assignBooking(Number(bookingId), extra.provider_name, extra.provider_phone || '');
      } else {
        await adminApi.updateBookingStatusPut(Number(bookingId), newStatus);
      }
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(prev => prev ? {
          ...prev,
          status: newStatus as AdminBooking['status'],
          ...(extra?.provider_name ? { providerName: extra.provider_name, providerPhone: extra.provider_phone } : {}),
        } : null);
      }
      setAssigningBookingId(null);
      setInlineProviderName("");
      setInlineProviderPhone("");
      toast({ title: "Statut mis à jour", description: `Réservation → ${statusLabels[newStatus] || newStatus}` });
    } catch (err) {
      console.error("handleStatusChange error:", err);
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut.", variant: "destructive" });
    }
  };

  const handleCancelWithReason = async () => {
    if (!selectedBooking || !cancelReason.trim()) return;
    
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelectedBooking(prev => prev ? {
      ...prev, 
      status: 'cancelled', 
      cancellationReason: cancelReason,
      cancelledBy: 'admin',
      paymentStatus: 'refunded',
    } : null);

    toast({
      title: isFr ? "Réservation annulée" : "Booking Cancelled",
      description: isFr
        ? "La réservation a été annulée et le remboursement initié."
        : "The booking has been cancelled and refund initiated.",
      variant: "destructive",
    });
    
    setCancelModalOpen(false);
    setCancelReason("");
    setIsUpdating(false);
  };

  const handleReschedule = async () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) return;
    
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelectedBooking(prev => prev ? {
      ...prev, 
      date: rescheduleDate, 
      time: rescheduleTime,
    } : null);

    toast({
      title: isFr ? "Réservation reprogrammée" : "Booking Rescheduled",
      description: isFr
        ? `Réservation déplacée au ${rescheduleDate} à ${rescheduleTime}.`
        : `Booking moved to ${rescheduleDate} at ${rescheduleTime}.`,
    });
    
    setRescheduleModalOpen(false);
    setRescheduleDate("");
    setRescheduleTime("");
    setIsUpdating(false);
  };

  const handleAssignProvider = async () => {
    if (!selectedBooking || !selectedProviderId) return;
    
    const provider = providers.find(p => p.id === selectedProviderId);
    if (!provider) return;
    
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelectedBooking(prev => prev ? {
      ...prev, 
      providerId: selectedProviderId, 
      providerName: provider.name,
    } : null);

    toast({
      title: isFr ? "Prestataire assigné" : "Provider Assigned",
      description: isFr
        ? `${provider.name} a été assigné à cette réservation.`
        : `${provider.name} has been assigned to this booking.`,
    });
    
    setAssignModalOpen(false);
    setSelectedProviderId("");
    setIsUpdating(false);
  };

  const handleAddNote = async () => {
    if (!selectedBooking || !adminNote.trim()) return;
    
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const existingNotes = selectedBooking.adminNotes || "";
    const timestamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const newNote = existingNotes 
      ? `${existingNotes}\n\n[${timestamp}]: ${adminNote}`
      : `[${timestamp}]: ${adminNote}`;

    setSelectedBooking(prev => prev ? { ...prev, adminNotes: newNote } : null);
    setAdminNote("");

    toast({
      title: isFr ? "Note ajoutée" : "Note Added",
      description: isFr ? "La note admin a été enregistrée." : "Admin note has been saved.",
    });
    setIsUpdating(false);
  };

  const handleMarkCompleted = async () => {
    if (!selectedBooking || selectedBooking.status !== 'confirmed') return;
    
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelectedBooking(prev => prev ? {
      ...prev, 
      status: 'completed',
      payoutStatus: 'due',
      payoutDueAt: new Date().toISOString().split('T')[0],
    } : null);

    toast({
      title: isFr ? "Réservation terminée" : "Booking Completed",
      description: isFr
        ? "La réservation est marquée comme terminée. Le paiement du prestataire est dû."
        : "The booking has been marked as completed. Provider payout is now due.",
      duration: 3000,
    });
    setIsUpdating(false);
  };

  const handleMarkPaid = async () => {
    if (!selectedBooking || selectedBooking.status === 'cancelled' || selectedBooking.paymentStatus === 'paid') return;
    if (selectedBooking.status !== 'confirmed' && selectedBooking.status !== 'completed') return;
    
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelectedBooking(prev => prev ? {
      ...prev, 
      paymentStatus: 'paid',
      paidAt: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
    } : null);

    toast({
      title: "Payment Recorded",
      description: `Payment of ${formatMoney(selectedBooking.price, selectedBooking.currency)} has been recorded.`,
      duration: 3000,
    });
    setIsUpdating(false);
  };

  const openCancelModal = () => {
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const openRescheduleModal = () => {
    if (selectedBooking) {
      setRescheduleDate(selectedBooking.date);
      setRescheduleTime(selectedBooking.time);
    }
    setRescheduleModalOpen(true);
  };

  const openAssignModal = () => {
    setSelectedProviderId(selectedBooking?.providerId || "");
    setAssignModalOpen(true);
  };

  const openQuoteModal = () => {
    if (selectedBooking) {
      setQuoteZone(selectedBooking.zone || "");
      setQuoteUrgency(selectedBooking.urgency || "normal");
      setQuoteTimePreference(selectedBooking.timePreference || "anytime");
      setQuotePrice("");
      setQuoteNote("");
      
      const service = services.find(s => s.name === selectedBooking.serviceName);
      if (service) {
        const suggestion = getPricingSuggestion(
          { basePrice: service.basePrice, pricingRules: service.pricingRules },
          { zone: selectedBooking.zone, urgency: selectedBooking.urgency, timePreference: selectedBooking.timePreference }
        );
        setPricingSuggestion(suggestion);
        setQuotePrice(suggestion.suggestedQuote.toString());
      } else {
        setPricingSuggestion(null);
      }
    }
    setQuoteModalOpen(true);
  };

  const handleQuoteInputChange = (field: 'zone' | 'urgency' | 'timePreference', value: string) => {
    const newZone = field === 'zone' ? value : quoteZone;
    const newUrgency = field === 'urgency' ? value as UrgencyLevel : quoteUrgency;
    const newTimePreference = field === 'timePreference' ? value as TimePreference : quoteTimePreference;
    
    if (field === 'zone') setQuoteZone(value);
    if (field === 'urgency') setQuoteUrgency(value as UrgencyLevel);
    if (field === 'timePreference') setQuoteTimePreference(value as TimePreference);
    
    if (selectedBooking) {
      const service = services.find(s => s.name === selectedBooking.serviceName);
      if (service) {
        const suggestion = getPricingSuggestion(
          { basePrice: service.basePrice, pricingRules: service.pricingRules },
          { zone: newZone, urgency: newUrgency, timePreference: newTimePreference }
        );
        setPricingSuggestion(suggestion);
        setQuotePrice(suggestion.suggestedQuote.toString());
      }
    }
  };

  const handleSendQuote = async () => {
    if (!selectedBooking || !quotePrice || Number(quotePrice) <= 0) {
      toast({
        title: "Invalid Quote",
        description: "Please enter a valid price.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelectedBooking(prev => prev ? {
      ...prev, 
      zone: quoteZone,
      urgency: quoteUrgency,
      timePreference: quoteTimePreference,
      quotedPrice: Number(quotePrice),
      quoteNote,
      quoteStatus: 'sent',
      pricingSuggestion: pricingSuggestion || undefined,
    } : null);

    toast({
      title: "Quote Sent",
      description: `Quote of ${formatMoney(Number(quotePrice), 'XOF')} has been sent to the client.`,
    });
    
    setQuoteModalOpen(false);
    setIsUpdating(false);
  };

  return (
    <AdminLayout title="Bookings">
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by client, provider, or service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-bookings"
                />
              </div>
              
              {/* Status Chips */}
              <div className="flex gap-1 flex-wrap">
                {statusOptions.map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    data-testid={`filter-${status}`}
                  >
                    {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Bookings ({filteredBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {bookingsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                <p>{isFr ? "Chargement des réservations…" : "Loading bookings..."}</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{isFr ? "Aucune réservation trouvée" : "No bookings found"}</p>
              </div>
            ) : (
              <div className="divide-y" data-testid="bookings-list">
                {filteredBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="w-full flex flex-col gap-2 p-3 hover-elevate cursor-pointer"
                    data-testid={`booking-row-${booking.id}`}
                  >
                    {/* Main info row — click opens detail drawer */}
                    <div
                      role="button"
                      tabIndex={0}
                      className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 text-left"
                      onClick={() => setSelectedBooking(booking)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedBooking(booking)}
                    >
                      <div>
                        <p className="font-medium text-sm truncate">{booking.clientName}</p>
                        <p className="text-xs text-muted-foreground">{booking.serviceName}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {formatDate(booking.date)} • {formatMoney(booking.price, booking.currency)}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-sm truncate">{booking.providerName}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(booking.price, booking.currency)}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-sm">{formatDate(booking.date)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(booking.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 sm:justify-end flex-wrap">
                        <Badge className={`text-xs ${statusColors[booking.status] || statusColors.pending}`}>
                          {statusLabels[booking.status] || booking.status}
                        </Badge>
                        <Badge className={`text-xs ${paymentColors[booking.paymentStatus]}`}>
                          {paymentStatusLabels[booking.paymentStatus]}
                        </Badge>
                      </div>
                    </div>

                    {/* Inline action buttons — stop propagation so they don't open drawer */}
                    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                      {booking.status === 'pending' && (
                        <button
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                          onClick={() => handleStatusChange(booking.id, 'under_review')}
                        >
                          Examiner
                        </button>
                      )}
                      {booking.status === 'under_review' && (
                        <>
                          {assigningBookingId === booking.id ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              <input
                                className="text-xs border rounded px-2 py-1 w-32"
                                placeholder="Nom prestataire"
                                value={inlineProviderName}
                                onChange={(e) => setInlineProviderName(e.target.value)}
                              />
                              <input
                                className="text-xs border rounded px-2 py-1 w-28"
                                placeholder="Téléphone"
                                value={inlineProviderPhone}
                                onChange={(e) => setInlineProviderPhone(e.target.value)}
                              />
                              <button
                                className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                                disabled={!inlineProviderName.trim()}
                                onClick={() => handleStatusChange(booking.id, 'assigned', { provider_name: inlineProviderName, provider_phone: inlineProviderPhone })}
                              >
                                Assigner
                              </button>
                              <button
                                className="text-xs text-muted-foreground px-2 py-1 rounded border hover:bg-muted"
                                onClick={() => setAssigningBookingId(null)}
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600"
                              onClick={() => { setAssigningBookingId(booking.id); setInlineProviderName(""); setInlineProviderPhone(""); }}
                            >
                              Assigner prestataire
                            </button>
                          )}
                        </>
                      )}
                      {booking.status === 'assigned' && (
                        <button
                          className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                          onClick={() => handleStatusChange(booking.id, 'confirmed')}
                        >
                          Confirmer
                        </button>
                      )}
                      {booking.status === 'confirmed' && (
                        <button
                          className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                          onClick={() => handleStatusChange(booking.id, 'completed')}
                        >
                          Terminé
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking Detail Sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto pb-24">
          <SheetHeader>
            <SheetTitle>{isFr ? "Détails de la réservation" : "Booking Details"}</SheetTitle>
            <SheetDescription>
              ID: {selectedBooking?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedBooking && (
            <div className="space-y-6 mt-6">
              {/* Status Timeline */}
              <StatusTimeline
                currentStatus={selectedBooking.status}
                statusHistory={selectedBooking.statusHistory}
                createdAt={selectedBooking.createdAt}
                isFr={isFr}
              />

              {/* Status & Price */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{isFr ? "Statut\u00a0:" : "Booking:"}</span>
                      <Badge className={`${statusColors[selectedBooking.status]}`}>
                        {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{isFr ? "Paiement\u00a0:" : "Payment:"}</span>
                      <Badge className={`${paymentColors[selectedBooking.paymentStatus]}`}>
                        {paymentStatusLabels[selectedBooking.paymentStatus]}
                      </Badge>
                    </div>
                    {selectedBooking.status === 'completed' && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{isFr ? "Versement\u00a0:" : "Payout:"}</span>
                        <Badge className={`${payoutColors[selectedBooking.payoutStatus]}`}>
                          {payoutStatusLabels[selectedBooking.payoutStatus]}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <span className="text-lg font-bold">{formatMoney(selectedBooking.price, selectedBooking.currency)}</span>
                </div>
                
                {/* Fee Breakdown */}
                <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded-md p-2">
                  <div className="flex justify-between">
                    <span>{isFr ? "Montant de base" : "Base Amount"}</span>
                    <span>{formatMoney(selectedBooking.baseAmount, selectedBooking.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isFr ? "Commission (15%)" : "Platform Fee (15%)"}</span>
                    <span>{formatMoney(selectedBooking.platformFeeAmount, selectedBooking.currency)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-foreground">
                    <span>{isFr ? "Versement prestataire" : "Provider Payout"}</span>
                    <span>{formatMoney(selectedBooking.providerPayoutAmount, selectedBooking.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Client</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.clientEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.clientPhone}</span>
                  </div>
                </div>
              </div>

              {/* Provider Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Provider</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.providerName}</span>
                  </div>
                  {selectedBooking.providerCompany && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedBooking.providerCompany}</span>
                    </div>
                  )}
                  {selectedBooking.providerPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedBooking.providerPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Service</h4>
                <div className="space-y-2">
                  <p className="font-medium">{selectedBooking.serviceName}</p>
                  <Badge variant="outline" className="text-xs">{selectedBooking.serviceCategory}</Badge>
                </div>
              </div>

              {/* Schedule & Location */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Horaire & Lieu" : "Schedule & Location"}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.time} ({selectedBooking.duration})</span>
                  </div>
                  {selectedBooking.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedBooking.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedBooking.notes && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Client Notes</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-md">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Cancellation Info */}
              {selectedBooking.status === 'cancelled' && selectedBooking.cancellationReason && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Cancellation Details
                  </h4>
                  <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md space-y-1">
                    <p className="text-sm">{selectedBooking.cancellationReason}</p>
                    {selectedBooking.cancelledBy && (
                      <p className="text-xs text-muted-foreground">
                        Cancelled by: {selectedBooking.cancelledBy}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Completed - Review */}
              {selectedBooking.status === 'completed' && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Review
                  </h4>
                  {(() => {
                    const review = getReviewForBooking(selectedBooking.id);
                    if (review) {
                      return (
                        <div className="bg-muted/30 p-3 rounded-md space-y-2">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(star => (
                              <span key={star} className={star <= review.rating ? "text-amber-500" : "text-muted-foreground/30"}>
                                {star <= review.rating ? "★" : "☆"}
                              </span>
                            ))}
                            <Badge className={`ml-2 text-xs ${
                              review.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              review.status === 'flagged' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}>
                              {review.status}
                            </Badge>
                          </div>
                          <p className="text-sm">{review.comment}</p>
                        </div>
                      );
                    }
                    return (
                      <p className="text-sm text-muted-foreground italic">No review yet</p>
                    );
                  })()}
                </div>
              )}

              {/* Timestamps */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>{isFr ? "Créé\u00a0:" : "Created:"} {selectedBooking.createdAt}</p>
                {selectedBooking.updatedAt && selectedBooking.updatedAt !== selectedBooking.createdAt && (
                  <p>{isFr ? "Mis à jour\u00a0:" : "Updated:"} {selectedBooking.updatedAt}</p>
                )}
              </div>

              {/* Admin Notes */}
              {selectedBooking.adminNotes && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Notes admin" : "Admin Notes"}</h4>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                    {selectedBooking.adminNotes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground">Actions</h4>
                
                {/* Quote status info for pending bookings */}
                {selectedBooking.status === 'pending' && selectedBooking.quoteStatus !== 'accepted' && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md space-y-1">
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {selectedBooking.quoteStatus === 'sent' 
                        ? 'Quote sent - waiting for client approval before payment can be recorded.'
                        : 'Send a quote to the client. Payment cannot be recorded until quote is accepted.'}
                    </p>
                  </div>
                )}

                {/* Payment Actions - show for unpaid non-cancelled bookings with accepted quote */}
                {selectedBooking.paymentStatus === 'unpaid' && selectedBooking.status !== 'cancelled' && (selectedBooking.quoteStatus === 'accepted' || selectedBooking.status === 'confirmed' || selectedBooking.status === 'completed') && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                      onClick={handleMarkPaid}
                      disabled={isUpdating}
                      data-testid="button-mark-paid"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                      Mark Paid ({formatMoney(selectedBooking.price, selectedBooking.currency)})
                    </Button>
                  </div>
                )}
                
                {/* Pending Actions */}
                {selectedBooking.status === "pending" && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={openQuoteModal}
                      disabled={isUpdating}
                      data-testid="button-send-quote"
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      {selectedBooking.quoteStatus === 'sent'
                        ? (isFr ? 'Modifier le devis' : 'Update Quote')
                        : (isFr ? 'Envoyer un devis' : 'Send Quote')}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={openAssignModal}
                      disabled={isUpdating}
                      data-testid="button-assign-provider"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {selectedBooking.providerId
                        ? (isFr ? 'Réassigner' : 'Reassign Provider')
                        : (isFr ? 'Assigner un prestataire' : 'Assign Provider')}
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => handleUpdateStatus(selectedBooking.id, "confirmed")}
                      disabled={isUpdating || !selectedBooking.providerId}
                      data-testid="button-confirm-booking"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      {isFr ? "Confirmer" : "Confirm Booking"}
                    </Button>
                    {!selectedBooking.providerId && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {isFr ? "Assignez un prestataire avant de confirmer" : "Assign a provider before confirming"}
                      </p>
                    )}
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={openCancelModal}
                      disabled={isUpdating}
                      data-testid="button-cancel-booking"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {isFr ? "Annuler" : "Cancel Booking"}
                    </Button>
                  </div>
                )}

                {/* Confirmed Actions */}
                {selectedBooking.status === "confirmed" && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={openAssignModal}
                      disabled={isUpdating}
                      data-testid="button-reassign-provider"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {isFr ? "Réassigner" : "Reassign Provider"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={openRescheduleModal}
                      disabled={isUpdating}
                      data-testid="button-reschedule"
                    >
                      <CalendarClock className="h-4 w-4 mr-2" />
                      {isFr ? "Reprogrammer" : "Reschedule"}
                    </Button>
                    <Button
                      className="w-full"
                      onClick={handleMarkCompleted}
                      disabled={isUpdating}
                      data-testid="button-complete-booking"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      {isFr ? "Marquer terminé" : "Mark Completed"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={openCancelModal}
                      disabled={isUpdating}
                      data-testid="button-cancel-confirmed"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {isFr ? "Annuler" : "Cancel Booking"}
                    </Button>
                  </div>
                )}

                {/* Completed - Read only */}
                {selectedBooking.status === "completed" && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {isFr ? "Cette réservation est terminée et ne peut plus être modifiée." : "This booking is completed and cannot be modified."}
                  </p>
                )}
                
                {/* Under Review Actions */}
                {selectedBooking.status === "under_review" && (
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <input
                        className="w-full text-sm border rounded px-3 py-2"
                        placeholder="Nom du prestataire"
                        value={inlineProviderName}
                        onChange={(e) => setInlineProviderName(e.target.value)}
                      />
                      <input
                        className="w-full text-sm border rounded px-3 py-2"
                        placeholder="Téléphone prestataire"
                        value={inlineProviderPhone}
                        onChange={(e) => setInlineProviderPhone(e.target.value)}
                      />
                      <Button
                        className="w-full"
                        disabled={!inlineProviderName.trim() || isUpdating}
                        onClick={() => handleStatusChange(selectedBooking.id, 'assigned', { provider_name: inlineProviderName, provider_phone: inlineProviderPhone })}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Assigner le prestataire
                      </Button>
                    </div>
                  </div>
                )}

                {/* Assigned Actions */}
                {selectedBooking.status === "assigned" && (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handleStatusChange(selectedBooking.id, 'confirmed')}
                      disabled={isUpdating}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirmer la réservation
                    </Button>
                  </div>
                )}

                {/* Cancelled - Read only */}
                {selectedBooking.status === "cancelled" && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {isFr ? "Cette réservation est annulée et ne peut plus être modifiée." : "This booking is cancelled and cannot be modified."}
                  </p>
                )}

                {/* Add Note */}
                <div className="space-y-2">
                  <Label htmlFor="admin-note" className="text-sm">{isFr ? "Ajouter une note" : "Add Note"}</Label>
                  <Textarea
                    id="admin-note"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder={isFr ? "Note interne…" : "Add internal note..."}
                    rows={2}
                    data-testid="textarea-admin-note"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!adminNote.trim() || isUpdating}
                    data-testid="button-add-note"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <StickyNote className="h-4 w-4 mr-1" />}
                    {isFr ? "Ajouter" : "Add Note"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Booking Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? "Annuler la réservation" : "Cancel Booking"}</DialogTitle>
            <DialogDescription>
              {isFr
                ? "Veuillez indiquer la raison de l'annulation. Elle sera enregistrée et le client sera notifié."
                : "Please provide a reason for cancellation. This will be recorded and the client will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">{isFr ? "Raison de l'annulation *" : "Cancellation Reason *"}</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={isFr ? "Entrez la raison de l'annulation…" : "Enter reason for cancellation..."}
                rows={3}
                data-testid="textarea-cancel-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              {isFr ? "Retour" : "Back"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelWithReason}
              disabled={!cancelReason.trim() || isUpdating}
              data-testid="button-confirm-cancel"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isFr ? "Annuler la réservation" : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? "Reprogrammer la réservation" : "Reschedule Booking"}</DialogTitle>
            <DialogDescription>
              {isFr ? "Choisissez une nouvelle date et heure." : "Select a new date and time for this booking."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">{isFr ? "Nouvelle date" : "New Date"}</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                data-testid="input-reschedule-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">{isFr ? "Nouvelle heure" : "New Time"}</Label>
              <Input
                id="reschedule-time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                placeholder="e.g., 2:00 PM"
                data-testid="input-reschedule-time"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleDate || !rescheduleTime || isUpdating}
              data-testid="button-confirm-reschedule"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isFr ? "Reprogrammer" : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Provider Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? "Assigner un prestataire" : "Assign Provider"}</DialogTitle>
            <DialogDescription>
              {isFr ? "Sélectionnez un prestataire pour cette réservation." : "Select a provider to assign to this booking."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isFr ? "Choisir un prestataire" : "Select Provider"}</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger data-testid="select-assign-provider">
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} - {provider.services.join(", ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={handleAssignProvider}
              disabled={!selectedProviderId || isUpdating}
              data-testid="button-confirm-assign"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isFr ? "Assigner" : "Assign Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Quote Modal */}
      <Dialog open={quoteModalOpen} onOpenChange={setQuoteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              {isFr ? "Envoyer un devis" : "Send Quote"}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? `Calculez et envoyez un devis au client pour ${selectedBooking?.serviceName}.`
                : `Calculate and send a price quote to the client for ${selectedBooking?.serviceName}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Zone</Label>
                <Select value={quoteZone} onValueChange={(v) => handleQuoteInputChange('zone', v)}>
                  <SelectTrigger data-testid="select-quote-zone">
                    <SelectValue placeholder="Select zone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES_LIST.map((zone) => (
                      <SelectItem key={zone.value} value={zone.value}>
                        {zone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isFr ? "Urgence" : "Urgency"}</Label>
                <Select value={quoteUrgency} onValueChange={(v) => handleQuoteInputChange('urgency', v)}>
                  <SelectTrigger data-testid="select-quote-urgency">
                    <SelectValue placeholder="Normal" />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isFr ? "Préférence horaire" : "Time Pref."}</Label>
                <Select value={quoteTimePreference} onValueChange={(v) => handleQuoteInputChange('timePreference', v)}>
                  <SelectTrigger data-testid="select-quote-time-pref">
                    <SelectValue placeholder="Anytime" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PREFERENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pricingSuggestion && (
              <div className="bg-muted/50 rounded-md p-3 space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  Pricing Breakdown
                </h4>
                <div className="space-y-1 text-xs">
                  {pricingSuggestion.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span>
                        {item.type === 'mult' ? `x${item.value}` : ''}
                        {' '}
                        <span className="font-medium">{formatMoney(item.result, 'XOF')}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Suggested Range</span>
                  <span className="text-sm font-medium">
                    {formatMoney(pricingSuggestion.suggestedMin, 'XOF')} - {formatMoney(pricingSuggestion.suggestedMax, 'XOF')}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quote-price">{isFr ? "Prix du devis (CFA) *" : "Quote Price (CFA) *"}</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="quote-price"
                  type="number"
                  value={quotePrice}
                  onChange={(e) => setQuotePrice(e.target.value)}
                  placeholder="Enter price..."
                  data-testid="input-quote-price"
                />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">CFA</span>
              </div>
              {pricingSuggestion && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuotePrice(pricingSuggestion.suggestedQuote.toString())}
                  data-testid="button-use-suggested"
                >
                  {isFr ? "Utiliser la suggestion\u00a0:" : "Use Suggested:"} {formatMoney(pricingSuggestion.suggestedQuote, 'XOF')}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-note">{isFr ? "Note (optionnel)" : "Note (optional)"}</Label>
              <Textarea
                id="quote-note"
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                placeholder={isFr ? "Ajouter une note pour le client…" : "Add a note for the client..."}
                rows={2}
                data-testid="textarea-quote-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={handleSendQuote}
              disabled={!quotePrice || Number(quotePrice) <= 0 || isUpdating}
              data-testid="button-submit-quote"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
              {isFr ? "Envoyer le devis" : "Send Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
