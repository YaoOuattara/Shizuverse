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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Clock, MapPin, Zap, Check, ChevronsUpDown, Banknote } from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import type { BookingCardProps } from "./BookingCard";
import {
  ZONES_LIST,
  URGENCY_OPTIONS,
  TIME_PREFERENCE_OPTIONS,
  getPricingSuggestion,
  type UrgencyLevel,
  type TimePreference,
} from "@/utils/pricingEngine";
import { useAdminStore } from "@/data/adminStore";
import { formatMoney } from "@/lib/currency";
import { useTranslations } from "next-intl";

const bookingFormSchema = z.object({
  serviceType: z.string().min(1, "Service type is required"),
  providerName: z.string().min(1, "Provider is required"),
  date: z.date({ message: "Date is required" }),
  time: z.string().min(1, "Time is required"),
  zone: z.string().min(1, "Location is required"),
  urgency: z.enum(['normal', 'under_24h', 'same_day']),
  timePreference: z.enum(['anytime', 'morning', 'afternoon', 'evening']),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

// todo: remove mock functionality - these will come from API
const serviceTypeOptions = [
  { value: "Wellness", providers: ["Sarah Johnson"] },
  { value: "Beauty", providers: ["Michael Chen", "Lisa Park"] },
  { value: "Healthcare", providers: ["Dr. Emily Wilson"] },
  { value: "Fitness", providers: ["Alex Rodriguez", "Maya Patel"] },
];

const timeSlots = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
];

// Map service types to service names
const serviceNames: Record<string, string> = {
  Wellness: "Massage Session",
  Beauty: "Beauty Treatment",
  Healthcare: "Medical Consultation",
  Fitness: "Training Session",
};

// Map provider names to provider IDs - todo: remove mock functionality
const providerIdMap: Record<string, string> = {
  "Sarah Johnson": "provider-1",
  "Michael Chen": "provider-2",
  "Dr. Emily Wilson": "provider-3",
  "Alex Rodriguez": "provider-4",
  "Lisa Park": "provider-5",
  "Maya Patel": "provider-6",
};

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
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");

  const isEditMode = mode === "edit";
  const { services } = useAdminStore();
  const t = useTranslations("bookingModal");

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      serviceType: "",
      providerName: "",
      time: "",
      zone: "",
      urgency: "normal",
      timePreference: "anytime",
      notes: "",
    },
  });

  // Initialize form when booking changes (for edit mode) or when pre-selected provider is set
  useEffect(() => {
    if (isEditMode && booking && open) {
      // Set available providers for the service type
      const service = serviceTypeOptions.find(
        (s) => s.value === booking.serviceType
      );
      setAvailableProviders(service?.providers || []);

      // Parse the date string to a Date object
      let parsedDate: Date;
      try {
        parsedDate = parse(booking.date, "MMM d, yyyy", new Date());
      } catch {
        parsedDate = new Date();
      }

      form.reset({
        serviceType: booking.serviceType,
        providerName: booking.providerName,
        date: parsedDate,
        time: booking.time,
        zone: booking.zone || "",
        urgency: booking.urgency || "normal",
        timePreference: booking.timePreference || "anytime",
        notes: booking.notes || "",
      });
      setZoneSearch(booking.zone || "");
    } else if (!isEditMode && open && preSelectedProvider) {
      // Pre-fill form with selected provider from profile
      const service = serviceTypeOptions.find(
        (s) => s.value === preSelectedProvider.serviceType
      );
      setAvailableProviders(service?.providers || []);

      form.reset({
        serviceType: preSelectedProvider.serviceType,
        providerName: preSelectedProvider.name,
        time: "",
        zone: "",
        urgency: "normal",
        timePreference: "anytime",
        notes: "",
      });
      setZoneSearch("");
    } else if (!isEditMode && open) {
      // Reset form for create mode without pre-selection
      form.reset({
        serviceType: "",
        providerName: "",
        time: "",
        zone: "",
        urgency: "normal",
        timePreference: "anytime",
        notes: "",
      });
      setAvailableProviders([]);
      setZoneSearch("");
    }
  }, [booking, open, form, isEditMode, preSelectedProvider]);

  const handleServiceTypeChange = (value: string) => {
    form.setValue("serviceType", value);
    form.setValue("providerName", "");
    const service = serviceTypeOptions.find((s) => s.value === value);
    setAvailableProviders(service?.providers || []);
  };

  const handleFormSubmit = (data: BookingFormValues) => {
    const bookingData: BookingWithNotes = {
      id: isEditMode && booking ? booking.id : `booking-${Date.now()}`,
      serviceName: serviceNames[data.serviceType] || data.serviceType,
      serviceType: data.serviceType,
      providerId: isEditMode && booking ? booking.providerId : (providerIdMap[data.providerName] || `provider-${Date.now()}`),
      providerName: data.providerName,
      date: format(data.date, "MMM d, yyyy"),
      time: data.time,
      status: isEditMode && booking ? booking.status : "pending",
      zone: data.zone,
      urgency: data.urgency,
      timePreference: data.timePreference,
      notes: data.notes,
    };

    onSubmit(bookingData);
    form.reset();
    setAvailableProviders([]);
    setZoneSearch("");
    onOpenChange(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setAvailableProviders([]);
      setZoneSearch("");
    }
    onOpenChange(isOpen);
  };

  const modalTitle = isEditMode ? t("editTitle") : t("createTitle");
  const modalDescription = isEditMode ? t("editDesc") : t("createDesc");
  const submitButtonText = isEditMode ? t("updateBooking") : t("submitRequest");
  const testIdPrefix = isEditMode ? "edit" : "create";

  // Watch fields for real-time quote calculation
  const watchedServiceType = form.watch("serviceType");
  const watchedZone = form.watch("zone");
  const watchedUrgency = form.watch("urgency");
  const watchedTimePreference = form.watch("timePreference");

  const pricingSuggestion = (() => {
    if (!watchedServiceType || !watchedZone) return null;
    const serviceName = serviceNames[watchedServiceType] || watchedServiceType;
    const service = services.find(s => s.name === serviceName);
    if (!service) return null;

    return getPricingSuggestion(service, {
      zone: watchedZone,
      urgency: watchedUrgency,
      timePreference: watchedTimePreference
    });
  })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[500px]"
        data-testid={`modal-${testIdPrefix}-booking`}
      >
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          {modalDescription && (
            <DialogDescription>{modalDescription}</DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("serviceType")}</FormLabel>
                  <Select
                    onValueChange={handleServiceTypeChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        data-testid={`${testIdPrefix}-select-service-type`}
                      >
                        <SelectValue placeholder={t("serviceTypePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {serviceTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      <SelectTrigger
                        data-testid={`${testIdPrefix}-select-provider`}
                      >
                        <SelectValue
                          placeholder={
                            availableProviders.length === 0
                              ? t("selectServiceFirst")
                              : t("providerPlaceholder")
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("dateField")}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid={`${testIdPrefix}-button-date-picker`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>{t("datePlaceholder")}</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={!isEditMode ? (date: Date) => date < new Date() : undefined}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("timeField")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid={`${testIdPrefix}-select-time`}>
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder={t("timePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zone"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("zoneField")}</FormLabel>
                  <Popover open={zoneOpen} onOpenChange={setZoneOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={zoneOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid={`${testIdPrefix}-combobox-zone`}
                        >
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {field.value
                              ? ZONES_LIST.find((z) => z.value === field.value)?.label || field.value
                              : t("zonePlaceholder")}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder={t("zoneSearch")}
                          value={zoneSearch}
                          onValueChange={setZoneSearch}
                          data-testid={`${testIdPrefix}-input-zone-search`}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {zoneSearch.trim() ? (
                              <div
                                className="p-2 cursor-pointer hover-elevate rounded-md"
                                onClick={() => {
                                  field.onChange(zoneSearch.trim());
                                  setZoneOpen(false);
                                }}
                                data-testid={`${testIdPrefix}-button-zone-custom`}
                              >
                                {t("zoneCustom", { zone: zoneSearch.trim() })}
                              </div>
                            ) : (
                              "No zones found."
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            {ZONES_LIST.filter((zone) =>
                              zone.label.toLowerCase().includes(zoneSearch.toLowerCase()) ||
                              zone.value.toLowerCase().includes(zoneSearch.toLowerCase())
                            ).map((zone) => (
                              <CommandItem
                                key={zone.value}
                                value={zone.value}
                                onSelect={() => {
                                  field.onChange(zone.value);
                                  setZoneSearch(zone.label);
                                  setZoneOpen(false);
                                }}
                                data-testid={`${testIdPrefix}-zone-option-${zone.value}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === zone.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {zone.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription className="text-xs text-muted-foreground">
                    {t("zoneDesc")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid={`${testIdPrefix}-select-urgency`}>
                          <SelectValue placeholder="Normal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {URGENCY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid={`${testIdPrefix}-select-time-preference`}>
                          <SelectValue placeholder="Anytime" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIME_PREFERENCE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                        {item.type === 'mult'
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

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                data-testid={`${testIdPrefix}-button-cancel`}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" data-testid={`${testIdPrefix}-button-submit`}>
                {submitButtonText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
