"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { submitBooking } from "@/actions/submitBooking";
import CommuneAutocomplete, { COMMUNES } from "@/components/CommuneAutocomplete";

interface Props {
  serviceId: string;
  locale: string;
  serviceName?: string;
}

export default function BookingForm({ serviceId, locale, serviceName }: Props) {
  const fr = locale === "fr";

  // AI intake
  const [intakeInput, setIntakeInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dateHint, setDateHint] = useState<string | null>(null);

  // Form fields
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");

  const handleAnalyze = async () => {
    if (!intakeInput.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/booking-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: intakeInput,
          service_name: serviceName ?? "",
          locale,
        }),
      });

      if (!res.ok) {
        console.error("[booking-intake] non-ok response:", res.status, res.statusText);
      }

      const data = await res.json();
      console.log("[booking-intake] response data:", data);

      if (data.suggested_notes) {
        console.log("[booking-intake] setting notes:", data.suggested_notes);
        setNotes(data.suggested_notes);
      }
      if (data.suggested_date_hint) {
        console.log("[booking-intake] setting dateHint:", data.suggested_date_hint);
        setDateHint(data.suggested_date_hint);
      }
      if (data.suggested_location_hint) {
        const hint = (data.suggested_location_hint as string).toLowerCase();
        // Use includes() — Claude may return "Cocody" or "quartier de Cocody"
        const match = COMMUNES.find((c) => hint.includes(c.toLowerCase()));
        console.log("[booking-intake] location hint:", data.suggested_location_hint, "→ match:", match);
        if (match) setLocation(match);
      }
    } catch (err) {
      console.error("[booking-intake] fetch/parse error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">
        {fr ? "Réserver un service" : "Book a Service"}
      </h1>

      {serviceName && (
        <p className="mb-6 text-indigo-700 font-medium">
          {fr ? `Vous réservez : ${serviceName}` : `Booking: ${serviceName}`}
        </p>
      )}

      {/* ── AI intake assistant ─────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-purple-100 bg-purple-50/60 p-4 space-y-3">
        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {fr ? "Assistant IA" : "AI Assistant"}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={intakeInput}
            onChange={(e) => setIntakeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder={
              fr
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
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {fr ? "Analyser" : "Analyze"}
          </button>
        </div>
        {(dateHint || notes) && (
          <p className="text-xs text-purple-600">
            {fr
              ? "✓ Formulaire pré-rempli — vous pouvez modifier les champs."
              : "✓ Form pre-filled — you can still edit all fields."}
          </p>
        )}
      </div>

      {/* ── Booking form ────────────────────────────────────────── */}
      <form action={submitBooking} className="space-y-4">
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="locale" value={locale} />

        <div>
          <label className="block text-sm font-medium">
            {fr ? "Nom complet" : "Name"}
          </label>
          <input
            name="name"
            type="text"
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            {fr ? "WhatsApp / Téléphone" : "Phone"}
          </label>
          <input
            name="phone"
            type="tel"
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <CommuneAutocomplete
          label={fr ? "Adresse ou quartier" : "Location"}
          value={location}
          onChange={setLocation}
        />

        <div>
          <label className="block text-sm font-medium">
            {fr ? "Date souhaitée" : "Date"}
          </label>
          <input
            name="date"
            type="date"
            className="w-full border p-2 rounded"
            required
          />
          {dateHint && (
            <p className="mt-1 text-xs text-purple-600">
              💡 {fr ? `Suggestion : ${dateHint}` : `Suggestion: ${dateHint}`}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">
            {fr ? "Précisions (optionnel)" : "Notes"}
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border p-2 rounded"
            rows={3}
          />
        </div>

        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          {fr ? "Envoyer ma demande" : "Submit"}
        </button>
      </form>
    </main>
  );
}
