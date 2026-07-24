"use client";
/**
 * Admin Bookings Page
 * 
 * List with filters, detail drawer, status timeline, and admin actions.
 * Uses centralized admin store for state management.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
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
  Loader2,
  MapPin,
  Banknote,
  Building2,
  CalendarClock,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Lock,
  LockOpen,
  Copy,
  Send,
  Star,
  Eye,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useAdminStore, type AdminBooking } from "@/data/adminStore";
import { useAdminBookings, useAdminProviders, useAdminServices, type ApiBooking, type ApiProvider, type ApiService } from "@/hooks/useAdminApi";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { formatMoney } from "@/lib/currency";
import {
  getPricingSuggestion,
  normalizeZone,
  DEFAULT_PRICING_RULES,
  ZONES_LIST,
  URGENCY_OPTIONS,
  TIME_PREFERENCE_OPTIONS,
  type PricingSuggestion,
  type UrgencyLevel,
  type TimePreference,
} from "@/utils/pricingEngine";

interface AIRecommendation {
  provider_id: number;
  name: string;
  score: number;
  ai_recommendation: string;
  rating: number;
  zones: string[];
  phone: string;
  profile_photo_url: string;
  zero_reason: string | null;
  score_breakdown: {
    zone: boolean;
    service: boolean;
    rating_bonus: number;
    urgency: boolean;
  };
}

const statusColors: Record<string, string> = {
  requested:    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  pending:      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  under_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  assigned:     "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  accepted:     "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  confirmed:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  in_progress:  "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  completed:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  declined:     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  disputed:     "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const formatDate = (iso: string, locale = 'fr', includeWeekday = false) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  if (locale === 'fr') {
    const opts: Intl.DateTimeFormatOptions = {
      ...(includeWeekday && { weekday: 'long' }),
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const datePart = d.toLocaleDateString('fr-FR', opts);
    const hasTime = iso.includes('T') || iso.includes(' ');
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const timePart = hasTime ? ` à ${hh}h${mm}` : '';
    return `${datePart}${timePart}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const SLUG_DISPLAY: Record<string, string> = {
  menage:         'Ménage',
  nettoyage:      'Nettoyage',
  cuisine:        'Cuisine',
  garde_enfants:  "Garde d'enfants",
  plomberie:      'Plomberie',
  electricite:    'Électricité',
  peinture:       'Peinture',
  jardinage:      'Jardinage',
  securite:       'Sécurité',
  bricolage:      'Bricolage',
  demenagement:   'Déménagement',
  baby_sitting:   'Baby-sitting',
};
const formatServiceSlug = (slug: string) =>
  SLUG_DISPLAY[slug?.toLowerCase().replace(/-/g, '_')] ?? slug;

const URGENCY_LABELS: Record<string, { fr: string; en: string }> = {
  normal:    { fr: 'Normal (3j+)',                    en: 'Normal (3+ days)' },
  under_24h: { fr: 'Moins de 24h (+15%)',             en: 'Under 24 hours (+15%)' },
  same_day:  { fr: "Express (aujourd'hui) (+25%)",    en: 'Same day (+25%)' },
};

const TIME_PREF_LABELS: Record<string, { fr: string; en: string }> = {
  anytime:   { fr: 'Flexible',               en: 'Anytime' },
  morning:   { fr: 'Matin (8h–12h)',          en: 'Morning (8am–12pm)' },
  afternoon: { fr: 'Après-midi (12h–17h)',    en: 'Afternoon (12pm–5pm)' },
  evening:   { fr: 'Soir (17h–21h, +10%)',   en: 'Evening (5pm–9pm, +10%)' },
};

const TIER_LABELS: Record<string, string> = {
  after_service: 'Paiement après service',
  deposit_30:    'Acompte 30%',
  deposit_40:    'Acompte 40%',
  full_prepay:   'Prépaiement intégral',
};

const CANCELLATION_LABELS: Record<string, string> = {
  full_refund:           'Remboursement intégral',
  provider_compensation: 'Acompte dû au prestataire',
  no_refund:             'Aucun remboursement',
};

const paymentColors: Record<string, string> = {
  unpaid: "bg-amber-100/50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  partial: "bg-orange-100/60 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  open: "bg-gray-100/60 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400",
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
  unpaid:   isFr ? 'Non payé'            : 'Unpaid',
  partial:  isFr ? 'Partiel'            : 'Partial',
  open:     isFr ? 'À encaisser'        : 'To collect',
  pending:  isFr ? 'Paiement en attente' : 'Payment Pending',
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

// adminFetch throws `Error("API error <code>: <path> — <body>")` where <body>
// is the raw JSON response. Extract the backend's { error } message so the UI
// can show the real reason (e.g. the locked-amount motif rule).
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

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  requested:    { fr: 'Demande reçue', en: 'Requested'   },
  pending:      { fr: 'En attente',    en: 'Pending'      },
  under_review: { fr: 'En examen',     en: 'Under review' },
  assigned:     { fr: 'Assignée',      en: 'Assigned'     },
  accepted:     { fr: 'Confirmée',     en: 'Confirmed'    },
  confirmed:    { fr: 'Confirmée',     en: 'Confirmed'    },
  in_progress:  { fr: 'En cours',      en: 'In progress'  },
  completed:    { fr: 'Terminée',      en: 'Completed'    },
  cancelled:    { fr: 'Annulée',       en: 'Cancelled'    },
  declined:     { fr: 'Refusée',       en: 'Declined'     },
  disputed:     { fr: 'En litige',     en: 'Disputed'     },
  pending_payment: { fr: 'En attente de paiement', en: 'Pending payment' },
  rescheduled:  { fr: 'Reprogrammée',  en: 'Rescheduled'  },
};

const getStatusLabel = (status: string, isFr: boolean): string =>
  STATUS_LABELS[status] ? STATUS_LABELS[status][isFr ? 'fr' : 'en'] : status;

const getStatusLabels = (isFr: boolean): Record<string, string> =>
  Object.fromEntries(Object.entries(STATUS_LABELS).map(([k, v]) => [k, v[isFr ? 'fr' : 'en']]));

// One row of the real backend history (GET /admin/bookings/<id> → events[]).
interface BookingEventItem {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string;
  actor_phone: string | null;
  note: string | null;
  created_at: string;
}

// Readable labels for every event_type the backend emits. An unknown type is
// NEVER hidden — the renderer falls back to the raw value (that silent masking
// is exactly what made the history invisible before).
const EVENT_LABELS: Record<string, { fr: string; en: string }> = {
  payment_declared:  { fr: "Paiement déclaré par le client", en: "Payment declared by client" },
  quote_accepted:    { fr: "Devis accepté par le client",    en: "Quote accepted by client" },
  amount_locked:     { fr: "Montant verrouillé",             en: "Amount locked" },
  quote_declined:    { fr: "Devis refusé par le client",     en: "Quote declined by client" },
  provider_assigned: { fr: "Prestataire assigné",            en: "Provider assigned" },
  started:           { fr: "Mission démarrée",               en: "Mission started" },
  completed:         { fr: "Mission terminée",               en: "Mission completed" },
  admin_cancel:      { fr: "Annulée par l'admin",            en: "Cancelled by admin" },
  final_amount_set:  { fr: "Montant final enregistré",       en: "Final amount recorded" },
  amount_unlocked:   { fr: "Montant déverrouillé (litige)",  en: "Amount unlocked (dispute)" },
  payment_confirmed: { fr: "Paiement confirmé",              en: "Payment confirmed" },
  payment_recorded:  { fr: "Versement enregistré",           en: "Payment recorded" },
  dispute_opened:    { fr: "Litige ouvert",                  en: "Dispute opened" },
  dispute_resolved:  { fr: "Litige résolu",                  en: "Dispute resolved" },
  status_changed:    { fr: "Statut modifié par l'admin",     en: "Status changed by admin" },
  rescheduled:       { fr: "Reprogrammée",                    en: "Rescheduled" },
  payment_instructions_sent: { fr: "Instructions de paiement envoyées", en: "Payment instructions sent" },
  provider_accepted: { fr: "Mission acceptée par le prestataire", en: "Mission accepted by provider" },
  provider_declined: { fr: "Mission refusée par le prestataire — à réassigner", en: "Mission declined by provider — reassign" },
};

function EventHistory({ events, loading, error, createdAt, isFr }: {
  events: BookingEventItem[];
  loading: boolean;
  error: boolean;
  createdAt: string;
  isFr: boolean;
}) {
  const title = isFr ? "Historique" : "History";

  if (loading) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isFr ? "Chargement de l'historique…" : "Loading history…"}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
        <p className="text-sm text-red-600 pl-2">
          {isFr
            ? "Impossible de charger l'historique de cette réservation."
            : "Couldn't load this booking's history."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
      <div className="space-y-3 pl-2 border-l-2 border-muted">
        <div className="relative pl-4">
          <div className="absolute -left-[9px] w-4 h-4 rounded-full bg-muted border-2 border-background" />
          <div className="text-sm">
            <span className="font-medium">{isFr ? "Créé" : "Created"}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {createdAt ? format(parseISO(createdAt), "MMM d, yyyy HH:mm") : ""}
            </span>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="relative pl-4">
            <p className="text-xs text-muted-foreground">
              {isFr ? "Aucun événement enregistré pour l'instant." : "No events recorded yet."}
            </p>
          </div>
        ) : (
          events.map((e, index) => {
            const label = EVENT_LABELS[e.event_type];
            // Unknown type → show the raw event_type, never hide it.
            const text = label ? label[isFr ? "fr" : "en"] : e.event_type;
            const isLast = index === events.length - 1;
            const isNegative = e.event_type === "admin_cancel" || e.event_type === "quote_declined" || e.event_type === "dispute_opened";
            return (
              <div key={e.id ?? index} className="relative pl-4">
                <div className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 border-background
                  ${isNegative ? "bg-red-500" : isLast ? "bg-blue-500" : "bg-emerald-500"}`} />
                <div className="text-sm">
                  <span className="font-medium">{text}</span>
                  {!label && (
                    <Badge variant="outline" className="ml-2 text-[10px]">{isFr ? "type inconnu" : "unknown type"}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">
                    {e.created_at ? format(parseISO(e.created_at), "MMM d, yyyy HH:mm") : ""}
                  </span>
                  {e.note && (
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{e.note}</p>
                  )}
                </div>
              </div>
            );
          })
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
  const { providers: liveProviders } = useAdminProviders();
  const { reviews } = useAdminStore();
  // Real services from the API — replaces the mock store as the engine's source.
  const { services: apiServices } = useAdminServices();

  const mapApiBooking = (b: ApiBooking): AdminBooking => ({
    id: String(b.id),
    clientName: b.client_name,
    clientEmail: "",
    clientPhone: b.client_phone,
    providerName: b.provider_name || "En attente",
    providerPhone: b.provider_phone || undefined,
    providerId: "",
    serviceId: b.service_id ?? null,
    serviceName: b.service_name,
    serviceCategory: b.service_slug,
    locale: b.locale === "en" ? "en" : "fr",   // graceful fallback to fr
    date: b.appointment_date,
    time: (() => {
      // Translate the slot to the active language (was forcing .fr, and the
      // time_slot branch showed the raw English value like "evening").
      const raw = (b.time_slot && b.time_slot !== "0") ? b.time_slot : (b.time_preference || "");
      return raw ? (TIME_PREF_LABELS[raw]?.[isFr ? "fr" : "en"] ?? raw) : "";
    })(),
    duration: "",
    status: ((b.status === "requested" ? "pending" : b.status) as AdminBooking["status"]) || "pending",
    price: b.amount_xof ?? 0,
    currency: "XOF",
    baseAmount: b.final_amount ?? b.amount_xof ?? 0,
    platformFeeAmount: b.shizu_commission ?? 0,
    providerPayoutAmount: b.provider_payout ?? 0,
    urgency: b.urgency as import("@/utils/pricingEngine").UrgencyLevel | undefined,
    timePreference: b.time_preference as import("@/utils/pricingEngine").TimePreference | undefined,
    paymentStatus: (b.payment_status as AdminBooking["paymentStatus"]) || "open",
    payoutStatus: (b.payout_status as AdminBooking["payoutStatus"]) || "not_due",
    collectionStatus: (b.collection_status as AdminBooking["collectionStatus"]) ?? undefined,
    amountCollected: b.amount_collected ?? undefined,
    amountDue: b.amount_due ?? undefined,
    overpaid: b.overpaid ?? undefined,
    address: b.client_location || "",
    // Zone slug derived from the commune in client_location (fixes the quote
    // engine always falling back to the default zone multiplier).
    zone: normalizeZone((b.client_location || "").split(",")[0]) || undefined,
    notes: b.notes || "",
    createdAt: b.created_at || "",
  });

  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  useEffect(() => {
    setBookings(apiBookings.map(mapApiBooking));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBookings]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);

  const updateLocalBooking = (id: string, patch: Partial<AdminBooking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    setSelectedBooking(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  };
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal states
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAllProviders, setShowAllProviders] = useState(false);

  // Inline assign state (for under_review rows)
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);
  const [inlineProviderName, setInlineProviderName] = useState("");
  const [inlineProviderPhone, setInlineProviderPhone] = useState("");
  const [inlineSelectedProviderId, setInlineSelectedProviderId] = useState("");

  const handleInlineProviderSelect = (providerId: string) => {
    setInlineSelectedProviderId(providerId);
    const p = eligibleProviders.find((p: ApiProvider) => String(p.id) === providerId);
    if (p) {
      setInlineProviderName(p.company_name || p.name || "");
      setInlineProviderPhone(p.phone_number || "");
    }
  };

  // Quote modal state
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteZone, setQuoteZone] = useState("");
  const [quoteUrgency, setQuoteUrgency] = useState<UrgencyLevel>("normal");
  const [quoteTimePreference, setQuoteTimePreference] = useState<TimePreference>("anytime");
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [pricingSuggestion, setPricingSuggestion] = useState<PricingSuggestion | null>(null);
  const [quoteJustifLoading, setQuoteJustifLoading] = useState(false);

  // Payment confirmation modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [finalAmountInput, setFinalAmountInput] = useState("");

  // Raw API row for the selected booking — carries amount_xof / amount_locked
  // which the mapped AdminBooking type doesn't expose.
  const rawSelected = selectedBooking
    ? apiBookings.find((x) => String(x.id) === selectedBooking.id)
    : undefined;
  const selAmountXof = rawSelected?.amount_xof ?? null;
  // Payment tier decides whether "assigned" may be confirmed without payment.
  // after_service (< 15 000) is paid AFTER the mission → a bare confirm is
  // legitimate. deposit_30 / full_prepay must be paid BEFORE → confirmation
  // only via "Mark payment received". If the tier is unknown, fall back to the
  // amount threshold; if that too is unknown, default to prepay (no bare confirm).
  const selTier = rawSelected?.payment_tier ?? null;
  const selIsAfterService = selTier
    ? selTier === 'after_service'
    : (selAmountXof != null && selAmountXof < 15000);

  // Amount lock state
  const [lockAmountInput, setLockAmountInput] = useState("");
  const [lockAmountSaving, setLockAmountSaving] = useState(false);
  const [amountLockedOverrides, setAmountLockedOverrides] = useState<Record<string, boolean>>({});

  // Dispute state
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeFlagOverrides, setDisputeFlagOverrides] = useState<Record<string, boolean>>({});

  // Payment instructions modal (consultation only — never mutates the booking)
  const [paymentInstructionsOpen, setPaymentInstructionsOpen] = useState(false);
  const [adminConfig, setAdminConfig] = useState<{ wave_number?: string; orange_number?: string; mtn_number?: string; whatsapp?: string; twilio_enabled?: boolean } | null>(null);
  const [sendingInstructions, setSendingInstructions] = useState(false);

  // Explicit "mark payment received" confirmation (financial action → confirm first)
  const [markPaidConfirmOpen, setMarkPaidConfirmOpen] = useState(false);

  // Dispute unlock (déverrouillage litige) — reason required, confirmed
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockSaving, setUnlockSaving] = useState(false);

  // Real BookingEvent history for the open booking (the list endpoint omits events)
  const [bookingEvents, setBookingEvents] = useState<BookingEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);

  // Reschedule modal state (admin-only date/slot change)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  // Load the real event history for a booking (reused by the drawer effect and
  // after mutations that don't change status/id, e.g. a reschedule).
  const loadBookingEvents = useCallback((bookingId: string | number) => {
    setEventsLoading(true);
    setEventsError(false);
    return adminApi.portalGetBookingDetail(bookingId)
      .then((data: { events?: BookingEventItem[] }) => {
        setBookingEvents(Array.isArray(data?.events) ? data.events : []);
      })
      .catch(() => { setEventsError(true); })
      .finally(() => { setEventsLoading(false); });
  }, []);

  // Fetch the real event history whenever a booking drawer opens.
  useEffect(() => {
    if (!selectedBooking?.id) {
      setBookingEvents([]);
      setEventsError(false);
      return;
    }
    loadBookingEvents(selectedBooking.id);
    // Re-fetch when the id changes or after mutations bump the local status.
  }, [selectedBooking?.id, selectedBooking?.status, loadBookingEvents]);

  const eligibleProviders = useMemo(() => {
    return liveProviders.filter((p: ApiProvider) =>
      p.verification_status === 'approved' && p.provider_status === 'active'
    );
  }, [liveProviders]);

  // Map booking id → urgency from raw API data (ApiBooking has urgency field)
  const urgencyMap = useMemo(() => {
    const m: Record<string, string> = {};
    apiBookings.forEach(b => { if (b.urgency) m[String(b.id)] = b.urgency; });
    return m;
  }, [apiBookings]);

  // Map booking id → amount_locked (merge API data with optimistic overrides)
  const amountLockedMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    apiBookings.forEach(b => { m[String(b.id)] = b.amount_locked ?? false; });
    return { ...m, ...amountLockedOverrides };
  }, [apiBookings, amountLockedOverrides]);

  // Load admin config (payment numbers) once on mount
  useEffect(() => {
    adminApi.portalGetConfig()
      .then((data) => setAdminConfig(data))
      .catch(() => {});
  }, []);

  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter((booking) => {
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
    // Urgent bookings always float to the top
    return filtered.sort((a, b) => {
      const aU = urgencyMap[a.id] === 'urgent_2h' ? 0 : 1;
      const bU = urgencyMap[b.id] === 'urgent_2h' ? 0 : 1;
      return aU - bU;
    });
  }, [bookings, searchQuery, statusFilter, urgencyMap]);

  const getReviewForBooking = (bookingId: string) => {
    return reviews.find(r => r.bookingId === bookingId);
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: AdminBooking["status"]) => {
    setIsUpdating(true);
    updateLocalBooking(bookingId, { status: newStatus });
    try {
      await adminApi.updateBookingStatus(Number(bookingId), newStatus);
      toast({
        title: isFr ? "Statut mis à jour" : "Status Updated",
        description: isFr
          ? `Réservation → ${statusLabels[newStatus] || newStatus}`
          : `Booking status changed to ${newStatus}.`,
        duration: 3000,
      });
    } catch (err) {
      console.error("Failed to update booking status:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de mettre à jour le statut." : "Couldn't update the status.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: string, extra?: { provider_name?: string; provider_phone?: string }) => {
    const patch: Partial<AdminBooking> = {
      status: newStatus as AdminBooking['status'],
      ...(extra?.provider_name ? { providerName: extra.provider_name, providerPhone: extra.provider_phone } : {}),
    };
    // Snapshot the fields the optimistic patch touches, to roll back on failure.
    const prevBooking = bookings.find((b) => b.id === bookingId);
    updateLocalBooking(bookingId, patch);
    try {
      if (newStatus === 'assigned' && extra?.provider_name) {
        await adminApi.assignBooking(Number(bookingId), extra.provider_name, extra.provider_phone || '');
      } else {
        await adminApi.updateBookingStatusPut(Number(bookingId), newStatus);
      }
      setAssigningBookingId(null);
      setInlineProviderName("");
      setInlineProviderPhone("");
      toast({ title: isFr ? "Statut mis à jour" : "Status Updated", description: `→ ${statusLabels[newStatus] || newStatus}` });
    } catch (err) {
      // Roll back the optimistic patch — status always, plus the provider fields
      // when the inline-assign path set them.
      if (prevBooking) {
        updateLocalBooking(bookingId, {
          status: prevBooking.status,
          ...(extra?.provider_name
            ? { providerName: prevBooking.providerName, providerPhone: prevBooking.providerPhone }
            : {}),
        });
      }
      console.error("handleStatusChange error:", err);
      // Any transition (assigned / confirmed / completed …) — show the backend's
      // explicit reason when it sends one, generic message otherwise.
      const backendMsg = extractApiError(err);
      toast({
        title: isFr ? "Erreur" : "Error",
        description: backendMsg || (isFr ? "Impossible de mettre à jour le statut." : "Couldn't update the status."),
        variant: "destructive",
      });
    }
  };

  const handleCancelWithReason = async () => {
    if (!selectedBooking || !cancelReason.trim()) return;
    setIsUpdating(true);
    const prevStatus = selectedBooking.status;
    updateLocalBooking(selectedBooking.id, { status: 'cancelled', cancellationReason: cancelReason, cancelledBy: 'admin' });
    setCancelModalOpen(false);
    const reasonSnapshot = cancelReason;
    setCancelReason("");
    try {
      await adminApi.portalCancelBooking(Number(selectedBooking.id), reasonSnapshot);
      toast({
        title: isFr ? "Réservation annulée" : "Booking Cancelled",
        description: isFr
          ? "La réservation a été annulée."
          : "The booking has been cancelled.",
        variant: "destructive",
      });
    } catch (err) {
      updateLocalBooking(selectedBooking.id, { status: prevStatus });
      console.error("Failed to cancel booking:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible d'annuler la réservation." : "Couldn't cancel the booking.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignProvider = async () => {
    if (!selectedBooking || !selectedProviderId) return;
    const provider = liveProviders.find((p: ApiProvider) => String(p.id) === selectedProviderId);
    const providerName = provider ? (provider.company_name || provider.name || selectedProviderId) : selectedProviderId;
    const providerPhone = provider?.phone_number || '';
    setIsUpdating(true);
    const prevStatus = selectedBooking.status;
    const prevProviderName = selectedBooking.providerName;
    updateLocalBooking(selectedBooking.id, { providerId: selectedProviderId, providerName, status: 'assigned' });
    setAssignModalOpen(false);
    setSelectedProviderId("");
    try {
      await adminApi.assignBooking(Number(selectedBooking.id), providerName, providerPhone);
      toast({
        title: isFr ? "Prestataire assigné" : "Provider Assigned",
        description: isFr
          ? `${providerName} a été assigné à cette réservation.`
          : `${providerName} has been assigned to this booking.`,
      });
    } catch (err) {
      updateLocalBooking(selectedBooking.id, { status: prevStatus, providerName: prevProviderName });
      console.error("Failed to assign provider:", err);
      // Surface the backend's explicit reason (invalid phone, provider not found
      // / not approved) instead of a silent no-op — same pattern as the other
      // handlers via extractApiError.
      const backendMsg = extractApiError(err);
      toast({
        title: isFr ? "Erreur" : "Error",
        description: backendMsg || (isFr ? "Impossible d'assigner le prestataire." : "Couldn't assign the provider."),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignFromRec = async (rec: AIRecommendation) => {
    if (!selectedBooking) return;
    setIsUpdating(true);
    const prevStatus = selectedBooking.status;
    const prevProviderName = selectedBooking.providerName;
    updateLocalBooking(selectedBooking.id, {
      providerId: String(rec.provider_id),
      providerName: rec.name,
      status: 'assigned',
    });
    setAssignModalOpen(false);
    try {
      await adminApi.assignBooking(Number(selectedBooking.id), rec.name, rec.phone);
      toast({
        title: isFr ? "Prestataire assigné" : "Provider Assigned",
        description: isFr
          ? `${rec.name} a été assigné à cette réservation.`
          : `${rec.name} has been assigned to this booking.`,
      });
    } catch (err) {
      updateLocalBooking(selectedBooking.id, { status: prevStatus, providerName: prevProviderName });
      console.error("Failed to assign provider:", err);
      // Surface the backend's explicit reason (invalid phone, provider not found
      // / not approved) instead of a silent no-op — same pattern as the other
      // handlers via extractApiError.
      const backendMsg = extractApiError(err);
      toast({
        title: isFr ? "Erreur" : "Error",
        description: backendMsg || (isFr ? "Impossible d'assigner le prestataire." : "Couldn't assign the provider."),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!selectedBooking || !['confirmed', 'assigned', 'in_progress'].includes(selectedBooking.status)) return;
    setIsUpdating(true);
    const prevStatus = selectedBooking.status;
    // Do NOT flip payout_status locally: the backend does not set it 'due' on
    // completion (a payout is only due once payment_status='paid'). Claiming it
    // here would diverge from the server and the finance page.
    updateLocalBooking(selectedBooking.id, { status: 'completed' });
    try {
      await adminApi.updateBookingStatusPut(Number(selectedBooking.id), 'completed');
      toast({
        title: isFr ? "Réservation terminée" : "Booking Completed",
        description: isFr
          ? "La réservation est marquée comme terminée."
          : "The booking has been marked as completed.",
        duration: 3000,
      });
    } catch (err) {
      updateLocalBooking(selectedBooking.id, { status: prevStatus });
      console.error("Failed to complete booking:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de terminer la réservation." : "Couldn't complete the booking.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const openPaymentModal = () => {
    if (!selectedBooking || selectedBooking.status === 'cancelled' || (selectedBooking.collectionStatus ?? selectedBooking.paymentStatus) === 'paid') return;
    // Pre-fill: final_amount (if already set) → baseAmount (= amount_xof quoted price) → 0
    // Pre-fill with the remaining balance due (falls back to the booking amount
    // for legacy rows that don't expose amountDue).
    const prefill = selectedBooking.amountDue
      ?? (selectedBooking.baseAmount > 0
        ? selectedBooking.baseAmount
        : selectedBooking.price > 0 ? selectedBooking.price : 0);
    setFinalAmountInput(prefill > 0 ? String(prefill) : "");
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedBooking || !finalAmountInput || Number(finalAmountInput) <= 0) return;
    const amount = Math.round(Number(finalAmountInput));
    setIsUpdating(true);
    const prevCollected = selectedBooking.amountCollected ?? 0;
    const prevStatus = selectedBooking.status;
    const prevCollectionStatus = selectedBooking.collectionStatus;
    // Optimistic: reflect the added amount now; the response is authoritative.
    updateLocalBooking(selectedBooking.id, {
      amountCollected: prevCollected + amount,
      ...(prevCollected === 0 ? { status: 'confirmed' as AdminBooking['status'] } : {}),
    });
    setPaymentModalOpen(false);
    try {
      const res: {
        amount_collected?: number; amount_due?: number; overpaid?: number;
        collection_status?: string; status?: string; payment_status?: string;
      } = await adminApi.portalConfirmPayment(Number(selectedBooking.id), amount);
      updateLocalBooking(selectedBooking.id, {
        amountCollected: res?.amount_collected ?? prevCollected + amount,
        amountDue: res?.amount_due,
        collectionStatus: res?.collection_status as AdminBooking['collectionStatus'],
        overpaid: res?.overpaid,
        status: (res?.status as AdminBooking['status']) ?? selectedBooking.status,
        paymentStatus: (res?.payment_status as AdminBooking['paymentStatus']) ?? selectedBooking.paymentStatus,
      });
      toast({
        title: isFr ? "Versement enregistré" : "Payment Recorded",
        description: isFr
          ? `Versement de ${formatMoney(amount, 'XOF')} enregistré.`
          : `Payment of ${formatMoney(amount, 'XOF')} has been recorded.`,
        duration: 3000,
      });
    } catch (err) {
      updateLocalBooking(selectedBooking.id, {
        amountCollected: prevCollected, status: prevStatus, collectionStatus: prevCollectionStatus,
      });
      console.error("Failed to record payment:", err);
      // Re-open the modal so the admin can act on the backend's message.
      setPaymentModalOpen(true);
      const backendMsg = extractApiError(err);
      toast({
        title: isFr ? "Erreur" : "Error",
        description: backendMsg || (isFr ? "Impossible d'enregistrer le paiement." : "Couldn't record the payment."),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openCancelModal = () => {
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const openRescheduleModal = () => {
    if (!selectedBooking) return;
    // Pre-fill the date input (yyyy-mm-dd) from the current appointment date.
    const raw = rawSelected?.appointment_date;
    setRescheduleDate(raw ? raw.slice(0, 10) : "");
    setRescheduleSlot(rawSelected?.time_slot || rawSelected?.time_preference || "");
    setRescheduleReason("");
    setRescheduleModalOpen(true);
  };

  const handleRescheduleBooking = async () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleReason.trim()) return;
    // Send the date at midday to avoid TZ edge cases pushing it to the day before.
    const iso = `${rescheduleDate}T12:00:00`;
    setRescheduleSaving(true);
    try {
      const res = await adminApi.portalRescheduleBooking(Number(selectedBooking.id), {
        appointment_date: iso,
        time_slot: rescheduleSlot || undefined,
        reason: rescheduleReason.trim(),
      }) as { appointment_date?: string };
      // Reflect the new date locally and refresh the event history.
      updateLocalBooking(selectedBooking.id, {
        date: res?.appointment_date || iso,
        ...(rescheduleSlot ? { timePreference: rescheduleSlot as TimePreference } : {}),
      });
      await loadBookingEvents(selectedBooking.id);
      setRescheduleModalOpen(false);
      toast({ title: isFr ? "Réservation reprogrammée" : "Booking rescheduled" });
    } catch (err) {
      const backendMsg = extractApiError(err);
      toast({
        title: isFr ? "Erreur" : "Error",
        description: backendMsg || (isFr ? "Impossible de reprogrammer la réservation." : "Couldn't reschedule the booking."),
        variant: "destructive",
      });
    } finally {
      setRescheduleSaving(false);
    }
  };

  const openAssignModal = () => {
    setSelectedProviderId(selectedBooking?.providerId || "");
    setShowAllProviders(false);
    setAiRecommendations([]);
    setAssignModalOpen(true);
    if (selectedBooking) {
      setAiLoading(true);
      adminApi.getRecommendations(Number(selectedBooking.id))
        .then((data: { recommendations: AIRecommendation[] }) =>
          setAiRecommendations(data?.recommendations ?? []))
        .catch(() => setAiRecommendations([]))
        .finally(() => setAiLoading(false));
    }
  };

  // Suggest a quote from REAL data:
  //   basePrice = service.base_price || category_price_min || 0  (else no suggestion)
  //   maxCap    = category_price_max  (skipped when the category is quote-based)
  // The engine only SUGGESTS — the admin can always override the value.
  // Match a booking to its real API service — by service_id (robust), then
  // name, then category label. Shared by the engine and the over-cap warning.
  const resolveServiceForBooking = (booking: AdminBooking): ApiService | undefined =>
    (booking.serviceId != null ? apiServices.find(s => s.id === booking.serviceId) : undefined) ||
    apiServices.find(s => s.name?.toLowerCase() === (booking.serviceName || "").toLowerCase()) ||
    apiServices.find(s => (s.category || "").toLowerCase() === (booking.serviceCategory || "").toLowerCase());

  const computeSuggestion = (
    booking: AdminBooking,
    zone: string | undefined,
    urgency: UrgencyLevel,
    timePreference: TimePreference,
  ): PricingSuggestion | null => {
    const svc = resolveServiceForBooking(booking);
    if (!svc) return null;

    const basePrice = svc.base_price || svc.category_price_min || 0;
    if (!basePrice) return null; // both null → no suggestion, field stays empty

    const rules = { ...DEFAULT_PRICING_RULES };
    // Bound the suggestion to the category range — but a quote-based category
    // promises nothing, so it gets neither floor nor cap.
    if (!svc.category_is_quote_based) {
      if (svc.category_price_min != null) rules.minFloor = svc.category_price_min;
      if (svc.category_price_max != null) rules.maxCap = svc.category_price_max;
    }
    return getPricingSuggestion({ basePrice, pricingRules: rules }, { zone, urgency, timePreference });
  };

  const openQuoteModal = () => {
    if (selectedBooking) {
      setQuoteZone(selectedBooking.zone || "");
      setQuoteUrgency(selectedBooking.urgency || "normal");
      setQuoteTimePreference(selectedBooking.timePreference || "anytime");
      setQuoteNote("");

      const suggestion = computeSuggestion(
        selectedBooking,
        selectedBooking.zone,
        selectedBooking.urgency || "normal",
        selectedBooking.timePreference || "anytime",
      );
      setPricingSuggestion(suggestion);
      setQuotePrice(suggestion ? suggestion.suggestedQuote.toString() : "");
    }
    setQuoteModalOpen(true);
  };

  const handleLockAmount = async () => {
    if (!selectedBooking || !lockAmountInput || Number(lockAmountInput) <= 0) return;
    setLockAmountSaving(true);
    try {
      await adminApi.portalLockAmount(Number(selectedBooking.id), Number(lockAmountInput));
      setAmountLockedOverrides(prev => ({ ...prev, [selectedBooking.id]: true }));
      updateLocalBooking(selectedBooking.id, { baseAmount: Number(lockAmountInput), price: Number(lockAmountInput) });
      setLockAmountInput("");
      toast({ title: isFr ? "Montant verrouillé" : "Amount Locked", description: `${Number(lockAmountInput).toLocaleString('fr-FR')} FCFA confirmé.` });
    } catch {
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de verrouiller le montant." : "Couldn't lock the amount.", variant: "destructive" });
    } finally {
      setLockAmountSaving(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!selectedBooking || !disputeReason.trim()) return;
    setIsUpdating(true);
    try {
      await adminApi.portalOpenDispute(Number(selectedBooking.id), disputeReason);
      setDisputeFlagOverrides(prev => ({ ...prev, [selectedBooking.id]: true }));
      updateLocalBooking(selectedBooking.id, { status: 'cancelled' }); // mark as non-actionable locally
      setDisputeModalOpen(false);
      setDisputeReason("");
      toast({ title: isFr ? "Litige ouvert" : "Dispute Opened", variant: "destructive" });
    } catch {
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible d'ouvrir le litige." : "Couldn't open the dispute.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResolveDispute = async (resolution: string) => {
    if (!selectedBooking) return;
    setIsUpdating(true);
    try {
      await adminApi.portalResolveDispute(Number(selectedBooking.id), resolution);
      setDisputeFlagOverrides(prev => ({ ...prev, [selectedBooking.id]: false }));
      toast({ title: isFr ? "Litige résolu" : "Dispute Resolved" });
    } catch {
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de résoudre le litige." : "Couldn't resolve the dispute.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  // Explicit financial action: records that the client's payment was actually
  // received (marks paid + confirms the booking). Confirmed via a dialog first.
  const handleMarkPaymentReceived = async () => {
    if (!selectedBooking) return;
    setIsUpdating(true);
    const prevPaymentStatus = selectedBooking.paymentStatus;
    const prevStatus = selectedBooking.status;
    updateLocalBooking(selectedBooking.id, { paymentStatus: 'paid', status: 'confirmed' });
    setMarkPaidConfirmOpen(false);
    try {
      await adminApi.portalConfirmPayment(Number(selectedBooking.id));
      toast({ title: isFr ? "Paiement marqué comme reçu" : "Payment marked as received" });
    } catch (err) {
      updateLocalBooking(selectedBooking.id, { paymentStatus: prevPaymentStatus, status: prevStatus });
      console.error("Failed to confirm payment:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible d'enregistrer le paiement." : "Couldn't record the payment.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  // Send payment instructions to the client (WhatsApp). Read-only on the booking.
  const handleSendPaymentInstructionsToClient = async () => {
    if (!selectedBooking) return;
    setSendingInstructions(true);
    try {
      const res = await adminApi.portalSendPaymentInstructions(Number(selectedBooking.id)) as { sent?: boolean };
      if (res?.sent) {
        await loadBookingEvents(selectedBooking.id);
        toast({ title: isFr ? "Instructions envoyées" : "Instructions sent",
                description: isFr ? "Le client a reçu les instructions de paiement." : "The client received the payment instructions." });
      } else {
        // Backend returned a non-sent result without throwing — report honestly.
        toast({ title: isFr ? "Non envoyé" : "Not sent",
                description: isFr ? "Le message n'a pas pu être envoyé." : "The message could not be sent.",
                variant: "destructive" });
      }
    } catch (err) {
      const backendMsg = extractApiError(err);
      toast({ title: isFr ? "Échec de l'envoi" : "Send failed",
              description: backendMsg || (isFr ? "Impossible d'envoyer les instructions." : "Couldn't send the instructions."),
              variant: "destructive" });
    } finally {
      setSendingInstructions(false);
    }
  };

  // Dispute-only: unlock the client-accepted (locked) amount. Reason required.
  const handleUnlockAmount = async () => {
    if (!selectedBooking || !unlockReason.trim()) return;
    setUnlockSaving(true);
    try {
      await adminApi.portalUnlockAmount(Number(selectedBooking.id), unlockReason.trim());
      setAmountLockedOverrides(prev => ({ ...prev, [selectedBooking.id]: false }));
      setUnlockModalOpen(false);
      setUnlockReason("");
      toast({ title: isFr ? "Montant déverrouillé" : "Amount unlocked" });
    } catch (err) {
      const backendMsg = extractApiError(err);
      toast({
        title: isFr ? "Erreur" : "Error",
        description: backendMsg || (isFr ? "Impossible de déverrouiller le montant." : "Couldn't unlock the amount."),
        variant: "destructive",
      });
    } finally {
      setUnlockSaving(false);
    }
  };

  const handleQuoteInputChange = (field: 'zone' | 'urgency' | 'timePreference', value: string) => {
    const newZone = field === 'zone' ? value : quoteZone;
    const newUrgency = field === 'urgency' ? value as UrgencyLevel : quoteUrgency;
    const newTimePreference = field === 'timePreference' ? value as TimePreference : quoteTimePreference;
    
    if (field === 'zone') setQuoteZone(value);
    if (field === 'urgency') setQuoteUrgency(value as UrgencyLevel);
    if (field === 'timePreference') setQuoteTimePreference(value as TimePreference);

    if (selectedBooking) {
      const suggestion = computeSuggestion(selectedBooking, newZone, newUrgency, newTimePreference);
      if (suggestion) {
        setPricingSuggestion(suggestion);
        setQuotePrice(suggestion.suggestedQuote.toString());
      }
    }
  };

  // AI: generate a short client-facing note explaining an over-cap quote.
  // Reuses the existing Anthropic plumbing (Next.js route, like improve-bio).
  // Pre-fills the editable Note field — never auto-sent; fails gracefully.
  const handleGenerateJustification = async () => {
    if (!selectedBooking) return;
    const svc = resolveServiceForBooking(selectedBooking);
    setQuoteJustifLoading(true);
    try {
      const res = await fetch("/api/quote-justification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: selectedBooking.serviceName,
          category: svc?.category ?? selectedBooking.serviceCategory,
          rangeMin: svc?.category_price_min ?? null,
          rangeMax: svc?.category_price_max ?? null,
          amount: Number(quotePrice),
          commune: (selectedBooking.address || "").split(",")[0].trim(),
          urgency: quoteUrgency,
          timePreference: quoteTimePreference,
          description: selectedBooking.notes || "",
          // Client-facing note → generated in the CLIENT's language, not the admin's.
          locale: selectedBooking.locale === "en" ? "en" : "fr",
        }),
      });
      const data = await res.json();
      if (data?.note) {
        setQuoteNote(data.note);
      } else {
        toast({ title: isFr ? "Génération indisponible" : "Generation unavailable", description: isFr ? "Rédigez la note à la main." : "Please write the note manually." });
      }
    } catch {
      toast({ title: isFr ? "Génération indisponible" : "Generation unavailable", description: isFr ? "Rédigez la note à la main." : "Please write the note manually." });
    } finally {
      setQuoteJustifLoading(false);
    }
  };

  const handleSendQuote = async () => {
    if (!selectedBooking || !quotePrice || Number(quotePrice) <= 0) {
      toast({
        title: isFr ? "Devis invalide" : "Invalid Quote",
        description: isFr ? "Veuillez saisir un prix valide." : "Please enter a valid price.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await adminApi.portalSetBookingQuote(selectedBooking.id, Number(quotePrice), quoteNote);
      setSelectedBooking(prev => prev ? {
        ...prev,
        zone: quoteZone,
        urgency: quoteUrgency,
        timePreference: quoteTimePreference,
        quotedPrice: Number(quotePrice),
        price: Number(quotePrice),
        baseAmount: Number(quotePrice),
        quoteNote,
        quoteStatus: 'sent',
        pricingSuggestion: pricingSuggestion || undefined,
      } : null);
      toast({
        title: isFr ? "Devis enregistré" : "Quote Saved",
        description: isFr
          ? `Devis de ${formatMoney(Number(quotePrice), 'XOF')} enregistré.`
          : `Quote of ${formatMoney(Number(quotePrice), 'XOF')} has been saved to the booking.`,
      });
      setQuoteModalOpen(false);
    } catch (err) {
      console.error("Failed to save quote:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible d'enregistrer le devis." : "Failed to save quote.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminLayout title={isFr ? "Réservations" : "Bookings"}>
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isFr ? "Rechercher par client, prestataire ou service..." : "Search by client, provider, or service..."}
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
                    {status === "all" ? (isFr ? "Tous" : "All") : getStatusLabel(status, isFr)}
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
              {isFr ? "Réservations" : "Bookings"} ({filteredBookings.length})
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
                          {formatDate(booking.date, isFr ? 'fr' : 'en')} • {formatMoney(booking.price, booking.currency)}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-sm truncate">{booking.providerName}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(booking.price, booking.currency)}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-sm">{formatDate(booking.date, isFr ? 'fr' : 'en')}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(booking.createdAt, isFr ? 'fr' : 'en')}</p>
                      </div>
                      <div className="flex items-center gap-1 sm:justify-end flex-wrap">
                        {urgencyMap[booking.id] === 'urgent_2h' && (
                          <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            ⚡ {isFr ? "Urgent" : "Urgent"}
                          </Badge>
                        )}
                        <Badge className={`text-xs ${statusColors[booking.status] || statusColors.pending}`}>
                          {statusLabels[booking.status] || booking.status}
                        </Badge>
                        <Badge className={`text-xs ${paymentColors[booking.collectionStatus ?? booking.paymentStatus]}`}>
                          {paymentStatusLabels[booking.collectionStatus ?? booking.paymentStatus]}
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
                          {isFr ? "Examiner" : "Review"}
                        </button>
                      )}
                      {booking.status === 'under_review' && (
                        <>
                          {!amountLockedMap[booking.id] ? (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded flex items-center gap-1">
                              <LockOpen className="h-3 w-3" />
                              {isFr ? "Confirmez le montant avant d'assigner" : "Confirm amount before assigning"}
                            </span>
                          ) : assigningBookingId === booking.id ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              <Select
                                value={inlineSelectedProviderId}
                                onValueChange={handleInlineProviderSelect}
                              >
                                <SelectTrigger className="h-7 text-xs w-52">
                                  <SelectValue placeholder={isFr ? "Choisir un prestataire…" : "Choose provider…"} />
                                </SelectTrigger>
                                <SelectContent className="z-50">
                                  {eligibleProviders.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                      {isFr ? "Aucun prestataire approuvé" : "No approved providers"}
                                    </div>
                                  ) : eligibleProviders.map((p: ApiProvider) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                      {p.company_name || p.name || `#${p.id}`}
                                      {p.phone_number ? ` · ${p.phone_number}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                                disabled={!inlineProviderName.trim()}
                                onClick={() => handleStatusChange(booking.id, 'assigned', { provider_name: inlineProviderName, provider_phone: inlineProviderPhone })}
                              >
                                {isFr ? "Assigner" : "Assign"}
                              </button>
                              <button
                                className="text-xs text-muted-foreground px-2 py-1 rounded border hover:bg-muted"
                                onClick={() => { setAssigningBookingId(null); setInlineSelectedProviderId(""); }}
                              >
                                {isFr ? "Annuler" : "Cancel"}
                              </button>
                            </div>
                          ) : (
                            <button
                              className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600"
                              onClick={() => { setAssigningBookingId(booking.id); setInlineProviderName(""); setInlineProviderPhone(""); }}
                            >
                              {isFr ? "Assigner prestataire" : "Assign provider"}
                            </button>
                          )}
                        </>
                      )}
                      {booking.status === 'assigned' && (
                        <button
                          className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                          onClick={() => handleStatusChange(booking.id, 'confirmed')}
                        >
                          {isFr ? "Confirmer" : "Confirm"}
                        </button>
                      )}
                      {booking.status === 'confirmed' && (
                        <button
                          className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                          onClick={() => handleStatusChange(booking.id, 'completed')}
                        >
                          {isFr ? "Terminé" : "Complete"}
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
              {/* Real event history from the backend (replaces the hard-coded
                  fictional timeline — see EventHistory / portalGetBookingDetail). */}
              <EventHistory
                events={bookingEvents}
                loading={eventsLoading}
                error={eventsError}
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
                        {getStatusLabel(selectedBooking.status, isFr)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{isFr ? "Paiement\u00a0:" : "Payment:"}</span>
                      <Badge className={`${paymentColors[selectedBooking.collectionStatus ?? selectedBooking.paymentStatus]}`}>
                        {paymentStatusLabels[selectedBooking.collectionStatus ?? selectedBooking.paymentStatus]}
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
                
                {/* Fee Breakdown — commission/payout are computed on final_amount
                    when it exists. Show quote AND final separately when they
                    differ, so the lines always reconcile with the base used. */}
                {(() => {
                  const qAmt = rawSelected?.amount_xof ?? null;                 // accepted quote
                  const fAmt = rawSelected?.final_amount ?? null;               // real final amount
                  const commission = rawSelected?.shizu_commission ?? selectedBooking.platformFeeAmount;
                  const payout = rawSelected?.provider_payout ?? selectedBooking.providerPayoutAmount;
                  const hasFinalDiff = fAmt != null && qAmt != null && fAmt !== qAmt;
                  const cur = selectedBooking.currency;
                  return (
                    <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded-md p-2">
                      {hasFinalDiff ? (
                        <>
                          <div className="flex justify-between">
                            <span>{isFr ? "Devis accepté" : "Accepted quote"}</span>
                            <span>{formatMoney(qAmt!, cur)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-foreground">
                            <span>{isFr ? "Montant final" : "Final amount"}</span>
                            <span>{formatMoney(fAmt!, cur)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span>{isFr ? "Montant du devis" : "Quoted Amount"}</span>
                          <span>{formatMoney(fAmt ?? qAmt ?? selectedBooking.price, cur)}</span>
                        </div>
                      )}
                      {commission > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span>{isFr ? "Commission Shizu (15%)" : "Shizu Commission (15%)"}</span>
                            <span>{formatMoney(commission, cur)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-foreground">
                            <span>{isFr ? "Versement prestataire (85%)" : "Provider Payout (85%)"}</span>
                            <span>{formatMoney(payout, cur)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Montant & Paiement */}
              {(() => {
                const rawBooking = apiBookings.find(b => String(b.id) === selectedBooking.id);
                const isLocked = amountLockedMap[selectedBooking.id] ?? false;
                const hasDispute = disputeFlagOverrides[selectedBooking.id] ?? rawBooking?.dispute_flag ?? false;
                // A dispute is resolved once a resolution (or its timestamp) is
                // recorded — even if dispute_flag is still set.
                const disputeResolved = !!(rawBooking?.dispute_resolution || rawBooking?.dispute_resolved_at);
                const DISPUTE_RESOLUTION_LABELS: Record<string, { fr: string; en: string }> = {
                  refund_client:    { fr: "Remboursement client", en: "Client refunded" },
                  release_provider: { fr: "Prestataire payé",     en: "Provider released" },
                  split:            { fr: "Partagé",              en: "Split" },
                };
                const isClosed = ['cancelled', 'completed'].includes(selectedBooking.status);
                return (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                      {isLocked ? <Lock className="h-3.5 w-3.5 text-emerald-600" /> : <LockOpen className="h-3.5 w-3.5 text-amber-500" />}
                      {isFr ? "Montant & Paiement" : "Amount & Payment"}
                    </h4>

                    {/* Dispute banner — resolved state (neutral/green) */}
                    {hasDispute && disputeResolved && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-md p-3 space-y-1">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          {isFr ? "Litige résolu" : "Dispute resolved"}
                        </p>
                        {rawBooking?.dispute_reason && (
                          <p className="text-xs text-muted-foreground">{rawBooking.dispute_reason}</p>
                        )}
                        {rawBooking?.dispute_resolution && (
                          <p className="text-xs text-muted-foreground">
                            {isFr ? "Résolution :" : "Resolution:"}{" "}
                            {DISPUTE_RESOLUTION_LABELS[rawBooking.dispute_resolution]?.[isFr ? "fr" : "en"] ?? rawBooking.dispute_resolution}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Dispute banner — open state (alarming red, with resolve actions) */}
                    {hasDispute && !disputeResolved && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-2">
                        <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          ⚠ {isFr ? "Litige ouvert" : "Dispute Open"}
                        </p>
                        {rawBooking?.dispute_reason && (
                          <p className="text-xs text-red-600">{rawBooking.dispute_reason}</p>
                        )}
                        {!rawBooking?.dispute_resolution && (
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" className="text-xs h-7 border-red-300 text-red-700"
                              disabled={isUpdating}
                              onClick={() => handleResolveDispute('refund_client')}>
                              {isFr ? "Rembourser client" : "Refund client"}
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-7 border-red-300 text-red-700"
                              disabled={isUpdating}
                              onClick={() => handleResolveDispute('release_provider')}>
                              {isFr ? "Libérer prestataire" : "Release provider"}
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-7 border-red-300 text-red-700"
                              disabled={isUpdating}
                              onClick={() => handleResolveDispute('split')}>
                              {isFr ? "Partager" : "Split"}
                            </Button>
                          </div>
                        )}
                        {rawBooking?.dispute_resolution && (
                          <p className="text-xs text-muted-foreground">
                            {isFr ? "Résolution :" : "Resolution:"} {rawBooking.dispute_resolution}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Amount lock — FALLBACK only: acceptance via the WhatsApp
                        magic link auto-locks. This manual path is for off-app
                        confirmation. Kept visually discreet (not the main step). */}
                    {!isLocked && !isClosed && (
                      <div className="border border-gray-200 rounded-md p-3 space-y-2">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {isFr
                            ? "L'acceptation via le lien WhatsApp verrouille le montant automatiquement. N'utilisez ceci que si le client a confirmé par un autre canal (appel, WhatsApp direct)."
                            : "Acceptance via the WhatsApp link auto-locks the amount. Use this only if the client confirmed through another channel (call, direct WhatsApp)."}
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={isFr ? "Montant en FCFA" : "Amount in FCFA"}
                            value={lockAmountInput}
                            onChange={e => setLockAmountInput(e.target.value)}
                            className="flex-1 h-8 text-sm"
                          />
                          <Button size="sm" variant="outline" onClick={handleLockAmount}
                            disabled={!lockAmountInput || Number(lockAmountInput) <= 0 || lockAmountSaving}>
                            {lockAmountSaving
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Lock className="h-3 w-3" />}
                            {isFr ? "Confirmer l'acceptation (hors app)" : "Confirm acceptance (off-app)"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Locked state — badges */}
                    {isLocked && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                          <Lock className="h-3 w-3" />
                          {isFr ? "Montant confirmé" : "Amount confirmed"}
                        </Badge>
                        {rawBooking?.payment_tier && (
                          <Badge variant="outline" className="text-xs">
                            {TIER_LABELS[rawBooking.payment_tier] ?? rawBooking.payment_tier}
                          </Badge>
                        )}
                        {rawBooking?.cancellation_policy && (
                          <Badge variant="outline" className="text-xs">
                            {CANCELLATION_LABELS[rawBooking.cancellation_policy] ?? rawBooking.cancellation_policy}
                          </Badge>
                        )}
                      </div>
                    )}
                    {isLocked && rawBooking?.deposit_amount != null && rawBooking.deposit_amount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {isFr ? "Acompte dû :" : "Deposit due:"}{" "}
                        {new Intl.NumberFormat('fr-FR').format(rawBooking.deposit_amount)} FCFA
                      </p>
                    )}

                    {/* Payment: two clearly separated intents.
                        (1) Consultation — show the Mobile Money numbers, no effect.
                        (2) Financial action — mark the money as actually received. */}
                    {isLocked && (selectedBooking.collectionStatus ?? selectedBooking.paymentStatus) !== 'paid' && !isClosed && (
                      <div className="space-y-2">
                        <Button variant="outline" size="sm" className="w-full"
                          onClick={() => setPaymentInstructionsOpen(true)}>
                          <Eye className="h-3.5 w-3.5 mr-2" />
                          {isFr ? "Voir les instructions de paiement" : "View payment instructions"}
                        </Button>
                        <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setMarkPaidConfirmOpen(true)}>
                          <Banknote className="h-3.5 w-3.5 mr-2" />
                          {isFr ? "Marquer le paiement comme reçu" : "Mark payment as received"}
                        </Button>
                      </div>
                    )}

                    {/* Dispute-only: unlock the client-accepted amount. Visible whenever
                        the amount is locked. Requires a reason + explicit confirmation. */}
                    {isLocked && (
                      <Button variant="outline" size="sm"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => { setUnlockReason(""); setUnlockModalOpen(true); }}>
                        <LockOpen className="h-3.5 w-3.5 mr-2" />
                        {isFr ? "Déverrouiller le montant (litige)" : "Unlock amount (dispute)"}
                      </Button>
                    )}

                    {/* Open dispute button */}
                    {!hasDispute && ['confirmed', 'in_progress', 'completed'].includes(selectedBooking.status) && (
                      <Button variant="outline" size="sm"
                        className="w-full border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => { setDisputeReason(""); setDisputeModalOpen(true); }}>
                        <AlertCircle className="h-3.5 w-3.5 mr-2" />
                        {isFr ? "Ouvrir un litige" : "Open dispute"}
                      </Button>
                    )}
                  </div>
                );
              })()}

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
                <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Prestataire" : "Provider"}</h4>
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
                  <Badge variant="outline" className="text-xs">{formatServiceSlug(selectedBooking.serviceCategory)}</Badge>
                </div>
              </div>

              {/* Schedule & Location */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Horaire & Lieu" : "Schedule & Location"}</h4>
                <div className="space-y-2">
                  {/* Urgency badge */}
                  {urgencyMap[selectedBooking.id] && (
                    <div className="flex items-center gap-2">
                      {urgencyMap[selectedBooking.id] === 'urgent_2h' ? (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {isFr ? "⚡ Urgence — 2h" : "⚡ Urgent — 2h"}
                        </Badge>
                      ) : urgencyMap[selectedBooking.id] === 'same_day' ? (
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          {isFr ? "Aujourd'hui" : "Same Day"}
                        </Badge>
                      ) : urgencyMap[selectedBooking.id] === 'under_24h' ? (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {isFr ? "Moins de 24h" : "Under 24h"}
                        </Badge>
                      ) : null}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(selectedBooking.date, isFr ? 'fr' : 'en', true)}</span>
                  </div>
                  {/* Time preference */}
                  {selectedBooking.timePreference && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{TIME_PREF_LABELS[selectedBooking.timePreference]?.[isFr ? 'fr' : 'en'] ?? selectedBooking.timePreference}</span>
                    </div>
                  )}
                  {selectedBooking.time && !selectedBooking.timePreference && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedBooking.time}</span>
                    </div>
                  )}
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
                  <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Notes du client" : "Client Notes"}</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-md">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Cancellation Info */}
              {selectedBooking.status === 'cancelled' && selectedBooking.cancellationReason && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    {isFr ? "Détails de l'annulation" : "Cancellation Details"}
                  </h4>
                  <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md space-y-1">
                    <p className="text-sm">{selectedBooking.cancellationReason}</p>
                    {selectedBooking.cancelledBy && (
                      <p className="text-xs text-muted-foreground">
                        {isFr ? "Annulé par\u00a0:" : "Cancelled by:"} {selectedBooking.cancelledBy}
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
                    {isFr ? "Avis client" : "Review"}
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
                      <p className="text-sm text-muted-foreground italic">{isFr ? "Aucun avis pour l'instant" : "No review yet"}</p>
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

                {/* Reschedule — available on any non-terminal status. Changes only
                    the date/slot; amount, lock and assigned provider are kept. */}
                {!['completed', 'cancelled', 'declined'].includes(selectedBooking.status) && (
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
                )}

                {/* Quote status info for pending bookings */}
                {selectedBooking.status === 'pending' && selectedBooking.quoteStatus !== 'accepted' && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md space-y-1">
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {selectedBooking.quoteStatus === 'sent'
                        ? (isFr ? "Devis envoyé — en attente d'approbation client…" : 'Quote sent — waiting for client approval before payment can be recorded.')
                        : (isFr ? "Envoyez un devis au client. Le paiement ne peut être enregistré qu'après acceptation." : 'Send a quote to the client. Payment cannot be recorded until quote is accepted.')}
                    </p>
                  </div>
                )}

                {/* Payment Actions - show for unpaid non-cancelled bookings with accepted quote */}
                {(selectedBooking.collectionStatus ?? selectedBooking.paymentStatus) !== 'paid' && selectedBooking.status !== 'cancelled' && (selectedBooking.quoteStatus === 'accepted' || selectedBooking.status === 'confirmed' || selectedBooking.status === 'completed') && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                      onClick={openPaymentModal}
                      disabled={isUpdating}
                      data-testid="button-mark-paid"
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      {isFr ? "Enregistrer le paiement" : "Record Payment"}
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
                    {/* "Confirmer" removed here: confirming a raw request would
                        skip the whole quote → client acceptance → amount lock →
                        assignment flow. Confirmation happens via the quote path
                        (or "Mark payment received" once the amount is locked). */}
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
                    {/* "Reschedule" removed: no ClientBooking reschedule route
                        exists on the backend — the old button only mutated local
                        state (nothing persisted, client never notified). */}
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

                {/* In Progress Actions */}
                {selectedBooking.status === "in_progress" && (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={handleMarkCompleted}
                      disabled={isUpdating}
                      data-testid="button-complete-inprogress"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      {isFr ? "Marquer terminé" : "Mark Completed"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={openCancelModal}
                      disabled={isUpdating}
                      data-testid="button-cancel-inprogress"
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
                  <div className="space-y-3">
                    {!amountLockedMap[selectedBooking.id] && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-700 flex items-center gap-1">
                        <LockOpen className="h-3 w-3 shrink-0" />
                        {isFr ? "Confirmez le montant avant d'assigner un prestataire" : "Confirm the amount before assigning a provider"}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{isFr ? "Choisir un prestataire" : "Select Provider"}</Label>
                      <Select
                        value={inlineSelectedProviderId}
                        onValueChange={handleInlineProviderSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isFr ? "Choisir un prestataire approuvé…" : "Choose an approved provider…"} />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          {eligibleProviders.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {isFr ? "Aucun prestataire approuvé et actif" : "No approved active providers"}
                            </div>
                          ) : eligibleProviders.map((p: ApiProvider) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.company_name || p.name || `#${p.id}`}
                              {p.phone_number ? ` · ${p.phone_number}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {inlineProviderName && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium">{inlineProviderName}</p>
                          {inlineProviderPhone && (
                            <p className="text-xs text-muted-foreground">{inlineProviderPhone}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      disabled={!inlineProviderName.trim() || isUpdating || !amountLockedMap[selectedBooking.id]}
                      onClick={() => handleStatusChange(selectedBooking.id, 'assigned', { provider_name: inlineProviderName, provider_phone: inlineProviderPhone })}
                    >
                      <User className="h-4 w-4 mr-2" />
                      {isFr ? "Assigner le prestataire" : "Assign Provider"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={openQuoteModal}
                      disabled={isUpdating}
                      data-testid="button-send-quote-review"
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      {isFr ? "Envoyer un devis" : "Send Quote"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={openCancelModal}
                      disabled={isUpdating}
                      data-testid="button-cancel-review"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {isFr ? "Annuler" : "Cancel Booking"}
                    </Button>
                  </div>
                )}

                {/* Assigned Actions */}
                {selectedBooking.status === "assigned" && (
                  <div className="space-y-2">
                    {selIsAfterService ? (
                      /* after_service: paid AFTER the mission → confirming without
                         a payment is legitimate (lets the provider start). */
                      <Button
                        className="w-full"
                        onClick={() => handleStatusChange(selectedBooking.id, 'confirmed')}
                        disabled={isUpdating}
                        data-testid="button-confirm-assigned"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        {isFr ? "Confirmer la mission (paiement après prestation)" : "Confirm mission (payment after service)"}
                      </Button>
                    ) : (
                      /* prepay tiers: money must arrive BEFORE. No bare confirm —
                         the only path to confirmed is "Mark payment received"
                         (in the Amount & Payment section above). */
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {isFr
                            ? "Ce service exige un acompte/paiement avant intervention. Confirmez via « Marquer le paiement comme reçu »."
                            : "This service requires a deposit/payment before service. Confirm via \"Mark payment as received\"."}
                        </span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={openAssignModal}
                      disabled={isUpdating}
                      data-testid="button-reassign-assigned"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {isFr ? "Réassigner le prestataire" : "Reassign Provider"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleMarkCompleted}
                      disabled={isUpdating}
                      data-testid="button-complete-assigned"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      {isFr ? "Terminer" : "Mark Completed"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={openCancelModal}
                      disabled={isUpdating}
                      data-testid="button-cancel-assigned"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {isFr ? "Annuler" : "Cancel Booking"}
                    </Button>
                  </div>
                )}

                {/* Cancelled - Read only */}
                {selectedBooking.status === "cancelled" && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {isFr ? "Cette réservation est annulée et ne peut plus être modifiée." : "This booking is cancelled and cannot be modified."}
                  </p>
                )}

                {/* "Add Note" removed: there is no backend route to persist an
                    admin note on a ClientBooking — the old field only lived in
                    local state and was lost on refresh. */}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Reschedule Modal (admin-only: date/slot only, amount/lock/provider kept) */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#0F3A7A]" />
              {isFr ? "Reprogrammer la réservation" : "Reschedule Booking"}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? "Change uniquement la date et le créneau. Le montant, le verrouillage et le prestataire assigné sont conservés."
                : "Changes only the date and slot. Amount, lock and assigned provider are kept."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current date for comparison */}
            <div className="flex justify-between items-center text-sm bg-muted/40 rounded-md px-3 py-2">
              <span className="text-muted-foreground">{isFr ? "Date actuelle" : "Current date"}</span>
              <span className="font-medium">
                {rawSelected?.appointment_date
                  ? format(parseISO(rawSelected.appointment_date), "d MMM yyyy")
                  : (selectedBooking?.date ?? "—")}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-date">{isFr ? "Nouvelle date *" : "New date *"}</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setRescheduleDate(e.target.value)}
                data-testid="input-reschedule-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isFr ? "Créneau" : "Time slot"}</Label>
              <Select value={rescheduleSlot} onValueChange={setRescheduleSlot}>
                <SelectTrigger data-testid="select-reschedule-slot">
                  <SelectValue placeholder={isFr ? "Choisir un créneau…" : "Choose a slot…"} />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PREFERENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {TIME_PREF_LABELS[opt.value]?.[isFr ? 'fr' : 'en'] ?? opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-reason">{isFr ? "Motif de la reprogrammation *" : "Reason for rescheduling *"}</Label>
              <Textarea
                id="reschedule-reason"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                rows={2}
                placeholder={isFr ? "Ex. : le client a demandé de décaler…" : "e.g. the client asked to move the date…"}
                data-testid="input-reschedule-reason"
              />
            </div>
            {/* Summary / confirmation before sending */}
            {rescheduleDate && (
              <p className="text-xs text-muted-foreground">
                {isFr ? "Le client" : "The client"}
                {rawSelected?.provider_phone ? (isFr ? " et le prestataire seront prévenus" : " and the provider will be notified") : (isFr ? " sera prévenu" : " will be notified")}
                {isFr ? " de la nouvelle date." : " of the new date."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleModalOpen(false)} disabled={rescheduleSaving}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={handleRescheduleBooking}
              disabled={rescheduleSaving || !rescheduleDate || !rescheduleReason.trim()}
              data-testid="button-confirm-reschedule"
            >
              {rescheduleSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              {isFr ? "Confirmer la reprogrammation" : "Confirm reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Reschedule modal removed — no backend route to persist a reschedule. */}

      {/* Assign Provider Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{isFr ? "Assigner un prestataire" : "Assign Provider"}</DialogTitle>
            <DialogDescription>
              {isFr ? "Sélectionnez un prestataire pour cette réservation." : "Select a provider to assign to this booking."}
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && !amountLockedMap[selectedBooking.id] && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-700 flex items-center gap-1">
              <LockOpen className="h-3 w-3 shrink-0" />
              {isFr ? "Confirmez le montant avant d'assigner un prestataire" : "Confirm the amount before assigning a provider"}
            </div>
          )}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* ⚡ AI Recommendations */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">⚡ Recommandations IA</p>
              {aiLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[88px] bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : aiRecommendations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">
                  {isFr ? "Aucune recommandation disponible." : "No recommendations available."}
                </p>
              ) : (
                <div className="space-y-2">
                  {aiRecommendations.map((rec) => (
                    <div key={rec.provider_id} className="border rounded-lg p-3 space-y-2 bg-card">
                      <div className="flex items-center gap-3">
                        {rec.profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rec.profile_photo_url}
                            alt={rec.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 font-semibold text-sm shrink-0">
                            {rec.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{rec.name}</p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3 w-3 ${
                                  s <= Math.round(rec.rating)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">
                              {rec.rating > 0 ? rec.rating.toFixed(1) : "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-green-700 dark:text-green-400">
                            {rec.score}%
                          </span>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
                            disabled={isUpdating || (selectedBooking ? !amountLockedMap[selectedBooking.id] : true)}
                            onClick={() => handleAssignFromRec(rec)}
                          >
                            Assigner
                          </Button>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(rec.score, 100)}%` }}
                        />
                      </div>
                      {/* Score breakdown */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className={rec.score_breakdown?.zone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50 line-through"}>
                          Zone{rec.score_breakdown?.zone ? " ✓ +40" : " ✗"}
                        </span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className={rec.score_breakdown?.service ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50 line-through"}>
                          Service{rec.score_breakdown?.service ? " ✓ +30" : " ✗"}
                        </span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className={(rec.score_breakdown?.rating_bonus ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}>
                          Note {rec.rating > 0 ? `${rec.rating} +${Math.round(rec.score_breakdown?.rating_bonus ?? 0)}` : "N/A"}
                        </span>
                        {rec.score_breakdown?.urgency && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-emerald-600 dark:text-emerald-400">Urgence ✓ +10</span>
                          </>
                        )}
                      </div>
                      {/* AI sentence or zero-reason label */}
                      {rec.zero_reason ? (
                        <p className="text-xs text-muted-foreground/60">{rec.zero_reason}</p>
                      ) : rec.ai_recommendation ? (
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                          {rec.ai_recommendation}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {!aiLoading && (
                <p className="text-xs text-muted-foreground/60 text-right">⚡ Classement calculé par l&apos;IA Shizu — supervisé par l&apos;équipe</p>
              )}
            </div>

            {/* Voir tous les prestataires toggle */}
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 py-0.5"
              onClick={() => setShowAllProviders((v) => !v)}
            >
              {showAllProviders
                ? (isFr ? "← Masquer les prestataires" : "← Hide providers")
                : (isFr ? "Voir tous les prestataires →" : "See all providers →")}
            </button>

            {/* Full provider dropdown */}
            {showAllProviders && (() => {
              const commune = (selectedBooking?.address || "").split(",")[0].trim();
              const zoneMatched = commune
                ? eligibleProviders.filter((p: ApiProvider) =>
                    p.zones?.some((z) => z.toLowerCase() === commune.toLowerCase())
                  )
                : [];
              const hasZoneMatch = zoneMatched.length > 0;
              const displayProviders = hasZoneMatch ? zoneMatched : eligibleProviders;
              return (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>
                      {commune
                        ? (isFr ? `Prestataires disponibles à ${commune}` : `Providers available in ${commune}`)
                        : (isFr ? "Choisir un prestataire" : "Select Provider")}
                    </Label>
                    {commune && !hasZoneMatch && eligibleProviders.length > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {isFr
                          ? `Aucun prestataire dans cette zone — tous les prestataires disponibles`
                          : `No provider in this area — showing all available providers`}
                      </p>
                    )}
                    <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                      <SelectTrigger data-testid="select-assign-provider">
                        <SelectValue placeholder={isFr ? "Choisir un prestataire…" : "Choose a provider…"} />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {displayProviders.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            {isFr ? "Aucun prestataire approuvé et actif" : "No approved active providers"}
                          </div>
                        ) : displayProviders.map((p: ApiProvider) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.company_name || p.name || `#${p.id}`}
                            {p.phone_number ? ` · ${p.phone_number}` : ""}
                            {p.zones?.length ? ` · ${p.zones.join(", ")}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedProviderId && (() => {
                    const p = eligibleProviders.find((p: ApiProvider) => String(p.id) === selectedProviderId);
                    if (!p) return null;
                    return (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{p.company_name || p.name}</p>
                          {p.phone_number && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {p.phone_number}
                            </p>
                          )}
                          {p.zones?.length ? (
                            <p className="text-xs text-muted-foreground mt-0.5">{p.zones.join(", ")}</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            {showAllProviders && (
              <Button
                onClick={handleAssignProvider}
                disabled={!selectedProviderId || isUpdating || (selectedBooking ? !amountLockedMap[selectedBooking.id] : true)}
                data-testid="button-confirm-assign"
              >
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isFr ? "Assigner" : "Assign Provider"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              {isFr ? "Enregistrer un versement" : "Record a Payment"}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? "Saisissez le montant reçu. Les acomptes s'additionnent ; la réservation est confirmée au premier versement."
                : "Enter the amount received. Deposits accumulate; the booking is confirmed on the first payment."}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const collected = selectedBooking?.amountCollected ?? 0;
            const due = selectedBooking?.amountDue ?? 0;
            const dueTotal = collected + due;
            const received = Math.round(Number(finalAmountInput) || 0);
            const newCollected = collected + Math.max(0, received);
            const surplus = Math.max(0, newCollected - dueTotal);
            const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA';
            return (
              <div className="space-y-4">
                {/* Collected / due / remaining */}
                <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isFr ? "Déjà encaissé" : "Collected"}</span>
                    <span className="font-medium">{fmt(collected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isFr ? "Montant dû" : "Amount due"}</span>
                    <span className="font-medium">{fmt(dueTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-muted-foreground">{isFr ? "Solde restant" : "Remaining"}</span>
                    <span className="font-semibold">{fmt(due)}</span>
                  </div>
                </div>
                {/* Amount received now */}
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
                {/* Preview: new collected total + surplus (tip/rounding accepted) */}
                {received > 0 && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{isFr ? "Nouveau total encaissé" : "New total collected"}</span>
                      <span className="font-medium text-foreground">{fmt(newCollected)}</span>
                    </div>
                    {surplus > 0 && (
                      <div className="flex justify-between text-amber-700">
                        <span>{isFr ? "Surplus (pourboire / arrondi)" : "Surplus (tip / rounding)"}</span>
                        <span className="font-medium">{fmt(surplus)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmPayment}
              disabled={!finalAmountInput || Number(finalAmountInput) <= 0 || isUpdating}
              data-testid="button-record-payment"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {isFr ? "Enregistrer le versement" : "Record Payment"}
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Zone</Label>
                  <Select value={quoteZone} onValueChange={(v) => handleQuoteInputChange('zone', v)}>
                    <SelectTrigger data-testid="select-quote-zone">
                      <SelectValue placeholder={isFr ? "Zone..." : "Zone..."} />
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
                          {URGENCY_LABELS[opt.value]?.[isFr ? 'fr' : 'en'] ?? opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isFr ? "Préférence horaire" : "Time Preference"}</Label>
                <Select value={quoteTimePreference} onValueChange={(v) => handleQuoteInputChange('timePreference', v)}>
                  <SelectTrigger data-testid="select-quote-time-pref">
                    <SelectValue placeholder={isFr ? "Flexible" : "Anytime"} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PREFERENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {TIME_PREF_LABELS[opt.value]?.[isFr ? 'fr' : 'en'] ?? opt.label}
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
                  {isFr ? "Détail du prix" : "Pricing Breakdown"}
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
                  <span className="text-sm text-muted-foreground">{isFr ? "Fourchette suggérée" : "Suggested Range"}</span>
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
                  placeholder={isFr ? "Entrer le prix..." : "Enter price..."}
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

            {/* Over-cap warning (informative, not blocking) + AI note generator.
                Hidden for quote-based categories (nothing is promised). */}
            {(() => {
              const svc = selectedBooking ? resolveServiceForBooking(selectedBooking) : undefined;
              const catMax = svc?.category_price_max ?? null;
              const catQuote = svc?.category_is_quote_based ?? false;
              const overCap = !catQuote && catMax != null && quotePrice !== "" && Number(quotePrice) > catMax;
              if (!overCap) return null;
              const rangeLabel = `${formatMoney(svc?.category_price_min ?? 0, 'XOF')} \u2013 ${formatMoney(catMax, 'XOF')}`;
              return (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 space-y-2">
                  <p className="text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {isFr
                        ? `Ce montant d\u00e9passe la fourchette affich\u00e9e au client (${rangeLabel}). Expliquez la raison dans la note ci-dessous.`
                        : `This amount exceeds the range shown to the client (${rangeLabel}). Explain the reason in the note below.`}
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={handleGenerateJustification}
                    disabled={quoteJustifLoading}
                    data-testid="button-generate-justification"
                  >
                    {quoteJustifLoading
                      ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                    {isFr ? "G\u00e9n\u00e9rer une explication" : "Generate explanation"}
                  </Button>
                </div>
              );
            })()}

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

      {/* Payment Instructions Modal */}
      <Dialog open={paymentInstructionsOpen} onOpenChange={setPaymentInstructionsOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              {isFr ? "Instructions de paiement" : "Payment Instructions"}
            </DialogTitle>
            <DialogDescription>
              {selectedBooking && (
                <>
                  {isFr ? "Client :" : "Client:"} {selectedBooking.clientName}
                  {(selectedBooking.baseAmount ?? 0) > 0 && ` · ${new Intl.NumberFormat('fr-FR').format(selectedBooking.baseAmount)} FCFA`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!adminConfig?.wave_number && !adminConfig?.orange_number && !adminConfig?.mtn_number && (
              <p className="text-sm text-muted-foreground italic">
                {isFr ? "Aucun numéro de paiement configuré." : "No payment numbers configured."}
              </p>
            )}
            {adminConfig?.wave_number && (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-blue-800">Wave</p>
                  <p className="text-sm font-mono text-blue-700">{adminConfig.wave_number}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8"
                  onClick={() => navigator.clipboard.writeText(adminConfig.wave_number!)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {isFr ? "Copier" : "Copy"}
                </Button>
              </div>
            )}
            {adminConfig?.orange_number && (
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-orange-800">Orange Money</p>
                  <p className="text-sm font-mono text-orange-700">{adminConfig.orange_number}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8"
                  onClick={() => navigator.clipboard.writeText(adminConfig.orange_number!)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {isFr ? "Copier" : "Copy"}
                </Button>
              </div>
            )}
            {adminConfig?.mtn_number && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-yellow-800">MTN MoMo</p>
                  <p className="text-sm font-mono text-yellow-700">{adminConfig.mtn_number}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8"
                  onClick={() => navigator.clipboard.writeText(adminConfig.mtn_number!)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {isFr ? "Copier" : "Copy"}
                </Button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground italic pt-1">
            {isFr
              ? "Copiez ces numéros pour la copie manuelle, ou envoyez les instructions directement au client. L'envoi ne modifie pas la réservation."
              : "Copy these numbers for manual sharing, or send the instructions directly to the client. Sending does not change the booking."}
          </p>
          {!adminConfig?.twilio_enabled && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {isFr ? "WhatsApp non configuré — envoi indisponible." : "WhatsApp not configured — sending unavailable."}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentInstructionsOpen(false)} disabled={sendingInstructions}>
              {isFr ? "Fermer" : "Close"}
            </Button>
            <Button
              onClick={handleSendPaymentInstructionsToClient}
              disabled={sendingInstructions || !adminConfig?.twilio_enabled}
              data-testid="button-send-payment-instructions"
            >
              {sendingInstructions ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {isFr ? "Envoyer les instructions au client" : "Send instructions to client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark payment received — explicit financial confirmation */}
      <Dialog open={markPaidConfirmOpen} onOpenChange={setMarkPaidConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              {isFr ? "Marquer le paiement comme reçu" : "Mark payment as received"}
            </DialogTitle>
            <DialogDescription>
              {selectedBooking && (() => {
                const amt = selectedBooking.baseAmount || selectedBooking.price || 0;
                const amtStr = amt > 0 ? `${new Intl.NumberFormat('fr-FR').format(amt)} FCFA` : (isFr ? "le montant" : "the amount");
                return isFr
                  ? `Confirmez-vous avoir réellement reçu ${amtStr} de ${selectedBooking.clientName} ? La réservation sera marquée comme payée et confirmée.`
                  : `Do you confirm you actually received ${amtStr} from ${selectedBooking.clientName}? The booking will be marked paid and confirmed.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidConfirmOpen(false)} disabled={isUpdating}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleMarkPaymentReceived} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {isFr ? "Oui, paiement reçu" : "Yes, payment received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock amount (dispute) — reason required + explicit confirmation */}
      <Dialog open={unlockModalOpen} onOpenChange={setUnlockModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <LockOpen className="h-5 w-5" />
              {isFr ? "Déverrouiller le montant (litige)" : "Unlock amount (dispute)"}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? "Le montant accepté par le client sera déverrouillé et pourra être modifié. À n'utiliser que dans le cadre d'un litige."
                : "The amount the client accepted will be unlocked and can be changed. Use this only as part of a dispute."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{isFr ? "Motif du déverrouillage *" : "Reason for unlocking *"}</Label>
            <Textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              rows={3}
              placeholder={isFr ? "Expliquez pourquoi le montant verrouillé doit être déverrouillé…" : "Explain why the locked amount must be unlocked…"}
              data-testid="input-unlock-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockModalOpen(false)} disabled={unlockSaving}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleUnlockAmount} disabled={unlockSaving || !unlockReason.trim()}>
              {unlockSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LockOpen className="h-4 w-4 mr-2" />}
              {isFr ? "Déverrouiller" : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Dispute Modal */}
      <Dialog open={disputeModalOpen} onOpenChange={setDisputeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              {isFr ? "Ouvrir un litige" : "Open Dispute"}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? "Décrivez le problème. Le statut passera en 'litige'."
                : "Describe the issue. Status will move to 'disputed'."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{isFr ? "Raison du litige *" : "Dispute reason *"}</Label>
            <Textarea
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder={isFr ? "Décrivez le litige…" : "Describe the dispute..."}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive"
              disabled={!disputeReason.trim() || isUpdating}
              onClick={handleOpenDispute}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isFr ? "Ouvrir le litige" : "Open Dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
