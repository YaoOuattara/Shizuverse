"use client";
/**
 * Admin Payments Page
 * 
 * Finance management with two tabs:
 * 1. Customer Payments - Track incoming payments from clients
 * 2. Provider Payouts - Track outgoing payments to providers
 */

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Filter,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  CreditCard,
  Banknote,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building2,
  FileText,
} from "lucide-react";
import { useAdminStore, type AdminBooking } from "@/data/adminStore";
import { useAdminFinanceSummary } from "@/hooks/useAdminApi";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { formatMoney } from "@/lib/currency";

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
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

const paymentStatusLabels: Record<string, string> = {
  unpaid: 'Unpaid',
  pending: 'Pending',
  paid: 'Paid',
  refunded: 'Refunded',
};

const payoutStatusLabels: Record<string, string> = {
  not_due: 'Not Due',
  due: 'Due',
  sent: 'Sent',
  failed: 'Failed',
};

export default function AdminPayments() {
  const { toast } = useToast();
  const params = useParams();
  const isFr = (params?.locale as string) === "fr";
  const { summary, isLoading: summaryLoading } = useAdminFinanceSummary();
  const {
    bookings,
    providers,
    transactions,
    recordPayment,
    recordRefund,
    recordPayout,
  } = useAdminStore();
  
  const [activeTab, setActiveTab] = useState("payments");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  
  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'bank_transfer'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  
  // Payout form state
  const [payoutMethod, setPayoutMethod] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [payoutReference, setPayoutReference] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  
  const paymentsBookings = useMemo(() => {
    return bookings.filter(b => b.status !== 'cancelled').filter(b => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        b.clientName.toLowerCase().includes(searchLower) ||
        b.serviceName.toLowerCase().includes(searchLower) ||
        b.providerName.toLowerCase().includes(searchLower) ||
        b.id.includes(searchLower);
      const matchesStatus = paymentStatusFilter === "all" || b.paymentStatus === paymentStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, paymentStatusFilter]);
  
  const payoutsBookings = useMemo(() => {
    return bookings.filter(b => b.status === 'completed' && b.paymentStatus === 'paid').filter(b => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        b.providerName.toLowerCase().includes(searchLower) ||
        b.serviceName.toLowerCase().includes(searchLower) ||
        b.id.includes(searchLower);
      const matchesStatus = payoutStatusFilter === "all" || b.payoutStatus === payoutStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, payoutStatusFilter]);

  const stats = useMemo(() => {
    const unpaidTotal = bookings
      .filter(b => b.paymentStatus === 'unpaid' && b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.baseAmount || b.price || 0), 0);
    const paidTotal = bookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((sum, b) => sum + (b.baseAmount || b.price || 0), 0);
    const refundedTotal = bookings
      .filter(b => b.paymentStatus === 'refunded')
      .reduce((sum, b) => sum + (b.baseAmount || b.price || 0), 0);
    const payoutsDue = bookings
      .filter(b => b.payoutStatus === 'due')
      .reduce((sum, b) => sum + (b.providerPayoutAmount || 0), 0);
    const payoutsSent = bookings
      .filter(b => b.payoutStatus === 'sent')
      .reduce((sum, b) => sum + (b.providerPayoutAmount || 0), 0);
    const platformRevenue = bookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((sum, b) => sum + (b.platformFeeAmount || 0), 0);
    
    return { unpaidTotal, paidTotal, refundedTotal, payoutsDue, payoutsSent, platformRevenue };
  }, [bookings]);

  const openPaymentModal = () => {
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentNote('');
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      await adminApi.portalUpdateFinance(bookingId, { payment_status: 'paid' });
      recordPayment(bookingId, {
        method: paymentMethod,
        reference: paymentReference || undefined,
        note: paymentNote || undefined,
      });
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(prev => prev ? {
          ...prev,
          paymentStatus: 'paid',
          paidAt: new Date().toISOString().split('T')[0],
          paymentMethod: paymentMethod,
        } : null);
      }
      toast({
        title: "Payment Recorded",
        description: `Payment for booking ${bookingId} has been recorded via ${paymentMethod.replace('_', ' ')}.`,
        duration: 3000,
      });
      setPaymentModalOpen(false);
    } catch (err) {
      console.error("Failed to record payment:", err);
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleIssueRefund = async (bookingId: string) => {
    setIsUpdating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    recordRefund(bookingId);
    
    toast({
      title: "Refund Issued",
      description: `Refund for booking ${bookingId} has been processed.`,
      duration: 3000,
    });
    
    if (selectedBooking?.id === bookingId) {
      setSelectedBooking(prev => prev ? { ...prev, paymentStatus: 'refunded' } : null);
    }
    
    setRefundModalOpen(false);
    setIsUpdating(false);
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
      recordPayout(bookingId, {
        method: payoutMethod,
        reference: payoutReference || undefined,
        note: payoutNote || undefined,
      });
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(prev => prev ? {
          ...prev,
          payoutStatus: 'sent',
          payoutSentAt: new Date().toISOString().split('T')[0],
          payoutMethod: payoutMethod,
        } : null);
      }
      toast({
        title: "Payout Sent",
        description: `Provider payout for booking ${bookingId} has been sent via ${payoutMethod.replace('_', ' ')}.`,
        duration: 3000,
      });
      setPayoutModalOpen(false);
    } catch (err) {
      console.error("Failed to record payout:", err);
      toast({ title: "Error", description: "Failed to record payout.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminLayout title="Payments">
      <div className="space-y-4">
        {/* Live Finance Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs">{isFr ? "Réservations complétées" : "Completed bookings"}</span>
              </div>
              {summaryLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-lg font-bold" data-testid="live-stat-completed">
                  {summary?.completed_bookings ?? "—"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                <span className="text-xs">{isFr ? "Total encaissé (XOF)" : "Total paid (XOF)"}</span>
              </div>
              {summaryLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="live-stat-paid">
                  {formatMoney(summary?.total_paid_xof ?? 0)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ArrowUpRight className="h-4 w-4 text-amber-500" />
                <span className="text-xs">{isFr ? "Paiements dus (nb)" : "Payouts due (count)"}</span>
              </div>
              {summaryLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="live-stat-payouts-due-count">
                  {summary?.payouts_due_count ?? "—"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Banknote className="h-4 w-4 text-amber-500" />
                <span className="text-xs">{isFr ? "Valeur paiements dus" : "Payouts due value"}</span>
              </div>
              {summaryLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="live-stat-payouts-due-value">
                  {formatMoney(summary?.payouts_due_value_xof ?? 0)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs">{isFr ? "Paiements échoués" : "Failed payouts"}</span>
              </div>
              {summaryLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-lg font-bold text-red-600 dark:text-red-400" data-testid="live-stat-failed-payouts">
                  {summary?.failed_payouts ?? "—"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-xs">{isFr ? "Complétées non payées" : "Unpaid completed"}</span>
              </div>
              {summaryLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="live-stat-unpaid-completed">
                  {summary?.unpaid_completed_bookings ?? "—"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mock Stats Cards (Zustand) */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                <span className="text-xs">Collected</span>
              </div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-collected">
                {formatMoney(stats.paidTotal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-xs">Unpaid</span>
              </div>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="stat-unpaid">
                {formatMoney(stats.unpaidTotal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs">Platform Revenue</span>
              </div>
              <p className="text-lg font-bold" data-testid="stat-revenue">
                {formatMoney(stats.platformRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ArrowUpRight className="h-4 w-4 text-amber-500" />
                <span className="text-xs">Payouts Due</span>
              </div>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="stat-payouts-due">
                {formatMoney(stats.payoutsDue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs">Payouts Sent</span>
              </div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-payouts-sent">
                {formatMoney(stats.payoutsSent)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <RefreshCw className="h-4 w-4 text-gray-500" />
                <span className="text-xs">Refunded</span>
              </div>
              <p className="text-lg font-bold text-muted-foreground" data-testid="stat-refunded">
                {formatMoney(stats.refundedTotal)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="payments" data-testid="tab-payments">
              <ArrowDownLeft className="h-4 w-4 mr-2" />
              Customer Payments
            </TabsTrigger>
            <TabsTrigger value="payouts" data-testid="tab-payouts">
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Provider Payouts
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
                      placeholder="Search by client, service, or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-payments"
                    />
                  </div>
                  
                  <div className="flex gap-1 flex-wrap">
                    {['all', 'unpaid', 'paid', 'refunded'].map((status) => (
                      <Button
                        key={status}
                        variant={paymentStatusFilter === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentStatusFilter(status)}
                        data-testid={`filter-payment-${status}`}
                      >
                        {status === "all" ? "All" : paymentStatusLabels[status] || status}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Payments ({paymentsBookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {paymentsBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No payments found</p>
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
                            <Badge className={`text-xs ${paymentStatusColors[booking.paymentStatus]}`}>
                              {paymentStatusLabels[booking.paymentStatus]}
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

          {/* Provider Payouts Tab */}
          <TabsContent value="payouts" className="space-y-4 mt-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by provider, service, or ID..."
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
                        {status === "all" ? "All" : payoutStatusLabels[status] || status}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Payouts ({payoutsBookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payoutsBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Banknote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No payouts found</p>
                    <p className="text-xs mt-1">Payouts appear for completed & paid bookings</p>
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
                            <p className="text-xs text-muted-foreground">{booking.providerCompany || 'Individual'}</p>
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
              {activeTab === 'payments' ? 'Payment Details' : 'Payout Details'}
            </SheetTitle>
            <SheetDescription>
              Booking ID: {selectedBooking?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedBooking && (
            <div className="space-y-6 mt-6">
              {/* Amount Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <span className="text-xl font-bold">{formatMoney(selectedBooking.price, selectedBooking.currency)}</span>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Payment:</span>
                    <Badge className={`${paymentStatusColors[selectedBooking.paymentStatus]}`}>
                      {paymentStatusLabels[selectedBooking.paymentStatus]}
                    </Badge>
                  </div>
                  {selectedBooking.payoutStatus && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Payout:</span>
                      <Badge className={`${payoutStatusColors[selectedBooking.payoutStatus]}`}>
                        {payoutStatusLabels[selectedBooking.payoutStatus]}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Fee Breakdown */}
              <div className="space-y-2 bg-muted/50 rounded-md p-3">
                <h4 className="font-medium text-sm">Fee Breakdown</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Amount</span>
                    <span>{formatMoney(selectedBooking.baseAmount, selectedBooking.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee (15%)</span>
                    <span>{formatMoney(selectedBooking.platformFeeAmount, selectedBooking.currency)}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Provider Payout</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatMoney(selectedBooking.providerPayoutAmount, selectedBooking.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Booking Info</h4>
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
                    <span>{selectedBooking.date} at {selectedBooking.time}</span>
                  </div>
                </div>
              </div>

              {/* Payment Timestamps */}
              {(selectedBooking.paidAt || selectedBooking.payoutDueAt || selectedBooking.payoutSentAt) && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  {selectedBooking.paidAt && <p>Paid: {selectedBooking.paidAt}</p>}
                  {selectedBooking.payoutDueAt && <p>Payout Due: {selectedBooking.payoutDueAt}</p>}
                  {selectedBooking.payoutSentAt && <p>Payout Sent: {selectedBooking.payoutSentAt}</p>}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground">Actions</h4>
                
                {/* Record Payment - for unpaid confirmed/completed bookings only */}
                {selectedBooking.paymentStatus === 'unpaid' && 
                 (selectedBooking.status === 'confirmed' || selectedBooking.status === 'completed') && (
                  <Button
                    className="w-full"
                    onClick={openPaymentModal}
                    disabled={isUpdating}
                    data-testid="button-record-payment"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Record Payment
                  </Button>
                )}

                {/* Pending bookings need confirmation first */}
                {selectedBooking.paymentStatus === 'unpaid' && selectedBooking.status === 'pending' && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Confirm the booking before recording payment.
                  </p>
                )}

                {/* Issue Refund - only for paid bookings (not refunded, not already processing payout) */}
                {selectedBooking.paymentStatus === 'paid' && selectedBooking.payoutStatus !== 'sent' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setRefundModalOpen(true)}
                    disabled={isUpdating}
                    data-testid="button-issue-refund"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Issue Refund
                  </Button>
                )}

                {/* Mark Payout Sent - only for due payouts with paid status */}
                {selectedBooking.payoutStatus === 'due' && selectedBooking.paymentStatus === 'paid' && (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={openPayoutModal}
                    disabled={isUpdating}
                    data-testid="button-mark-payout-sent"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                    Mark Payout Sent
                  </Button>
                )}

                {/* Already refunded */}
                {selectedBooking.paymentStatus === 'refunded' && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    This payment has been refunded.
                  </p>
                )}

                {/* Payout already sent */}
                {selectedBooking.payoutStatus === 'sent' && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Payout has been sent to the provider.
                  </p>
                )}

                {/* Payout failed */}
                {selectedBooking.payoutStatus === 'failed' && (
                  <p className="text-sm text-destructive text-center py-2">
                    Payout failed. Please retry manually.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Recording Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter payment details for this booking.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p><strong>Booking ID:</strong> {selectedBooking.id}</p>
                <p><strong>Client:</strong> {selectedBooking.clientName}</p>
                <p><strong>Amount:</strong> {formatMoney(selectedBooking.price, selectedBooking.currency)}</p>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select value={paymentMethod} onValueChange={(v: 'cash' | 'mobile_money' | 'bank_transfer') => setPaymentMethod(v)}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reference (optional)</label>
                  <Input 
                    placeholder="Transaction reference or receipt number"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    data-testid="input-payment-reference"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Note (optional)</label>
                  <Textarea 
                    placeholder="Additional notes about this payment"
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
              Cancel
            </Button>
            <Button 
              onClick={() => selectedBooking && handleRecordPayment(selectedBooking.id)}
              disabled={isUpdating}
              data-testid="button-confirm-payment"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Modal */}
      <Dialog open={refundModalOpen} onOpenChange={setRefundModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Refund</DialogTitle>
            <DialogDescription>
              Are you sure you want to issue a refund for this booking?
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p><strong>Booking ID:</strong> {selectedBooking.id}</p>
                <p><strong>Client:</strong> {selectedBooking.clientName}</p>
                <p><strong>Amount:</strong> {formatMoney(selectedBooking.price, selectedBooking.currency)}</p>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModalOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedBooking && handleIssueRefund(selectedBooking.id)}
              disabled={isUpdating}
              data-testid="button-confirm-refund"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Issue Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payout Recording Modal */}
      <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payout</DialogTitle>
            <DialogDescription>
              Enter payout details for the provider.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p><strong>Provider:</strong> {selectedBooking.providerName}</p>
                <p><strong>Service:</strong> {selectedBooking.serviceName}</p>
                <p><strong>Payout Amount:</strong> {formatMoney(selectedBooking.providerPayoutAmount, selectedBooking.currency)}</p>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Payout Method</label>
                  <Select value={payoutMethod} onValueChange={(v: 'mobile_money' | 'bank_transfer') => setPayoutMethod(v)}>
                    <SelectTrigger data-testid="select-payout-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reference (optional)</label>
                  <Input 
                    placeholder="Transaction reference"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    data-testid="input-payout-reference"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Note (optional)</label>
                  <Textarea 
                    placeholder="Additional notes about this payout"
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
              Cancel
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => selectedBooking && handleRecordPayout(selectedBooking.id)}
              disabled={isUpdating}
              data-testid="button-confirm-payout"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Record Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
