"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, Sparkles, CheckCircle, MessageCircle, CalendarCheck,
  ShieldCheck, UserPlus, X, ChevronLeft, ChevronRight, MapPin,
} from "lucide-react";
import CommuneAutocomplete, { COMMUNES } from "@/components/CommuneAutocomplete";

interface Props {
  serviceId: string;
  locale: string;
  serviceName?: string;
}

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

// ── i18n helpers ──────────────────────────────────────────────────────────────

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const DAYS_FR = ["Lu","Ma","Me","Je","Ve","Sa","Di"];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Price ranges ──────────────────────────────────────────────────────────────

const PRICE_RANGES: [string, string][] = [
  ["ménage",         "5 000–15 000 FCFA"],
  ["nettoyage",      "5 000–15 000 FCFA"],
  ["plomberie",      "10 000–35 000 FCFA"],
  ["lectricit",      "15 000–50 000 FCFA"],   // électricité / electrical
  ["lectrique",      "15 000–50 000 FCFA"],
  ["bricolage",      "8 000–25 000 FCFA"],
  ["nounou",         "5 000–12 000 FCFA"],
  ["baby",           "5 000–12 000 FCFA"],
  ["beauté",         "5 000–20 000 FCFA"],
  ["coiffure",       "5 000–20 000 FCFA"],
  ["manucure",       "5 000–20 000 FCFA"],
  ["maquillage",     "5 000–20 000 FCFA"],
  ["jardinage",      "10 000–25 000 FCFA"],
  ["piscine",        "10 000–25 000 FCFA"],
  ["climatisation",  "12 000–40 000 FCFA"],
  ["lectroménager",  "12 000–40 000 FCFA"],
  ["senior",         "5 000–12 000 FCFA"],
];

function getPriceRange(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, range] of PRICE_RANGES) {
    if (lower.includes(key.toLowerCase())) return range;
  }
  return "Sur devis";
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7;                  // Monday-first offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── API types ─────────────────────────────────────────────────────────────────

interface ApiSubcategory { id: number; name: string; name_fr: string; name_en: string; service_id: number | null }
interface ApiCategory    { id: number; name: string; name_fr: string; name_en: string; subcategories: ApiSubcategory[] }

// ── Step labels ───────────────────────────────────────────────────────────────

const STEP_LABELS_FR = ["Service","Besoin","Date","Informations","Récap"];
const STEP_LABELS_EN = ["Service","Details","Date","Your info","Summary"];

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ step, isFr }: { step: number; isFr: boolean }) {
  const labels = isFr ? STEP_LABELS_FR : STEP_LABELS_EN;
  return (
    <div className="flex items-center justify-between mb-8">
      {labels.map((label, i) => {
        const n = i + 1;
        const done    = n < step;
        const current = n === step;
        return (
          <div key={n} className="flex flex-col items-center gap-1 flex-1">
            {/* Circle + connector line */}
            <div className="relative flex items-center w-full justify-center">
              {/* Left line */}
              {i > 0 && (
                <div className={`absolute right-1/2 top-1/2 -translate-y-1/2 h-0.5 w-full
                  ${done || current ? "bg-green-400" : "bg-gray-200"}`}
                />
              )}
              {/* Right line */}
              {i < labels.length - 1 && (
                <div className={`absolute left-1/2 top-1/2 -translate-y-1/2 h-0.5 w-full
                  ${done ? "bg-green-400" : "bg-gray-200"}`}
                />
              )}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${done    ? "bg-green-500 text-white"
                : current ? "bg-[#0F3A7A] text-white"
                          : "bg-gray-200 text-gray-400"}`}
              >
                {done ? <CheckCircle className="h-4 w-4" /> : n}
              </div>
            </div>
            <span className={`text-xs hidden sm:block ${current ? "text-[#0F3A7A] font-medium" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Input class ───────────────────────────────────────────────────────────────

const inputCls =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-[#0F3A7A]/30 focus:border-[#0F3A7A]";

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function BookingForm({ serviceId, locale, serviceName }: Props) {
  const isFr = locale === "fr";
  const searchParams = useSearchParams();

  // ── Service info (resolved from API) ─────────────────────────────────────
  const [categoryName, setCategoryName] = useState<string>("");
  const [subName, setSubName] = useState<string>(serviceName ?? "");

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((cats: ApiCategory[]) => {
        for (const cat of cats) {
          for (const sub of cat.subcategories) {
            if (String(sub.service_id) === String(serviceId)) {
              setCategoryName(isFr ? (cat.name_fr || cat.name) : (cat.name_en || cat.name));
              setSubName(isFr ? (sub.name_fr || sub.name) : (sub.name_en || sub.name));
              return;
            }
          }
        }
      })
      .catch(() => {});
  }, [serviceId, isFr]);

  // ── Multi-step state ──────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // Step 2 — pre-select urgency from URL param (?urgency=urgent_2h)
  const [urgencyChip, setUrgencyChip]   = useState<string | null>(() =>
    searchParams?.get("urgency") === "urgent_2h" ? "urgent_2h" : null
  );
  const [timeSlot, setTimeSlot]         = useState<string | null>(null);
  const [notes, setNotes]               = useState("");

  // Step 3 — calendar
  const today = new Date();
  const [calDate, setCalDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [date, setDate] = useState<string | null>(null);

  // Step 4 — commune/address pre-filled from URL params (rebook flow)
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [commune, setCommune] = useState(() => searchParams?.get("commune") ?? "");
  const [address, setAddress] = useState(() => searchParams?.get("address") ?? "");

  // ── AI intake ─────────────────────────────────────────────────────────────
  const [aiInput, setAiInput]       = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dateHint, setDateHint]     = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!aiInput.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/booking-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: aiInput, service_name: serviceName ?? "", locale }),
      });
      const data = await res.json();
      if (data.suggested_notes) setNotes(data.suggested_notes);
      if (data.suggested_date_hint) setDateHint(data.suggested_date_hint);
      if (data.suggested_location_hint) {
        const hint = (data.suggested_location_hint as string).toLowerCase();
        const match = COMMUNES.find((c) => hint.includes(c.toLowerCase()));
        if (match) setCommune(match);
      }
    } catch (err) {
      console.error("[booking-intake] error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);
  const [bookingId, setBookingId]       = useState<number | null>(null);
  const [showNudge, setShowNudge]       = useState(false);

  useEffect(() => {
    if (success) setShowNudge(!localStorage.getItem("client_token"));
  }, [success]);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    // Wake up Render if sleeping
    fetch("https://shizu-verse.onrender.com/health").catch(() => {});

    // Map new state to API fields
    const timeStr  = timeSlot === "morning" ? "09:00" : timeSlot === "afternoon" ? "13:00" : "17:00";
    const urgency  = urgencyChip === "urgent_2h" ? "urgent_2h"
                   : urgencyChip === "today"     ? "same_day"
                   : urgencyChip === "this_week" ? "under_24h"
                   : "normal";
    const timePref = timeSlot === "morning"  ? "morning"  : timeSlot === "afternoon"   ? "afternoon" : "evening";
    const location = [commune, address].filter(Boolean).join(", ");

    const [hours, minutes] = timeStr.split(":").map(Number);
    const dateObj = new Date(`${date}T00:00:00`);
    dateObj.setHours(hours, minutes, 0, 0);
    const appointmentIso = dateObj.toISOString().split(".")[0];

    const serviceIdNum = parseInt(serviceId, 10);
    const isNumericId  = !isNaN(serviceIdNum);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name:      name.trim(),
          client_phone:     phone.trim(),
          client_location:  location,
          appointment_date: appointmentIso,
          notes:            notes.trim() || undefined,
          service_name:     serviceName ?? "",
          urgency,
          time_preference:  timePref,
          ...(isNumericId ? { service_id: serviceIdNum } : { service_slug: serviceId }),
        }),
      });

      const data = await res.json().catch(() => ({})) as { id?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      localStorage.setItem("shizu_client_phone", phone.trim());
      setBookingId(data.id ?? null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen (unchanged) ────────────────────────────────────────────
  if (success) {
    const year = new Date().getFullYear();
    const ref  = bookingId ? `#SHZ-${year}-${bookingId}` : `#SHZ-${year}-???`;
    const waNumber = process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "2250700000000";
    const waText   = encodeURIComponent(
      isFr
        ? `Bonjour Shizu, j'ai une question concernant ma réservation ${ref}`
        : `Hello Shizu, I have a question about my booking ${ref}`
    );
    const waUrl = `https://wa.me/${waNumber}?text=${waText}`;

    return (
      <main className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{isFr ? "Demande envoyée !" : "Request sent!"}</h1>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            {isFr
              ? "Votre demande a bien été transmise. Un prestataire va vous contacter très prochainement."
              : "Your request has been submitted. A provider will contact you very soon."}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5">
            <CalendarCheck className="h-4 w-4 text-[#0F3A7A] shrink-0" />
            <span className="font-mono font-semibold text-[#0F3A7A] text-sm tracking-wide">{ref}</span>
          </div>
          <div className="flex flex-col gap-3 mt-6">
            <a href={`/${locale}/bookings`}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#0F3A7A] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#0d3068] transition-colors">
              <CalendarCheck className="h-4 w-4" />
              {isFr ? "Suivre ma demande" : "Track my request"}
            </a>
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-green-500 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-600 transition-colors">
              <MessageCircle className="h-4 w-4" />
              {isFr ? "Contacter sur WhatsApp" : "Contact on WhatsApp"}
            </a>
            <button
              onClick={() => {
                setSuccess(false); setBookingId(null); setStep(1);
                setUrgencyChip(null); setTimeSlot(null); setNotes(""); setDate(null);
                setName(""); setPhone(""); setCommune(""); setAddress("");
                setAiInput(""); setDateHint(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              {isFr ? "Nouvelle réservation" : "New booking"}
            </button>
          </div>
        </div>

        {showNudge && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-5 relative">
            <button onClick={() => setShowNudge(false)}
              className="absolute top-4 right-4 text-blue-300 hover:text-blue-500 transition-colors" aria-label="Dismiss">
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
                  <a href={`/${locale}/auth/register`}
                    className="bg-[#0F3A7A] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#0d3068] transition-colors text-center">
                    {isFr ? "Créer mon compte" : "Create my account"}
                  </a>
                  <button onClick={() => setShowNudge(false)}
                    className="text-xs text-blue-400 hover:text-blue-600 transition-colors px-2 text-left">
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

  // ── Calendar state helpers ────────────────────────────────────────────────
  const calYear  = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const cells    = buildCalendarCells(calYear, calMonth);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const canGoPrev =
    calYear > today.getFullYear() ||
    (calYear === today.getFullYear() && calMonth > today.getMonth());

  // ── Chip helper ───────────────────────────────────────────────────────────
  const chip = (val: string, active: boolean, onClick: () => void, label: string, urgent = false) => (
    <button key={val} type="button" onClick={onClick}
      className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all
        ${active
          ? urgent
            ? "border-red-500 bg-red-500 text-white"
            : "border-green-600 bg-green-600 text-white"
          : urgent
            ? "border-orange-400 bg-white text-orange-600 hover:border-orange-500"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
      {label}
    </button>
  );

  // ── Step content ──────────────────────────────────────────────────────────

  // Step 1: Service confirmé
  const step1 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Service confirmé" : "Service confirmed"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Voici le service que vous souhaitez réserver." : "Here is the service you want to book."}</p>
      </div>

      <div className="rounded-2xl border-2 border-[#0F3A7A]/20 bg-[#0F3A7A]/5 p-5">
        {categoryName && (
          <p className="text-xs font-semibold text-[#0F3A7A]/60 uppercase tracking-wide mb-1">{categoryName}</p>
        )}
        <p className="text-lg font-bold text-[#0F3A7A]">{subName || serviceName || (isFr ? "Service à domicile" : "Home service")}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {isFr ? "Intervention à domicile · Abidjan" : "Home service · Abidjan"}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
        {isFr ? "Prestataires vérifiés · Paiement après intervention" : "Verified providers · Payment after service"}
      </div>

      <button type="button" onClick={() => setStep(2)}
        className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors">
        {isFr ? "Continuer" : "Continue"}
      </button>
    </div>
  );

  // Step 2: Décrire votre besoin
  const urgencyOptions = isFr
    ? [{ val: "urgent_2h", label: "⚡ Urgence — 2h", urgent: true }, { val: "today", label: "Aujourd'hui" }, { val: "this_week", label: "Cette semaine" }, { val: "later", label: "3+ jours" }]
    : [{ val: "urgent_2h", label: "⚡ Urgent — 2h", urgent: true }, { val: "today", label: "Today" },       { val: "this_week", label: "This week" },      { val: "later", label: "3+ days" }];

  const timeOptions = isFr
    ? [{ val: "morning", label: "Matin · 8h–12h" }, { val: "afternoon", label: "Après-midi · 12h–17h" }, { val: "evening", label: "Soirée · 17h–20h" }]
    : [{ val: "morning", label: "Morning · 8–12" }, { val: "afternoon", label: "Afternoon · 12–17" },     { val: "evening", label: "Evening · 17–20" }];

  const step2CanContinue = !!urgencyChip && !!timeSlot;

  const step2 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Décrire votre besoin" : "Describe your need"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Aidez-nous à trouver le bon prestataire." : "Help us find the right provider."}</p>
      </div>

      {/* Urgency */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">{isFr ? "Quand avez-vous besoin du service ?" : "When do you need the service?"}</p>
        <div className="flex flex-wrap gap-2">
          {urgencyOptions.map((o) => chip(o.val, urgencyChip === o.val, () => setUrgencyChip(o.val), o.label, o.urgent))}
        </div>
      </div>

      {/* Time slot */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">{isFr ? "Quelle plage horaire vous convient ?" : "What time slot works for you?"}</p>
        <div className="flex flex-wrap gap-2">
          {timeOptions.map((o) => chip(o.val, timeSlot === o.val, () => setTimeSlot(o.val), o.label))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">{isFr ? "Précisions (optionnel)" : "Details (optional)"}</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={isFr ? "Décrivez votre besoin, accès, contraintes..." : "Describe your need, access, constraints..."}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0F3A7A]/30 focus:border-[#0F3A7A]"
        />
      </div>

      {/* AI assistant */}
      <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 space-y-3">
        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {isFr ? "Assistant IA — pré-remplissage automatique" : "AI Assistant — auto-fill"}
        </p>
        <div className="flex gap-2">
          <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder={isFr ? "Décrivez votre besoin en quelques mots..." : "Describe your need in a few words..."}
            className="flex-1 border border-purple-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button type="button" onClick={handleAnalyze} disabled={!aiInput.trim() || isAnalyzing}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors">
            {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFr ? "Analyser" : "Analyze"}
          </button>
        </div>
        {(dateHint || notes) && (
          <p className="text-xs text-purple-600">
            {isFr ? "✓ Champs pré-remplis — vous pouvez les modifier." : "✓ Fields pre-filled — you can still edit them."}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(1)}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">
          {isFr ? "Retour" : "Back"}
        </button>
        <button type="button" onClick={() => setStep(3)} disabled={!step2CanContinue}
          className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {isFr ? "Continuer" : "Continue"}
        </button>
      </div>
    </div>
  );

  // Step 3: Date — French calendar
  const step3 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Choisissez une date" : "Choose a date"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Sélectionnez votre date préférée." : "Select your preferred date."}</p>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))}
            disabled={!canGoPrev}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900 text-sm">
            {MONTHS_FR[calMonth]} {calYear}
          </span>
          <button type="button" onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} />;
            const ds      = toDateStr(calYear, calMonth, day);
            const isPast  = ds < todayStr;
            const isSel   = ds === date;
            const isToday = ds === todayStr;
            return (
              <button key={ds} type="button" disabled={isPast}
                onClick={() => setDate(ds)}
                className={`mx-auto w-9 h-9 rounded-full text-sm font-medium transition-all
                  ${isPast  ? "text-gray-300 cursor-not-allowed"
                  : isSel   ? "bg-[#0F3A7A] text-white"
                  : isToday ? "border-2 border-[#0F3A7A] text-[#0F3A7A]"
                              : "hover:bg-gray-100 text-gray-700"}`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* AI date hint */}
      {dateHint && (
        <p className="text-xs text-purple-600 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {isFr ? `Suggestion IA : ${dateHint}` : `AI suggestion: ${dateHint}`}
        </p>
      )}

      {date && (
        <p className="text-sm font-medium text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          {isFr ? formatDateFr(date) : date}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(2)}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">
          {isFr ? "Retour" : "Back"}
        </button>
        <button type="button" onClick={() => setStep(4)} disabled={!date}
          className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {isFr ? "Continuer" : "Continue"}
        </button>
      </div>
    </div>
  );

  // Step 4: Vos informations
  const step4CanContinue = name.trim() && phone.trim() && commune.trim();

  const step4 = (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Vos informations" : "Your information"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Pour que le prestataire puisse vous contacter." : "So the provider can reach you."}</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{isFr ? "Nom complet *" : "Full name *"}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Kouassi Marie" className={inputCls} required />
      </div>

      {/* Phone — +225 prefix */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{isFr ? "Numéro de téléphone *" : "Phone number *"}</label>
        <div className="flex">
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm font-medium">
            +225
          </span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="07 XX XX XX XX"
            className="flex-1 h-10 rounded-none rounded-r-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F3A7A]/30 focus:border-[#0F3A7A]"
            required />
        </div>
      </div>

      {/* Commune */}
      <CommuneAutocomplete
        label={isFr ? "Commune *" : "District *"}
        value={commune}
        onChange={setCommune}
      />

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{isFr ? "Adresse précise (optionnel)" : "Detailed address (optional)"}</label>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder={isFr ? "Rue, quartier, repère..." : "Street, neighbourhood, landmark..."}
          className={inputCls} />
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">
          {isFr
            ? "Vos données sont protégées et ne seront jamais partagées sans votre consentement."
            : "Your data is protected and will never be shared without your consent."}
        </p>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(3)}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">
          {isFr ? "Retour" : "Back"}
        </button>
        <button type="button" onClick={() => setStep(5)} disabled={!step4CanContinue}
          className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {isFr ? "Continuer" : "Continue"}
        </button>
      </div>
    </div>
  );

  // Step 5: Récapitulatif
  const urgencyLabel = isFr
    ? (urgencyChip === "urgent_2h" ? "⚡ Urgence — 2h" : urgencyChip === "today" ? "Aujourd'hui" : urgencyChip === "this_week" ? "Cette semaine" : "3+ jours")
    : (urgencyChip === "urgent_2h" ? "⚡ Urgent — 2h"  : urgencyChip === "today" ? "Today"       : urgencyChip === "this_week" ? "This week"     : "3+ days");

  const timeLabel = isFr
    ? (timeSlot === "morning" ? "Matin · 8h–12h" : timeSlot === "afternoon" ? "Après-midi · 12h–17h" : "Soirée · 17h–20h")
    : (timeSlot === "morning" ? "Morning · 8–12" : timeSlot === "afternoon" ? "Afternoon · 12–17"     : "Evening · 17–20");

  const priceRange = getPriceRange(categoryName || subName || serviceName || "");

  const RecapRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[55%]">{value}</span>
    </div>
  );

  const step5 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Récapitulatif" : "Summary"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Vérifiez les détails avant de confirmer." : "Review your details before confirming."}</p>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 px-4">
        <RecapRow label={isFr ? "Service"    : "Service"}    value={subName || serviceName || ""} />
        {categoryName && <RecapRow label={isFr ? "Catégorie" : "Category"} value={categoryName} />}
        <RecapRow label={isFr ? "Urgence"    : "Urgency"}    value={urgencyLabel} />
        <RecapRow label={isFr ? "Horaire"    : "Time slot"}  value={timeLabel} />
        <RecapRow label={isFr ? "Date"       : "Date"}       value={date ? (isFr ? formatDateFr(date) : date) : ""} />
        <RecapRow label={isFr ? "Nom"        : "Name"}       value={name} />
        <RecapRow label={isFr ? "Téléphone"  : "Phone"}      value={`+225 ${phone}`} />
        <RecapRow label={isFr ? "Commune"    : "District"}   value={commune} />
        {address && <RecapRow label={isFr ? "Adresse" : "Address"} value={address} />}
        {notes   && <RecapRow label={isFr ? "Précisions" : "Notes"} value={notes} />}
      </div>

      {/* Price range */}
      <div className="rounded-xl bg-[#0F3A7A]/5 border border-[#0F3A7A]/15 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-[#0F3A7A]/80 font-medium">{isFr ? "Fourchette indicative" : "Indicative range"}</span>
        <span className="text-sm font-bold text-[#0F3A7A]">{priceRange}</span>
      </div>

      {/* Payment note */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
        {isFr ? "Paiement après validation du prestataire" : "Payment after provider confirmation"}
      </div>

      {/* Error */}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(4)}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">
          {isFr ? "Retour" : "Back"}
        </button>
        <button type="button" onClick={handleSubmit} disabled={isSubmitting}
          className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting
            ? (isFr ? "Envoi en cours..." : "Sending...")
            : (isFr ? "Confirmer la réservation" : "Confirm booking")}
        </button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <ProgressBar step={step} isFr={isFr} />
      {step === 1 && step1}
      {step === 2 && step2}
      {step === 3 && step3}
      {step === 4 && step4}
      {step === 5 && step5}
    </main>
  );
}
