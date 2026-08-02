"use client";
/**
 * Admin Payments Page
 * 
 * Finance management with two tabs:
 * 1. Customer Payments - Track incoming payments from clients
 * 2. Provider Payouts - Track outgoing payments to providers
 */

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calendar,
  User,
  Phone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  CreditCard,
  Banknote,
  RefreshCw,
  Building2,
  FileText,
} from "lucide-react";
import { useAdminBookings, useAdminOverview, type ApiBooking } from "@/hooks/useAdminApi";
import { adminApi } from "@/lib/api";
import ErrorBanner from "@/components/ErrorBanner";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { formatMoney } from "@/lib/currency";

// Local type for payment page — maps from ApiBooking
interface PaymentBooking {
  id: string;
  clientName: string;
  clientPhone: string;
  providerName: string;
  providerCompany: string;
  serviceName: string;
  status: string;
  paymentStatus: string;
  payoutStatus: string;
  collectionStatus?: import("@/data/adminStore").CollectionStatus;
  amountCollected?: number;
  amountDue?: number;
  overpaid?: number;
  price: number;
  baseAmount: number;
  platformFeeAmount: number;
  providerPayoutAmount: number;
  amountXof: number | null;
  amountLocked: boolean;
  currency: string;
  date: string;
  time: string;
  paidAt?: string;
  payoutDueAt?: string;
  payoutSentAt?: string;
  paymentMethod?: string;
  payoutMethod?: string;
}

// adminFetch throws `Error("API error <code>: <path> — <body>")` where <body>
// is the raw JSON response. Pull out the backend's { error } message so the UI
// can show the real reason (e.g. the locked-amount motif rule) rather than a
// generic failure.
function extractApiError(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  const sep = msg.indexOf("— ");
  const body = sep >= 0 ? msg.slice(sep + 2).trim() : msg;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    /* not JSON — fall through */
  }
  return null;
}

function toPaymentBooking(b: ApiBooking): PaymentBooking {
  // Use final_amount when available (set after payment confirmed); fall back to amount_xof (quoted price)
  const finalAmt   = b.final_amount   ?? b.amount_xof ?? 0;
  const commission = b.shizu_commission != null ? b.shizu_commission : Math.round(finalAmt * 0.15);
  const payout     = b.provider_payout  != null ? b.provider_payout  : finalAmt - commission;
  const d = b.appointment_date ? new Date(b.appointment_date) : null;
  return {
    id: String(b.id),
    clientName: b.client_name,
    clientPhone: b.client_phone,
    providerName: b.provider_name ?? '',
    providerCompany: b.provider_name ?? '',
    serviceName: b.service_name,
    status: b.status,
    paymentStatus: b.payment_status,
    payoutStatus: b.payout_status,
    collectionStatus: (b.collection_status as import("@/data/adminStore").CollectionStatus | undefined) ?? undefined,
    amountCollected: b.amount_collected ?? undefined,
    amountDue: b.amount_due ?? undefined,
    overpaid: b.overpaid ?? undefined,
    price: finalAmt,
    baseAmount: finalAmt,
    platformFeeAmount: commission,
    providerPayoutAmount: payout,
    amountXof: b.amount_xof ?? null,
    amountLocked: !!b.amount_locked,
    currency: 'XOF',
    date: d ? d.toLocaleDateString('fr-FR') : '',
    time: d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
  };
}

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  open: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  refunded: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const payoutStatusColors: Record<string, string> = {
  not_due: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  due: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const PAYMENT_STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  unpaid:   { fr: 'Non payé',    en: 'Unpaid'     },
  partial:  { fr: 'Partiel',     en: 'Partial'    },
  open:     { fr: 'À encaisser', en: 'To collect' },
  pending:  { fr: 'En attente',  en: 'Pending'    },
  paid:     { fr: 'Payé',        en: 'Paid'       },
  refunded: { fr: 'Remboursé',   en: 'Refunded'   },
};

const PAYOUT_STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  not_due: { fr: 'Non dû',   en: 'Not Due' },
  due:     { fr: 'Dû',       en: 'Due'     },
  sent:    { fr: 'Envoyé',   en: 'Sent'    },
  failed:  { fr: 'Échoué',   en: 'Failed'  },
};

export default function AdminPayments() {
  const { toast } = useToast();
  const params = useParams();
  const isFr = (params?.locale as string) === "fr";
  const { overview, loading: overviewLoading } = useAdminOverview();
  const { bookings: apiBookings, error: bookingsError, retry: retryBookings } = useAdminBookings();

  const [bookings, setBookings] = useState<PaymentBooking[]>([]);
  useEffect(() => {
    setBookings(apiBookings.map(toPaymentBooking));
  }, [apiBookings]);

  // Bilingual status labels (derived from locale)
  const paymentStatusLabels = Object.fromEntries(
    Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => [k, v[isFr ? 'fr' : 'en']])
  );
  const payoutStatusLabels = Object.fromEntries(
    Object.entries(PAYOUT_STATUS_LABELS).map(([k, v]) => [k, v[isFr ? 'fr' : 'en']])
  );

  const [activeTab, setActiveTab] = useState("payments");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<PaymentBooking | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [finalAmountInput, setFinalAmountInput] = useState("");

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'bank_transfer'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Payout form state
  const [payoutMethod, setPayoutMethod] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [payoutReference, setPayoutReference] = useState('');
  const [payoutNote, setPayoutNote] = useState('');

  const updateLocalBooking = (id: string, patch: Partial<PaymentBooking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    setSelectedBooking(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  };

  const paymentsBookings = useMemo(() => {
    return bookings.filter(b => b.status !== 'cancelled').filter(b => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        b.clientName.toLowerCase().includes(searchLower) ||
        b.serviceName.toLowerCase().includes(searchLower) ||
        b.providerName.toLowerCase().includes(searchLower) ||
        b.id.includes(searchLower);
      // Aiguillage par VALEUR : les onglets mélangent les deux axes. unpaid /
      // partial / paid interrogent l'encaissement, refunded l'état du dossier.
      // Un dossier soldé PUIS remboursé sort sous « Remboursé » uniquement :
      // l'état terminal prime pour le filtrage, le second badge dit le reste.
      const matchesStatus =
        paymentStatusFilter === "all" ? true
        : paymentStatusFilter === "refunded" ? b.paymentStatus === "refunded"
        : b.paymentStatus === "refunded" ? false
        : b.collectionStatus === paymentStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, paymentStatusFilter]);

  const payoutsBookings = useMemo(() => {
    // Un dossier remboursé ne doit rien au prestataire : verser ET rembourser,
    // c'est Shizu qui paie deux fois sur ses fonds propres.
    return bookings.filter(b => b.status === 'completed' && b.collectionStatus === 'paid'
                                && b.paymentStatus !== 'refunded').filter(b => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        b.providerName.toLowerCase().includes(searchLower) ||
        b.serviceName.toLowerCase().includes(searchLower) ||
        b.id.includes(searchLower);
      const matchesStatus = payoutStatusFilter === "all" || b.payoutStatus === payoutStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, payoutStatusFilter]);

  const openPaymentModal = () => {
    // Pre-fill with the remaining balance due (falls back to price for legacy rows).
    const prefill = selectedBooking?.amountDue ?? selectedBooking?.price ?? 0;
    setFinalAmountInput(prefill > 0 ? String(prefill) : "");
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentNote('');
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (bookingId: string) => {
    const amount = Math.round(Number(finalAmountInput) || selectedBooking?.price || 0);
    if (!amount) return;
    setIsUpdating(true);
    try {
      // Record the payment (accumulates into amount_collected server-side).
      const res: {
        amount_collected?: number; amount_due?: number; overpaid?: number;
        collection_status?: string; status?: string; payment_status?: string;
      } = await adminApi.portalConfirmPayment(Number(bookingId), amount);
      updateLocalBooking(bookingId, {
        amountCollected: res?.amount_collected,
        amountDue: res?.amount_due,
        collectionStatus: res?.collection_status as import("@/data/adminStore").CollectionStatus,
        overpaid: res?.overpaid,
        status: (res?.status as import("@/data/adminStore").AdminBooking['status']) ?? selectedBooking?.status,
        paidAt: new Date().toISOString().split('T')[0],
        paymentMethod,
      });
      toast({
        title: isFr ? "Versement enregistré" : "Payment Recorded",
        description: isFr
          ? `Versement via ${paymentMethod.replace('_', ' ')} enregistré.`
          : `Payment for booking ${bookingId} recorded via ${paymentMethod.replace('_', ' ')}.`,
        duration: 3000,
      });
      setPaymentModalOpen(false);
    } catch (err) {
      console.error("Failed to record payment:", err);
      // Surface the backend's own message (e.g. the locked-amount motif rule)
      // instead of a generic toast, so the admin knows exactly what to fix.
      const backendMsg = extractApiError(err);
      toast({
        title: isFr ? "Erreur" : "Error",
        description: backendMsg || (isFr ? "Impossible d'enregistrer le paiement." : "Failed to record payment."),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleIssueRefund = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      await adminApi.portalUpdateFinance(bookingId, { payment_status: 'refunded' });
      updateLocalBooking(bookingId, { paymentStatus: 'refunded' });
      toast({
        title: isFr ? "Remboursement effectué" : "Refund Issued",
        description: isFr
          ? `Remboursement pour la réservation ${bookingId} effectué.`
          : `Refund for booking ${bookingId} has been processed.`,
        duration: 3000,
      });
      setRefundModalOpen(false);
    } catch (err) {
      console.error("Failed to issue refund:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible d'effectuer le remboursement." : "Failed to issue refund.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const openPayoutModal = () => {
    setPayoutMethod('mobile_money');
    setPayoutReference('');
    setPayoutNote('');
    setPayoutModalOpen(true);
  };

  const handleRecordPayout = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      await adminApi.portalUpdateFinance(bookingId, { payout_status: 'sent' });
      updateLocalBooking(bookingId, {
        payoutStatus: 'sent',
        payoutSentAt: new Date().toISOString().split('T')[0],
        payoutMethod,
      });
      toast({
        title: isFr ? "Paiement prestataire envoyé" : "Payout Sent",
        description: isFr
          ? `Paiement envoyé via ${payoutMethod.replace('_', ' ')}.`
          : `Provider payout for booking ${bookingId} sent via ${payoutMethod.replace('_', ' ')}.`,
        duration: 3000,
      });
      setPayoutModalOpen(false);
    } catch (err) {
      console.error("Failed to record payout:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible d'enregistrer le versement." : "Failed to record payout.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminLayout title={isFr ? "Paiements" : "Payments"}>
      <div className="space-y-4">
        {bookingsError && <ErrorBanner isFr={isFr} onRetry={retryBookings} />}
        {/* Finance Summary — same source as Overview GMV */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium">{isFr ? "Total encaissé" : "Total Collected"}</span>
              </div>
              {overviewLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="live-stat-paid">
                    {new Intl.NumberFormat('fr-FR').format(overview?.gmv_total ?? 0)} FCFA
                  </p>
                  {/* Ce chiffre est un GMV de dossiers SOLDÉS, pas du cash
                      encaissé : les acomptes n'y sont pas et les remboursés en
                      sont exclus. L'ancien libellé annonçait de la trésorerie. */}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr ? "Dossiers soldés, hors remboursés" : "Settled bookings, refunds excluded"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Receipt className="h-4 w-4 text-violet-500" />
                <span className="text-xs font-medium">{isFr ? "Revenus Shizu" : "Shizu Revenue"}</span>
              </div>
              {overviewLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-lg font-bold text-violet-600 dark:text-violet-400" data-testid="live-stat-revenue-shizu">
                    {new Intl.NumberFormat('fr-FR').format(overview?.revenue_shizu ?? 0)} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr ? "Commission 15%" : "15% commission"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ArrowUpRight className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium">{isFr ? "Versements dus" : "Payouts Due"}</span>
              </div>
              {overviewLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="live-stat-payouts-due">
                    {new Intl.NumberFormat('fr-FR').format(overview?.payouts_due ?? 0)} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr ? "Provider payout non envoyé" : "Provider payout not sent"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-medium">{isFr ? "Total versé" : "Total Paid Out"}</span>
              </div>
              {overviewLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400" data-testid="live-stat-payouts-sent">
                    {new Intl.NumberFormat('fr-FR').format(overview?.payouts_sent ?? 0)} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr ? "Versé aux prestataires" : "Sent to providers"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="payments" data-testid="tab-payments">
              <ArrowDownLeft className="h-4 w-4 mr-2" />
              {isFr ? "Paiements clients" : "Customer Payments"}
            </TabsTrigger>
            <TabsTrigger value="payouts" data-testid="tab-payouts">
              <ArrowUpRight className="h-4 w-4 mr-2" />
              {isFr ? "Paiements prestataires" : "Provider Payouts"}
            </TabsTrigger>
          </TabsList>

          {/* Customer Payments Tab */}
          <TabsContent value="payments" className="space-y-4 mt-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={isFr ? "Rechercher par client, service, ID..." : "Search by client, service, or ID..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-payments"
                    />
                  </div>
                  
                  <div className="flex gap-1 flex-wrap">
                    {['all', 'unpaid', 'partial', 'paid', 'refunded'].map((status) => (
                      <Button
                        key={status}
                        variant={paymentStatusFilter === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentStatusFilter(status)}
                        data-testid={`filter-payment-${status}`}
                      >
                        {status === "all" ? (isFr ? "Tous" : "All") : paymentStatusLabels[status] || status}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {isFr ? "Paiements" : "Payments"} ({paymentsBookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {paymentsBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{isFr ? "Aucun paiement trouvé" : "No payments found"}</p>
                  </div>
                ) : (
                  <div className="divide-y" data-testid="payments-list">
                    {paymentsBookings.map((booking) => (
                      <button
                        key={booking.id}
                        className="w-full flex items-center justify-between gap-4 p-3 hover-elevate text-left"
                        onClick={() => setSelectedBooking(booking)}
                        data-testid={`payment-row-${booking.id}`}
                      >
                        <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
                          <div>
                            <p className="font-medium text-sm truncate">{booking.clientName}</p>
                            <p className="text-xs text-muted-foreground">{booking.serviceName}</p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-sm truncate">{booking.providerName}</p>
                            <p className="text-xs text-muted-foreground">{booking.date}</p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-sm font-medium">{formatMoney(booking.price, booking.currency)}</p>
                            <p className="text-xs text-muted-foreground">ID: {booking.id}</p>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            {/* Deux axes orthogonaux, deux badges — voir AdminBookings. */}
                            <Badge className={`text-xs ${paymentStatusColors[booking.collectionStatus ?? 'unpaid']}`}>
                              {paymentStatusLabels[booking.collectionStatus ?? 'unpaid']}
                            </Badge>
                            {booking.paymentStatus && booking.paymentStatus !== 'open' && (
                              <Badge className={`text-xs ${paymentStatusColors[booking.paymentStatus]}`}>
                                {paymentStatusLabels[booking.paymentStatus]}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Provider Payouts Tab */}
          <TabsContent value="payouts" className="space-y-4 mt-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={isFr ? "Rechercher par prestataire, service, ID..." : "Search by provider, service, or ID..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-payouts"
                    />
                  </div>
                  
                  <div className="flex gap-1 flex-wrap">
                    {['all', 'due', 'sent', 'failed'].map((status) => (
                      <Button
                        key={status}
                        variant={payoutStatusFilter === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPayoutStatusFilter(status)}
                        data-testid={`filter-payout-${status}`}
                      >
                        {status === "all" ? (isFr ? "Tous" : "All") : payoutStatusLabels[status] || status}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {isFr ? "Versements" : "Payouts"} ({payoutsBookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payoutsBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Banknote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{isFr ? "Aucun paiement prestataire" : "No payouts found"}</p>
                    <p className="text-xs mt-1">{isFr ? "Réservations complétées et payées uniquement" : "Payouts appear for completed & paid bookings"}</p>
                  </div>
                ) : (
                  <div className="divide-y" data-testid="payouts-list">
                    {payoutsBookings.map((booking) => (
                      <button
                        key={booking.id}
                        className="w-full flex items-center justify-between gap-4 p-3 hover-elevate text-left"
                        onClick={() => setSelectedBooking(booking)}
                        data-testid={`payout-row-${booking.id}`}
                      >
                        <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
                          <div>
                            <p className="font-medium text-sm truncate">{booking.providerName}</p>
                            <p className="text-xs text-muted-foreground">{booking.providerCompany || (isFr ? 'Indépendant' : 'Individual')}</p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-sm truncate">{booking.serviceName}</p>
                            <p className="text-xs text-muted-foreground">{booking.date}</p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              {formatMoney(booking.providerPayoutAmount, booking.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">ID: {booking.id}</p>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <Badge className={`text-xs ${payoutStatusColors[booking.payoutStatus]}`}>
                              {payoutStatusLabels[booking.payoutStatus]}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment/Payout Detail Sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {activeTab === 'payments'
                ? (isFr ? 'Détail paiement' : 'Payment Details')
                : (isFr ? 'Détail versement' : 'Payout Details')}
            </SheetTitle>
            <SheetDescription>
              {isFr ? "Réservation" : "Booking"} ID: {selectedBooking?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedBooking && (
            <div className="space-y-6 mt-6">
              {/* Amount Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{isFr ? "Montant total" : "Total Amount"}</span>
                  <span className="text-xl font-bold">{formatMoney(selectedBooking.price, selectedBooking.currency)}</span>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{isFr ? "Paiement :" : "Payment:"}</span>
                    <Badge className={`${paymentStatusColors[selectedBooking.collectionStatus ?? 'unpaid']}`}>
                      {paymentStatusLabels[selectedBooking.collectionStatus ?? 'unpaid']}
                    </Badge>
                    {selectedBooking.paymentStatus && selectedBooking.paymentStatus !== 'open' && (
                      <Badge className={`${paymentStatusColors[selectedBooking.paymentStatus]}`}>
                        {paymentStatusLabels[selectedBooking.paymentStatus]}
                      </Badge>
                    )}
                  </div>
                  {selectedBooking.payoutStatus && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{isFr ? "Versement :" : "Payout:"}</span>
                      <Badge className={`${payoutStatusColors[selectedBooking.payoutStatus]}`}>
                        {payoutStatusLabels[selectedBooking.payoutStatus]}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Fee Breakdown */}
              <div className="space-y-2 bg-muted/50 rounded-md p-3">
                <h4 className="font-medium text-sm">{isFr ? "Répartition des frais" : "Fee Breakdown"}</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isFr ? "Montant total" : "Base Amount"}</span>
                    <span>{formatMoney(selectedBooking.baseAmount, selectedBooking.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isFr ? "Commission Shizu (15%)" : "Platform Fee (15%)"}</span>
                    <span>{formatMoney(selectedBooking.platformFeeAmount, selectedBooking.currency)}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>{isFr ? "Part prestataire" : "Provider Payout"}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatMoney(selectedBooking.providerPayoutAmount, selectedBooking.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Informations de réservation" : "Booking Info"}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.providerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.serviceName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.date} {isFr ? "à" : "at"} {selectedBooking.time}</span>
                  </div>
                </div>
              </div>

              {/* Payment Timestamps */}
              {(selectedBooking.paidAt || selectedBooking.payoutDueAt || selectedBooking.payoutSentAt) && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  {selectedBooking.paidAt && <p>{isFr ? "Payé :" : "Paid:"} {selectedBooking.paidAt}</p>}
                  {selectedBooking.payoutDueAt && <p>{isFr ? "Versement dû :" : "Payout Due:"} {selectedBooking.payoutDueAt}</p>}
                  {selectedBooking.payoutSentAt && <p>{isFr ? "Versement envoyé :" : "Payout Sent:"} {selectedBooking.payoutSentAt}</p>}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground">Actions</h4>
                
                {/* Record Payment - for unpaid bookings that are past the pending stage */}
                {selectedBooking.collectionStatus !== 'paid' &&
                 !['cancelled', 'pending', 'requested'].includes(selectedBooking.status) && (
                  <Button
                    className="w-full"
                    onClick={openPaymentModal}
                    disabled={isUpdating}
                    data-testid="button-record-payment"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {isFr ? "Enregistrer le paiement" : "Record Payment"}
                  </Button>
                )}

                {/* Pending bookings need confirmation first */}
                {selectedBooking.collectionStatus !== 'paid' && ['pending', 'requested'].includes(selectedBooking.status) && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {isFr ? "Confirmez la réservation avant d'enregistrer le paiement." : "Confirm the booking before recording payment."}
                  </p>
                )}

                {/* Issue Refund - only for paid bookings (not refunded, not already processing payout) */}
                {selectedBooking.collectionStatus === 'paid' && selectedBooking.paymentStatus !== 'refunded' && selectedBooking.payoutStatus !== 'sent' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setRefundModalOpen(true)}
                    disabled={isUpdating}
                    data-testid="button-issue-refund"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isFr ? "Rembourser" : "Issue Refund"}
                  </Button>
                )}

                {/* Mark Payout Sent - only for due payouts with paid status */}
                {selectedBooking.payoutStatus === 'due' && selectedBooking.collectionStatus === 'paid' && selectedBooking.paymentStatus !== 'refunded' && (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={openPayoutModal}
                    disabled={isUpdating}
                    data-testid="button-mark-payout-sent"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                    {isFr ? "Marquer versement envoyé" : "Mark Payout Sent"}
                  </Button>
                )}

                {/* Already refunded */}
                {selectedBooking.paymentStatus === 'refunded' && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {isFr ? "Ce paiement a été remboursé." : "This payment has been refunded."}
                  </p>
                )}

                {/* Payout already sent */}
                {selectedBooking.payoutStatus === 'sent' && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {isFr ? "Le versement a été envoyé au prestataire." : "Payout has been sent to the provider."}
                  </p>
                )}

                {/* Payout failed */}
                {selectedBooking.payoutStatus === 'failed' && (
                  <p className="text-sm text-destructive text-center py-2">
                    {isFr ? "Versement échoué. Réessayez manuellement." : "Payout failed. Please retry manually."}
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Recording Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              {isFr ? "Enregistrer le paiement" : "Record Payment"}
            </DialogTitle>
            <DialogDescription>
              {selectedBooking && `${selectedBooking.clientName} · ${selectedBooking.serviceName}`}
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              {/* Context: devis initial */}
              {selectedBooking.price > 0 && (
                <div className="flex justify-between items-center text-sm bg-muted/40 rounded-md px-3 py-2">
                  <span className="text-muted-foreground">{isFr ? "Devis initial" : "Quoted Price"}</span>
                  <span className="font-medium">{new Intl.NumberFormat('fr-FR').format(selectedBooking.price)} FCFA</span>
                </div>
              )}

              {/* Collected / due summary + amount received (accumulates). */}
              {(() => {
                const collected = selectedBooking.amountCollected ?? 0;
                const due = selectedBooking.amountDue ?? 0;
                const dueTotal = collected + due;
                const received = Math.round(Number(finalAmountInput) || 0);
                const surplus = Math.max(0, collected + Math.max(0, received) - dueTotal);
                const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA';
                return (
                  <>
                    <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">{isFr ? "Déjà encaissé" : "Collected"}</span><span className="font-medium">{fmt(collected)}</span></div>
                      <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">{isFr ? "Solde restant" : "Remaining"}</span><span className="font-semibold">{fmt(due)}</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {isFr ? "Montant reçu (FCFA) *" : "Amount received (FCFA) *"}
                      </label>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          value={finalAmountInput}
                          onChange={(e) => setFinalAmountInput(e.target.value)}
                          placeholder="0"
                          min={1}
                          autoFocus
                          data-testid="input-payment-amount"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">FCFA</span>
                      </div>
                    </div>
                    {surplus > 0 && (
                      <p className="text-xs text-amber-700">
                        {isFr ? `Surplus accepté (pourboire / arrondi) : ${fmt(surplus)}` : `Surplus accepted (tip / rounding): ${fmt(surplus)}`}
                      </p>
                    )}
                  </>
                );
              })()}

              {/* Payment method + optional fields */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isFr ? "Mode de paiement" : "Payment Method"}</label>
                  <Select value={paymentMethod} onValueChange={(v: 'cash' | 'mobile_money' | 'bank_transfer') => setPaymentMethod(v)}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{isFr ? "Espèces" : "Cash"}</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">{isFr ? "Virement" : "Bank Transfer"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isFr ? "Référence (optionnel)" : "Reference (optional)"}</label>
                  <Input
                    placeholder={isFr ? "Référence ou numéro de reçu" : "Transaction reference or receipt number"}
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    data-testid="input-payment-reference"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isFr ? "Note (optionnel)" : "Note (optional)"}</label>
                  <Textarea
                    placeholder={isFr ? "Notes sur ce paiement" : "Additional notes about this payment"}
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    rows={2}
                    data-testid="input-payment-note"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)} disabled={isUpdating}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => selectedBooking && handleRecordPayment(selectedBooking.id)}
              disabled={isUpdating || !Number(finalAmountInput)}
              data-testid="button-record-payment"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {isFr ? "Enregistrer le versement" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Modal */}
      <Dialog open={refundModalOpen} onOpenChange={setRefundModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? "Confirmer le remboursement" : "Confirm Refund"}</DialogTitle>
            <DialogDescription>
              {isFr ? "Confirmer le remboursement pour cette réservation ?" : "Are you sure you want to issue a refund for this booking?"}
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p><strong>{isFr ? "N° réservation" : "Booking ID"}:</strong> {selectedBooking.id}</p>
                <p><strong>{isFr ? "Client" : "Client"}:</strong> {selectedBooking.clientName}</p>
                <p><strong>{isFr ? "Montant" : "Amount"}:</strong> {formatMoney(selectedBooking.price, selectedBooking.currency)}</p>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {isFr ? "Cette action est irréversible." : "This action cannot be undone."}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModalOpen(false)} disabled={isUpdating}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedBooking && handleIssueRefund(selectedBooking.id)}
              disabled={isUpdating}
              data-testid="button-confirm-refund"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isFr ? "Rembourser" : "Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payout Recording Modal */}
      <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? "Enregistrer le versement" : "Record Payout"}</DialogTitle>
            <DialogDescription>
              {isFr ? "Saisir les détails du versement au prestataire." : "Enter payout details for the provider."}
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p><strong>{isFr ? "Prestataire" : "Provider"}:</strong> {selectedBooking.providerName}</p>
                <p><strong>{isFr ? "Service" : "Service"}:</strong> {selectedBooking.serviceName}</p>
                <p><strong>{isFr ? "Montant versement" : "Payout Amount"}:</strong> {formatMoney(selectedBooking.providerPayoutAmount, selectedBooking.currency)}</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isFr ? "Mode de versement" : "Payout Method"}</label>
                  <Select value={payoutMethod} onValueChange={(v: 'mobile_money' | 'bank_transfer') => setPayoutMethod(v)}>
                    <SelectTrigger data-testid="select-payout-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">{isFr ? "Virement" : "Bank Transfer"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isFr ? "Référence (optionnel)" : "Reference (optional)"}</label>
                  <Input 
                    placeholder={isFr ? "Référence de transaction" : "Transaction reference"}
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    data-testid="input-payout-reference"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isFr ? "Note (optionnel)" : "Note (optional)"}</label>
                  <Textarea
                    placeholder={isFr ? "Notes sur ce versement" : "Additional notes about this payout"}
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                    rows={2}
                    data-testid="input-payout-note"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutModalOpen(false)} disabled={isUpdating}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => selectedBooking && handleRecordPayout(selectedBooking.id)}
              disabled={isUpdating}
              data-testid="button-confirm-payout"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isFr ? "Enregistrer le versement" : "Record Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
