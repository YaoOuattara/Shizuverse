"use client";

import { useState } from "react";
import { Loader2, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CommuneAutocomplete, { COMMUNES } from "@/components/CommuneAutocomplete";

interface Props {
  serviceId: string;
  locale: string;
  serviceName?: string;
}

// 24h time slots — identical to BookingModal
const timeSlots = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00",
];

function formatTimeSlot(slot: string, locale: string): string {
  const [h, m] = slot.split(":").map(Number);
  if (locale === "fr") {
    return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
  }
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2";

const labelClass = "block text-sm font-medium mb-1";

export default function BookingForm({ serviceId, locale, serviceName }: Props) {
  const isFr = locale === "fr";

  // ── AI intake ────────────────────────────────────────────────────────────────
  const [intakeInput, setIntakeInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dateHint, setDateHint] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!intakeInput.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/booking-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: intakeInput, service_name: serviceName ?? "", locale }),
      });
      const data = await res.json();
      if (data.suggested_notes) setNotes(data.suggested_notes);
      if (data.suggested_date_hint) setDateHint(data.suggested_date_hint);
      if (data.suggested_location_hint) {
        const hint = (data.suggested_location_hint as string).toLowerCase();
        const match = COMMUNES.find((c) => hint.includes(c.toLowerCase()));
        if (match) setLocation(match);
      }
    } catch (err) {
      console.error("[booking-intake] error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "under_24h" | "same_day">("normal");
  const [timePreference, setTimePreference] = useState<"anytime" | "morning" | "afternoon" | "evening">("anytime");
  const [notes, setNotes] = useState("");

  // ── Submit state ─────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Wake up Render if sleeping
    fetch("https://shizu-verse.onrender.com/health").catch(() => {});

    // Build ISO datetime from date + time slot
    const [hours, minutes] = time.split(":").map(Number);
    const dateObj = new Date(`${date}T00:00:00`);
    dateObj.setHours(hours, minutes, 0, 0);
    const appointmentIso = dateObj.toISOString().split(".")[0];

    // service_id (numeric) OR service_slug (non-numeric)
    const serviceIdNum = parseInt(serviceId, 10);
    const isNumericId = !isNaN(serviceIdNum);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: name.trim(),
          client_phone: phone.trim(),
          client_location: location.trim(),
          appointment_date: appointmentIso,
          notes: notes.trim() || undefined,
          service_name: serviceName ?? "",
          ...(isNumericId ? { service_id: serviceIdNum } : { service_slug: serviceId }),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Erreur ${res.status}`
        );
      }

      // Save phone for future booking lookups (same as BookingModal)
      localStorage.setItem("shizu_client_phone", phone.trim());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center">
        <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-500" />
        <h1 className="text-2xl font-semibold mb-2">
          {isFr ? "Demande envoyée !" : "Request sent!"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isFr
            ? "Nous vous contacterons bientôt pour confirmer votre réservation."
            : "We will contact you soon to confirm your booking."}
        </p>
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setSuccess(false);
              setName(""); setPhone(""); setLocation(""); setDate("");
              setTime(""); setNotes(""); setDateHint(null); setIntakeInput("");
            }}
          >
            {isFr ? "Nouvelle réservation" : "New booking"}
          </Button>
          <Button asChild>
            <a href={`/${locale}/bookings`}>
              {isFr ? "Mes réservations" : "My bookings"}
            </a>
          </Button>
        </div>
      </main>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">
        {isFr ? "Demander un service" : "Request Service"}
      </h1>

      {serviceName && (
        <p className="mb-6 text-primary font-medium">
          {isFr ? `Vous réservez : ${serviceName}` : `Booking: ${serviceName}`}
        </p>
      )}

      {/* ── AI intake assistant ─────────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-purple-100 bg-purple-50/60 p-4 space-y-3">
        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {isFr ? "Assistant IA" : "AI Assistant"}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={intakeInput}
            onChange={(e) => setIntakeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder={
              isFr
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
            {isFr ? "Analyser" : "Analyze"}
          </button>
        </div>
        {(dateHint || notes) && (
          <p className="text-xs text-purple-600">
            {isFr
              ? "✓ Formulaire pré-rempli — vous pouvez modifier les champs."
              : "✓ Form pre-filled — you can still edit all fields."}
          </p>
        )}
      </div>

      {/* ── Main form ───────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className={labelClass}>
            {isFr ? "Votre nom *" : "Your name *"}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kouassi Marie"
            className={inputClass}
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label className={labelClass}>
            {isFr ? "Numéro de téléphone *" : "Phone number *"}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+225 07 XX XX XX XX"
            className={inputClass}
            required
          />
        </div>

        {/* Location — CommuneAutocomplete */}
        <CommuneAutocomplete
          label={isFr ? "Adresse ou quartier *" : "Location *"}
          value={location}
          onChange={setLocation}
        />

        {/* Date */}
        <div>
          <label className={labelClass}>
            {isFr ? "Date souhaitée *" : "Preferred date *"}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className={inputClass}
            required
          />
          {dateHint && (
            <p className="mt-1 text-xs text-purple-600">
              💡 {isFr ? `Suggestion : ${dateHint}` : `Suggestion: ${dateHint}`}
            </p>
          )}
        </div>

        {/* Time */}
        <div>
          <label className={labelClass}>
            {isFr ? "Heure *" : "Time *"}
          </label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClass}
            required
          >
            <option value="" disabled>
              {isFr ? "Sélectionnez une heure" : "Select a time"}
            </option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {formatTimeSlot(slot, locale)}
              </option>
            ))}
          </select>
        </div>

        {/* Urgency + Time preference — same row as BookingModal */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              {isFr ? "Urgence" : "Urgency"}
            </label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as typeof urgency)}
              className={inputClass}
            >
              <option value="normal">{isFr ? "Normal (3+ jours)" : "Normal (3+ days)"}</option>
              <option value="under_24h">{isFr ? "Moins de 24h" : "Under 24h"}</option>
              <option value="same_day">{isFr ? "Même jour" : "Same day"}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>
              {isFr ? "Préférence horaire" : "Time Preference"}
            </label>
            <select
              value={timePreference}
              onChange={(e) => setTimePreference(e.target.value as typeof timePreference)}
              className={inputClass}
            >
              <option value="anytime">{isFr ? "Indifférent" : "Anytime"}</option>
              <option value="morning">{isFr ? "Matin" : "Morning"}</option>
              <option value="afternoon">{isFr ? "Après-midi" : "Afternoon"}</option>
              <option value="evening">{isFr ? "Soir" : "Evening"}</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>
            {isFr ? "Précisions (optionnel)" : "Notes (optional)"}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isFr ? "Demandes spéciales ou précisions..." : "Any special requests or notes..."
            }
            className={`${inputClass} h-auto resize-none`}
            rows={3}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isFr ? "Envoi... (peut prendre 30s)" : "Sending... (may take 30s)"}
            </>
          ) : (
            isFr ? "Soumettre la demande" : "Submit Request"
          )}
        </Button>
      </form>
    </main>
  );
}
