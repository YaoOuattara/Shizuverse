"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, CheckCircle, MessageCircle, CalendarCheck, ShieldCheck, UserPlus, X } from "lucide-react";
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
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [showNudge, setShowNudge] = useState(false);

  // Check for client_token after success to decide whether to show nudge
  useEffect(() => {
    if (success) {
      setShowNudge(!localStorage.getItem("client_token"));
    }
  }, [success]);

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

      const data = await res.json().catch(() => ({})) as { id?: number; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }

      // Save phone for future booking lookups (same as BookingModal)
      localStorage.setItem("shizu_client_phone", phone.trim());
      setBookingId(data.id ?? null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────────
  if (success) {
    const year = new Date().getFullYear();
    const ref = bookingId ? `#SHZ-${year}-${bookingId}` : `#SHZ-${year}-???`;

    // WhatsApp support link — set NEXT_PUBLIC_SHIZU_WHATSAPP in .env to override
    const waNumber = process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "2250700000000";
    const waText = encodeURIComponent(
      isFr
        ? `Bonjour Shizu, j'ai une question concernant ma réservation ${ref}`
        : `Hello Shizu, I have a question about my booking ${ref}`
    );
    const waUrl = `https://wa.me/${waNumber}?text=${waText}`;

    return (
      <main className="max-w-md mx-auto px-4 py-12">
        {/* Success card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            {isFr ? "Demande envoyée !" : "Request sent!"}
          </h1>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            {isFr
              ? "Votre demande a bien été transmise. Un prestataire va vous contacter très prochainement."
              : "Your request has been submitted. A provider will contact you very soon."}
          </p>

          {/* Booking reference */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5">
            <CalendarCheck className="h-4 w-4 text-[#0F3A7A] shrink-0" />
            <span className="font-mono font-semibold text-[#0F3A7A] text-sm tracking-wide">
              {ref}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 mt-6">
            <a
              href={`/${locale}/bookings`}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#0F3A7A] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#0d3068] transition-colors"
            >
              <CalendarCheck className="h-4 w-4" />
              {isFr ? "Suivre ma demande" : "Track my request"}
            </a>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-green-500 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              {isFr ? "Contacter sur WhatsApp" : "Contact on WhatsApp"}
            </a>
            <button
              onClick={() => {
                setSuccess(false);
                setBookingId(null);
                setName(""); setPhone(""); setLocation(""); setDate("");
                setTime(""); setNotes(""); setDateHint(null); setIntakeInput("");
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              {isFr ? "Nouvelle réservation" : "New booking"}
            </button>
          </div>
        </div>

        {/* Registration nudge — only for anonymous users */}
        {showNudge && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-5 relative">
            <button
              onClick={() => setShowNudge(false)}
              className="absolute top-4 right-4 text-blue-300 hover:text-blue-500 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-[#0F3A7A]" />
              </div>
              <div>
                <p className="font-semibold text-[#0F3A7A] text-sm">
                  {isFr ? "Suivez vos réservations en temps réel" : "Track your bookings in real time"}
                </p>
                <p className="text-blue-700/70 text-xs mt-1 leading-relaxed">
                  {isFr
                    ? "Créez un compte gratuit pour consulter l'état de vos demandes et gérer vos réservations."
                    : "Create a free account to check your request status and manage your bookings."}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <a
                    href={`/${locale}/auth/register`}
                    className="bg-[#0F3A7A] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#0d3068] transition-colors text-center"
                  >
                    {isFr ? "Créer mon compte" : "Create my account"}
                  </a>
                  <button
                    onClick={() => setShowNudge(false)}
                    className="text-xs text-blue-400 hover:text-blue-600 transition-colors px-2 text-left"
                  >
                    {isFr ? "Non merci" : "No thanks"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
            lang="fr-FR"
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

        {/* Trust note */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-500" />
          {isFr ? "Paiement après validation du prestataire" : "Payment after provider confirmation"}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isFr ? "Envoi... (peut prendre 30s)" : "Sending... (may take 30s)"}
            </>
          ) : (
            isFr ? "Confirmer la réservation" : "Confirm booking"
          )}
        </Button>
      </form>
    </main>
  );
}
