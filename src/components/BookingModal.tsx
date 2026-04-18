"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Zap, Banknote, Loader2, User, Phone, Sparkles } from "lucide-react";
import { format, parse } from "date-fns";
import type { BookingCardProps } from "./BookingCard";
import {
  getPricingSuggestion,
  type UrgencyLevel,
  type TimePreference,
} from "@/utils/pricingEngine";
import { useAdminStore } from "@/data/adminStore";
import { formatMoney } from "@/lib/currency";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import CommuneAutocomplete, { COMMUNES } from "@/components/CommuneAutocomplete";


const SLUG_TO_CATEGORY: Record<string, string> = {
  menage:     "MENAGE ET NETTOYAGE",
  plomberie:  "BRICOLAGE ET PETITS TRAVAUX",
  electricite:"BRICOLAGE ET PETITS TRAVAUX",
  bricolage:  "BRICOLAGE ET PETITS TRAVAUX",
  nounou:     "GARDE D'ENFANTS ET SOUTIEN SCOLAIRE",
  beaute:     "BIEN-ETRE ET BEAUTE",
  traiteur:   "FETES ET EVENEMENTS",
  jardinage:  "JARDINAGE ET PISCINE",
};

// Keep legacy options for edit mode (existing mock bookings use these)
const serviceTypeOptions = [
  { value: "Wellness",   providers: ["Sarah Johnson"] },
  { value: "Beauty",     providers: ["Michael Chen", "Lisa Park"] },
  { value: "Healthcare", providers: ["Dr. Emily Wilson"] },
  { value: "Fitness",    providers: ["Alex Rodriguez", "Maya Patel"] },
];

const serviceNames: Record<string, string> = {
  Wellness:   "Massage Session",
  Beauty:     "Beauty Treatment",
  Healthcare: "Medical Consultation",
  Fitness:    "Training Session",
};

const providerIdMap: Record<string, string> = {
  "Sarah Johnson":    "provider-1",
  "Michael Chen":     "provider-2",
  "Dr. Emily Wilson": "provider-3",
  "Alex Rodriguez":   "provider-4",
  "Lisa Park":        "provider-5",
  "Maya Patel":       "provider-6",
};

// Internal values are 24h "HH:MM"; display is locale-aware
const timeSlots = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00",
];

function formatTimeSlot(slot: string, locale: "en" | "fr"): string {
  const [h, m] = slot.split(":").map(Number);
  if (locale === "fr") {
    return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
  }
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const bookingFormSchema = z.object({
  client_name:    z.string().optional(),
  client_phone:   z.string().optional(),
  serviceType:    z.string().min(1, "Service type is required"),
  providerName:   z.string().min(1, "Provider is required"),
  date:           z.date({ message: "Date is required" }),
  time:           z.string().min(1, "Time is required"),
  zone:           z.string().min(1, "Location is required"),
  urgency:        z.enum(["normal", "under_24h", "same_day"]),
  timePreference: z.enum(["anytime", "morning", "afternoon", "evening"]),
  notes:          z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export interface BookingWithNotes extends BookingCardProps {
  notes?: string;
  zone?: string;
  urgency?: UrgencyLevel;
  timePreference?: TimePreference;
}

export interface PreSelectedProvider {
  name: string;
  serviceType: string;
}

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  booking?: BookingWithNotes | null;
  onSubmit: (booking: BookingWithNotes) => void;
  preSelectedProvider?: PreSelectedProvider | null;
}

export default function BookingModal({
  open,
  onOpenChange,
  mode,
  booking,
  onSubmit,
  preSelectedProvider,
}: BookingModalProps) {
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI intake state
  const [intakeInput, setIntakeInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dateHint, setDateHint] = useState<string | null>(null);

  const isEditMode = mode === "edit";
  const { services } = useAdminStore();
  const { toast } = useToast();
  const t      = useTranslations("bookingModal");
  const locale = useLocale() as "en" | "fr";

  const ABIDJAN_SERVICES = [
    { label: locale === "fr" ? "Ménage & Nettoyage"     : "Cleaning",           slug: "menage" },
    { label: locale === "fr" ? "Plomberie"              : "Plumbing",           slug: "plomberie" },
    { label: locale === "fr" ? "Électricité"            : "Electrical",         slug: "electricite" },
    { label: locale === "fr" ? "Bricolage & Réparations": "Handyman",           slug: "bricolage" },
    { label: locale === "fr" ? "Nounou & Baby-sitting"  : "Childcare",          slug: "nounou" },
    { label: locale === "fr" ? "Beauté à domicile"      : "Beauty at Home",     slug: "beaute" },
    { label: locale === "fr" ? "Traiteur & Cuisine"     : "Catering",           slug: "traiteur" },
    { label: locale === "fr" ? "Jardinage & Piscine"    : "Garden & Pool",      slug: "jardinage" },
  ];

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      client_name:    "",
      client_phone:   "",
      serviceType:    "",
      providerName:   isEditMode ? "" : "pending",
      time:           "",
      zone:           "",
      urgency:        "normal",
      timePreference: "anytime",
      notes:          "",
    },
  });

  // Initialize form on open
  useEffect(() => {
    if (isEditMode && booking && open) {
      const service = serviceTypeOptions.find((s) => s.value === booking.serviceType);
      setAvailableProviders(service?.providers || []);

      let parsedDate: Date;
      try {
        parsedDate = parse(booking.date, "MMM d, yyyy", new Date());
      } catch {
        parsedDate = new Date();
      }

      form.reset({
        client_name:    "",
        client_phone:   "",
        serviceType:    booking.serviceType,
        providerName:   booking.providerName,
        date:           parsedDate,
        time:           booking.time,
        zone:           booking.zone || "",
        urgency:        booking.urgency || "normal",
        timePreference: booking.timePreference || "anytime",
        notes:          booking.notes || "",
      });

    } else if (!isEditMode && open && preSelectedProvider) {
      const service = serviceTypeOptions.find((s) => s.value === preSelectedProvider.serviceType);
      setAvailableProviders(service?.providers || []);

      form.reset({
        client_name:    "",
        client_phone:   "",
        serviceType:    preSelectedProvider.serviceType,
        providerName:   "pending",
        time:           "",
        zone:           "",
        urgency:        "normal",
        timePreference: "anytime",
        notes:          "",
      });

    } else if (!isEditMode && open) {
      form.reset({
        client_name:    "",
        client_phone:   "",
        serviceType:    "",
        providerName:   "pending",
        time:           "",
        zone:           "",
        urgency:        "normal",
        timePreference: "anytime",
        notes:          "",
      });
      setAvailableProviders([]);
    }
  }, [booking, open, form, isEditMode, preSelectedProvider]);

  // Sync provider list when service type changes (edit mode) or reset to pending (create mode)
  const watchedServiceTypeForEffect = form.watch("serviceType");
  useEffect(() => {
    if (!open) return;
    if (isEditMode) {
      form.setValue("providerName", "");
      const service = serviceTypeOptions.find((s) => s.value === watchedServiceTypeForEffect);
      setAvailableProviders(service?.providers || []);
    } else {
      form.setValue("providerName", "pending");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedServiceTypeForEffect, isEditMode, open]);

  const handleAnalyze = async () => {
    if (!intakeInput.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    const serviceName = form.getValues("serviceType") || "";
    try {
      const res = await fetch("/api/booking-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: intakeInput, service_name: serviceName, locale }),
      });
      const data = await res.json();
      if (data.suggested_notes) form.setValue("notes", data.suggested_notes);
      if (data.suggested_date_hint) setDateHint(data.suggested_date_hint);
      if (data.suggested_location_hint) {
        const hint = (data.suggested_location_hint as string).toLowerCase();
        const match = COMMUNES.find((c) => hint.includes(c.toLowerCase()));
        if (match) form.setValue("zone", match);
      }
    } catch (err) {
      console.error("[booking-intake] error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFormSubmit = async (data: BookingFormValues) => {
    // ── CREATE mode: call real Flask API ─────────────────────────────────────
    if (!isEditMode) {
      // Manual validation for client fields (optional in schema, required in create UI)
      if (!data.client_name || data.client_name.trim().length < 2) {
        form.setError("client_name", { message: locale === "fr" ? "Nom requis (2 caractères minimum)" : "Name required (min. 2 characters)" });
        return;
      }
      if (!data.client_phone || data.client_phone.trim().length < 8) {
        form.setError("client_phone", { message: locale === "fr" ? "Numéro requis (8 chiffres minimum)" : "Phone required (min. 8 digits)" });
        return;
      }

      // Combine date + time → ISO 8601 (time values are 24h "HH:MM")
      const dateObj = new Date(data.date);
      const [hours, minutes] = data.time.split(":").map(Number);
      dateObj.setHours(hours, minutes, 0, 0);

      const selectedService = ABIDJAN_SERVICES.find((s) => s.label === data.serviceType);
      const slug = selectedService?.slug || "menage";

      // Wake up Render if sleeping
      fetch("https://shizu-verse.onrender.com/health").catch(() => {});

      setIsSubmitting(true);
      try {
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name:      data.client_name.trim(),
            client_phone:     data.client_phone.trim(),
            client_location:  data.zone,
            service_name:     data.serviceType,
            service_slug:     slug,
            appointment_date: dateObj.toISOString().split(".")[0], // strip .000Z → naive ISO
            notes:            data.notes || "",
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errBody}`);
        }

        const apiBooking = await response.json();

        // Store phone for future booking lookups
        localStorage.setItem("shizu_client_phone", data.client_phone.trim());

        // Fetch AI confirmation summary (best-effort, non-blocking)
        let aiSummary: string | null = null;
        try {
          const summaryRes = await fetch("/api/booking-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_name:     data.serviceType,
              zone:             data.zone,
              appointment_date: dateObj.toISOString(),
              locale,
            }),
          });
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            aiSummary = summaryData.summary || null;
          }
        } catch {
          // AI summary is optional — ignore errors
        }

        const newBooking: BookingWithNotes = {
          id:           String(apiBooking.id),
          serviceName:  apiBooking.service_name,
          serviceType:  slug,
          providerName: locale === "fr" ? "En attente d'assignation" : "Awaiting assignment",
          providerId:   "pending",
          date:         new Date(apiBooking.appointment_date).toLocaleDateString(
            locale === "fr" ? "fr-FR" : "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          ),
          time:           data.time,
          status:         "pending",
          zone:           data.zone,
          urgency:        data.urgency,
          timePreference: data.timePreference,
          notes:          data.notes,
        };

        trackEvent("booking_completed", {
          service_name: data.serviceType,
          service_slug: slug,
          zone:         data.zone,
          urgency:      data.urgency,
          locale,
        });

        onSubmit(newBooking);
        toast({
          title: locale === "fr" ? "Réservation envoyée !" : "Booking submitted!",
          description: aiSummary ?? (locale === "fr"
            ? "Nous vous contacterons bientôt."
            : "We will contact you soon."),
        });
        form.reset();
        setAvailableProviders([]);
        onOpenChange(false);

      } catch (error) {
        console.error("Booking API error:", error);
        const message = error instanceof Error ? error.message : String(error);
        form.setError("root", { message: `Erreur: ${message}` });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── EDIT mode: local state update only ───────────────────────────────────
    const bookingData: BookingWithNotes = {
      id:           booking!.id,
      serviceName:  serviceNames[data.serviceType] || data.serviceType,
      serviceType:  data.serviceType,
      providerId:   booking!.providerId,
      providerName: data.providerName,
      date:         format(data.date, "MMM d, yyyy"),
      time:         data.time,
      status:       booking!.status,
      zone:         data.zone,
      urgency:      data.urgency,
      timePreference: data.timePreference,
      notes:        data.notes,
    };

    onSubmit(bookingData);
    form.reset();
    setAvailableProviders([]);
    onOpenChange(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setAvailableProviders([]);
      setIntakeInput("");
      setDateHint(null);
    }
    onOpenChange(isOpen);
  };

  const modalTitle       = isEditMode ? t("editTitle")     : t("createTitle");
  const modalDescription = isEditMode ? t("editDesc")      : t("createDesc");
  const testIdPrefix     = isEditMode ? "edit"             : "create";

  // Watch fields for real-time quote calculation
  const watchedServiceType     = form.watch("serviceType");
  const watchedZone            = form.watch("zone");
  const watchedUrgency         = form.watch("urgency");
  const watchedTimePreference  = form.watch("timePreference");

  const pricingSuggestion = (() => {
    if (!watchedServiceType || !watchedZone) return null;
    const svcName = serviceNames[watchedServiceType] || watchedServiceType;
    const service = services.find((s) => s.name === svcName);
    if (!service) return null;
    return getPricingSuggestion(service, {
      zone: watchedZone,
      urgency: watchedUrgency,
      timePreference: watchedTimePreference,
    });
  })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-0"
        data-testid={`modal-${testIdPrefix}-booking`}
      >
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>{modalTitle}</DialogTitle>
          {modalDescription && (
            <DialogDescription>{modalDescription}</DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <div className="overflow-y-auto flex-1 px-6">
            <form id="booking-form" onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="space-y-4 py-2">
            {/* ── AI intake assistant — create mode only ───────────────── */}
            {!isEditMode && (
              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {locale === "fr" ? "Assistant IA" : "AI Assistant"}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={intakeInput}
                    onChange={(e) => setIntakeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    placeholder={
                      locale === "fr"
                        ? "Décrivez votre besoin en quelques mots..."
                        : "Describe your need in a few words..."
                    }
                    className="flex-1 border border-purple-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={!intakeInput.trim() || isAnalyzing}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                  >
                    {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {locale === "fr" ? "Analyser" : "Analyze"}
                  </button>
                </div>
                {(dateHint || form.getValues("notes")) && (
                  <p className="text-xs text-purple-600">
                    {locale === "fr"
                      ? "✓ Formulaire pré-rempli — vous pouvez modifier les champs."
                      : "✓ Form pre-filled — you can still edit all fields."}
                  </p>
                )}
              </div>
            )}

            {/* ── Client info — create mode only ───────────────────────── */}
            {!isEditMode && (
              <>
                <FormField
                  control={form.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {locale === "fr" ? "Votre nom *" : "Your name *"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Kouassi Marie"
                          {...field}
                          data-testid="create-input-client-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {locale === "fr" ? "Numéro de téléphone *" : "Phone number *"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+225 07 XX XX XX XX"
                          type="tel"
                          {...field}
                          data-testid="create-input-client-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* ── Service type ─────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("serviceType")}</FormLabel>
                  <FormControl>
                    <select
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      data-testid={`${testIdPrefix}-select-service-type`}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="" disabled>{t("serviceTypePlaceholder")}</option>
                      {isEditMode
                        ? serviceTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.value}</option>
                          ))
                        : ABIDJAN_SERVICES.map((s) => (
                            <option key={s.slug} value={s.label}>{s.label}</option>
                          ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Provider — edit mode only ─────────────────────────────── */}
            {isEditMode && (
              <FormField
                control={form.control}
                name="providerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("providerField")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={availableProviders.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger data-testid={`${testIdPrefix}-select-provider`}>
                          <SelectValue
                            placeholder={
                              availableProviders.length === 0
                                ? t("selectServiceFirst")
                                : t("providerPlaceholder")
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" className="z-[9999]">
                        {availableProviders.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {provider}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ── Date ─────────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("dateField")}</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) field.onChange(new Date(val + "T00:00:00"));
                        else field.onChange(undefined);
                      }}
                      data-testid={`${testIdPrefix}-button-date-picker`}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Date hint from AI ────────────────────────────────────── */}
            {dateHint && !isEditMode && (
              <p className="text-xs text-purple-600 -mt-2">
                💡 {locale === "fr" ? `Suggestion : ${dateHint}` : `Suggestion: ${dateHint}`}
              </p>
            )}

            {/* ── Time ─────────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("timeField")}</FormLabel>
                  <FormControl>
                    <select
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      data-testid={`${testIdPrefix}-select-time`}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="" disabled>{t("timePlaceholder")}</option>
                      {timeSlots.map((slot) => (
                        <option key={slot} value={slot}>{formatTimeSlot(slot, locale)}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Zone (location) — CommuneAutocomplete ────────────────── */}
            <FormField
              control={form.control}
              name="zone"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div data-testid={`${testIdPrefix}-combobox-zone`}>
                      <CommuneAutocomplete
                        label={locale === "fr" ? "Adresse ou quartier *" : "Location *"}
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Urgency + time preference ─────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="urgency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {t("urgencyField")}
                    </FormLabel>
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        data-testid={`${testIdPrefix}-select-urgency`}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="normal">{locale === "fr" ? "Normal (3+ jours)" : "Normal (3+ days)"}</option>
                        <option value="under_24h">{locale === "fr" ? "Moins de 24h" : "Under 24h"}</option>
                        <option value="same_day">{locale === "fr" ? "Même jour" : "Same day"}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timePreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("timePreferenceField")}
                    </FormLabel>
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        data-testid={`${testIdPrefix}-select-time-preference`}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="anytime">{locale === "fr" ? "Indifférent" : "Anytime"}</option>
                        <option value="morning">{locale === "fr" ? "Matin" : "Morning"}</option>
                        <option value="afternoon">{locale === "fr" ? "Après-midi" : "Afternoon"}</option>
                        <option value="evening">{locale === "fr" ? "Soir" : "Evening"}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Pricing estimate ──────────────────────────────────────── */}
            {pricingSuggestion && (
              <div className="bg-muted/30 p-4 rounded-lg space-y-3 border" data-testid="pricing-estimate-box">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t("estimatedQuote")}</span>
                  </div>
                  <div className="text-right">
                    {pricingSuggestion.suggestedMin === pricingSuggestion.suggestedMax ? (
                      <span className="text-lg font-bold text-primary" data-testid="text-estimate-price">
                        {formatMoney(pricingSuggestion.suggestedQuote, "XOF")}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-primary" data-testid="text-estimate-price">
                        {formatMoney(pricingSuggestion.suggestedMin, "XOF")} – {formatMoney(pricingSuggestion.suggestedMax, "XOF")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-dashed">
                  {pricingSuggestion.breakdown.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.label}</span>
                      <span>
                        {item.type === "mult"
                          ? `x${item.value.toFixed(2)}`
                          : formatMoney(item.result, "XOF")}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic text-center">
                  {t("quoteDisclaimer")}
                </p>
              </div>
            )}

            {/* ── Notes ────────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notesField")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("notesPlaceholder")}
                      className="resize-none"
                      {...field}
                      data-testid={`${testIdPrefix}-textarea-notes`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Root error (API failure) ──────────────────────────────── */}
            {form.formState.errors.root && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
            </div>{/* end scrollable area */}
            </form>
          </div>
        </Form>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
            data-testid={`${testIdPrefix}-button-cancel`}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form="booking-form"
            disabled={isSubmitting}
            data-testid={`${testIdPrefix}-button-submit`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {locale === "fr" ? "Envoi... (peut prendre 30s)" : "Sending... (may take 30s)"}
              </>
            ) : (
              isEditMode ? t("updateBooking") : t("submitRequest")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
