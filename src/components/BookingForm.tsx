"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, Sparkles, CheckCircle, MessageCircle, CalendarCheck,
  ShieldCheck, UserPlus, X, ChevronLeft, ChevronRight, MapPin, Check,
} from "lucide-react";
import PhoneInput from "@/components/PhoneInput";
import { formatPrice, type CategoryPricing } from "@/lib/formatPrice";

interface Props {
  serviceId: string;
  locale: string;
  serviceName?: string;
}

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

const LAUNCH_ZONES = ["Cocody", "Bingerville", "Marcory", "Zone 4", "Biétry"];

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

// ── Calendar helpers ──────────────────────────────────────────────────────────

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = (firstDow + 6) % 7;
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
interface ApiCategory extends CategoryPricing { id: number; name: string; name_fr: string; name_en: string; subcategories: ApiSubcategory[] }

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
            <div className="relative flex items-center w-full justify-center">
              {i > 0 && (
                <div className={`absolute right-1/2 top-1/2 -translate-y-1/2 h-0.5 w-full
                  ${done || current ? "bg-green-400" : "bg-gray-200"}`}
                />
              )}
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

  // ── Service info ──────────────────────────────────────────────────────────
  const [categoryName, setCategoryName] = useState<string>("");
  const [subName, setSubName] = useState<string>(serviceName ?? "");
  // Indicative pricing of the matched category (display only, from the API)
  const [pricing, setPricing] = useState<CategoryPricing | null>(null);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((cats: ApiCategory[]) => {
        for (const cat of cats) {
          for (const sub of cat.subcategories) {
            if (String(sub.service_id) === String(serviceId)) {
              setCategoryName(isFr ? (cat.name_fr || cat.name) : (cat.name_en || cat.name));
              setSubName(isFr ? (sub.name_fr || sub.name) : (sub.name_en || sub.name));
              setPricing({
                price_min: cat.price_min,
                price_max: cat.price_max,
                is_quote_based: cat.is_quote_based,
              });
              return;
            }
          }
        }
      })
      .catch(() => {});
  }, [serviceId, isFr]);

  // ── Multi-step state ──────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  const providerParam     = searchParams?.get("provider") ?? null;
  const providerNameParam = searchParams?.get("providerName") ?? null;
  const providerNote      = providerParam && providerNameParam
    ? `Demande pour le prestataire : ${providerNameParam}`
    : null;

  const [urgencyChip, setUrgencyChip] = useState<string | null>(() =>
    searchParams?.get("urgency") === "urgent_2h" ? "urgent_2h" : null
  );
  const [timeSlot, setTimeSlot]  = useState<string | null>(null);
  const [notes, setNotes]        = useState("");

  // Calendar
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [calDate, setCalDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [date, setDate] = useState<string | null>(null);

  // Auto-set date to today when urgent_2h is selected (including from URL param)
  useEffect(() => {
    if (urgencyChip === "urgent_2h" && !date) {
      setDate(todayStr);
    }
  }, [urgencyChip, todayStr, date]);

  // Step 4
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [commune, setCommune] = useState(() => searchParams?.get("commune") ?? "");
  const [address, setAddress] = useState(() => searchParams?.get("address") ?? "");

  // Waitlist state
  const [waitlistOpen, setWaitlistOpen]           = useState(false);
  const [waitlistCommune, setWaitlistCommune]     = useState("");
  const [waitlistPhone, setWaitlistPhone]         = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess]     = useState(false);

  // ── AI intake ─────────────────────────────────────────────────────────────
  const [aiInput, setAiInput]         = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dateHint, setDateHint]       = useState<string | null>(null);

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
        const match = LAUNCH_ZONES.find((c) => hint.includes(c.toLowerCase()));
        if (match) setCommune(match);
      }
    } catch (err) {
      console.error("[booking-intake] error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Waitlist handler ──────────────────────────────────────────────────────
  const handleWaitlistSubmit = async () => {
    if (!waitlistCommune.trim() || !waitlistPhone.trim() || waitlistSubmitting) return;
    setWaitlistSubmitting(true);
    try {
      await fetch(`${FLASK_API}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commune: waitlistCommune.trim(), phone: waitlistPhone.trim() }),
      });
      setWaitlistSuccess(true);
    } catch {
      setWaitlistSuccess(true); // silent fail — still show success
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
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

    fetch("https://shizu-verse.onrender.com/health").catch(() => {});

    const effectiveDate = date ?? todayStr;
    const timeStr  = timeSlot === "morning" ? "09:00" : timeSlot === "afternoon" ? "13:00" : "17:00";
    const urgency  = urgencyChip === "urgent_2h" ? "urgent_2h"
                   : urgencyChip === "today"     ? "same_day"
                   : urgencyChip === "this_week" ? "under_24h"
                   : "normal";
    const timePref = timeSlot === "morning" ? "morning" : timeSlot === "afternoon" ? "afternoon" : "evening";
    const location = [commune, address].filter(Boolean).join(", ");

    const [hours, minutes] = timeStr.split(":").map(Number);
    const dateObj = new Date(`${effectiveDate}T00:00:00`);
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
          locale,   // capture the client's active UI language for all downstream messaging
          notes:            [providerNote, notes.trim()].filter(Boolean).join('\n') || undefined,
          service_name:     serviceName ?? "",
          urgency,
          time_preference:  timePref,
          ...(isNumericId ? { service_id: serviceIdNum } : { service_slug: serviceId }),
        }),
      });

      const data = await res.json().catch(() => ({})) as { id?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      localStorage.setItem("shizu_client_phone", phone.trim());
      if (data.id) {
        const year = new Date().getFullYear();
        localStorage.setItem("shizu_client_ref", `SHZ-${year}-${data.id}`);
      }
      setBookingId(data.id ?? null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
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

          {/* Next-step note — sets expectation on the WhatsApp quote */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-[#0F3A7A]/5 border border-[#0F3A7A]/15 px-4 py-3 text-left">
            <MessageCircle className="h-4 w-4 text-[#0F3A7A] shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="font-semibold text-[#0F3A7A]">{isFr ? "Prochaine étape : " : "Next step: "}</span>
              {isFr
                ? "notre équipe vous envoie un devis précis sur WhatsApp sous 2h (8h–20h). Vous confirmez, et nous assignons un prestataire vérifié."
                : "our team sends you an accurate quote on WhatsApp within 2h (8am–8pm). You confirm, and we assign a verified provider."}
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <a href={`/${locale}/bookings`}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#0F3A7A] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#0d3068] transition-colors">
              <CalendarCheck className="h-4 w-4" />
              {isFr ? "Suivre ma demande" : "Track my request"}
            </a>
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors">
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

  // ── Calendar state ────────────────────────────────────────────────────────
  const calYear  = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const cells    = buildCalendarCells(calYear, calMonth);

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

  // ── Step 1: Service confirmé ──────────────────────────────────────────────
  const isRebook = searchParams?.get("rebook") === "true";

  const step1 = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Service confirmé" : "Service confirmed"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Voici le service que vous souhaitez réserver." : "Here is the service you want to book."}</p>
      </div>

      {isRebook && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-2.5">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            {isFr
              ? "Vous réservez à nouveau ce service. Vos informations ont été pré-remplies."
              : "You are re-booking this service. Your details have been pre-filled."}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-[#0F3A7A]/10 bg-[#0F3A7A]/5 p-4">
        {categoryName && (
          <p className="text-xs font-semibold text-[#0F3A7A]/60 uppercase tracking-wide mb-1">{categoryName}</p>
        )}
        <p className="text-lg font-bold text-[#0F3A7A]">{subName || serviceName || (isFr ? "Service à domicile" : "Home service")}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
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
        {isFr ? "C'est parti →" : "Let's go →"}
      </button>
    </div>
  );

  // ── Step 2: Décrire votre besoin ──────────────────────────────────────────
  const urgencyOptions = isFr
    ? [{ val: "urgent_2h", label: "⚡ Urgence — 2h", urgent: true }, { val: "today", label: "Aujourd'hui" }, { val: "this_week", label: "Cette semaine" }, { val: "later", label: "3+ jours" }]
    : [{ val: "urgent_2h", label: "⚡ Urgent — 2h", urgent: true }, { val: "today", label: "Today" }, { val: "this_week", label: "This week" }, { val: "later", label: "3+ days" }];

  const timeOptions = isFr
    ? [{ val: "morning", label: "Matin · 8h–12h" }, { val: "afternoon", label: "Après-midi · 12h–17h" }, { val: "evening", label: "Soirée · 17h–20h" }]
    : [{ val: "morning", label: "Morning · 8–12" }, { val: "afternoon", label: "Afternoon · 12–17" }, { val: "evening", label: "Evening · 17–20" }];

  const step2CanContinue = !!urgencyChip && !!timeSlot;

  const step2 = (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Décrire votre besoin" : "Describe your need"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Aidez-nous à trouver le bon prestataire." : "Help us find the right provider."}</p>
      </div>

      {/* Urgency */}
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">{isFr ? "Quand ?" : "When?"}</p>
        <div className="flex flex-wrap gap-2">
          {urgencyOptions.map((o) => chip(o.val, urgencyChip === o.val, () => setUrgencyChip(o.val), o.label, o.urgent))}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Time slot */}
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">{isFr ? "À quelle heure ?" : "What time?"}</p>
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
        <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
          {isFr
            ? "✨ Décrivez votre besoin — l'IA Shizu pré-remplit le formulaire pour vous"
            : "✨ Describe your need — Shizu AI pre-fills the form for you"}
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

  // ── Step 3: Date ──────────────────────────────────────────────────────────
  const isUrgent = urgencyChip === "urgent_2h";

  const step3 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Choisissez une date" : "Choose a date"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Sélectionnez votre date préférée." : "Select your preferred date."}</p>
      </div>

      {isUrgent ? (
        <div className="rounded-2xl bg-green-50 border-2 border-green-200 p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Check className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-green-800 text-sm">
              {isFr ? "Intervention dès que possible" : "As soon as possible"}
            </p>
            <p className="text-green-700 text-xs mt-0.5">
              {isFr ? "dans les 2 heures" : "within 2 hours"}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Calendar */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
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

            <div className="grid grid-cols-7 mb-2">
              {DAYS_FR.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>

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
        </>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(2)}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">
          {isFr ? "Retour" : "Back"}
        </button>
        <button type="button" onClick={() => setStep(4)} disabled={!isUrgent && !date}
          className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {isFr ? "Continuer" : "Continue"}
        </button>
      </div>
    </div>
  );

  // ── Step 4: Vos informations ──────────────────────────────────────────────
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

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{isFr ? "Numéro de téléphone *" : "Phone number *"}</label>
        <PhoneInput
          defaultValue={phone}
          onChange={setPhone}
          placeholder="07 XX XX XX XX"
          required
          selectClassName="rounded-l-md border-gray-300 bg-gray-50 text-gray-500 focus:ring-[#0F3A7A]/30"
          inputClassName="rounded-none rounded-r-md border-gray-300 bg-white py-2 focus:ring-[#0F3A7A]/30 focus:border-[#0F3A7A]"
        />
      </div>

      {/* Commune chips */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{isFr ? "Commune *" : "District *"}</label>
        <div className="flex flex-wrap gap-2">
          {LAUNCH_ZONES.map((zone) => (
            <button key={zone} type="button"
              onClick={() => setCommune(zone)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all
                ${commune === zone
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
              {zone}
            </button>
          ))}
        </div>

        {/* Waitlist link */}
        {!waitlistOpen && !waitlistSuccess && (
          <button type="button"
            onClick={() => { setWaitlistOpen(true); setWaitlistPhone(phone); }}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline transition-colors">
            {isFr ? "Ma zone n'est pas listée →" : "My zone isn't listed →"}
          </button>
        )}

        {/* Inline waitlist form */}
        {waitlistOpen && !waitlistSuccess && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700">
              {isFr ? "Rejoindre la liste d'attente" : "Join the waitlist"}
            </p>
            <input type="text" value={waitlistCommune}
              onChange={(e) => setWaitlistCommune(e.target.value)}
              placeholder={isFr ? "Votre commune (ex: Yopougon)" : "Your district (e.g. Yopougon)"}
              className={inputCls} />
            <PhoneInput
              defaultValue={waitlistPhone}
              onChange={setWaitlistPhone}
              placeholder="07 XX XX XX XX"
              selectClassName="rounded-l-md border-gray-300 bg-gray-50 text-gray-500 focus:ring-[#0F3A7A]/30"
              inputClassName="rounded-none rounded-r-md border-gray-300 bg-white py-2 focus:ring-[#0F3A7A]/30 focus:border-[#0F3A7A]"
            />
            <button type="button" onClick={handleWaitlistSubmit}
              disabled={!waitlistCommune.trim() || !waitlistPhone.trim() || waitlistSubmitting}
              className="w-full bg-green-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
              {waitlistSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isFr ? "Me prévenir" : "Notify me"}
            </button>
          </div>
        )}

        {waitlistSuccess && (
          <p className="mt-3 text-xs text-green-600 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {isFr
              ? "Merci ! Nous vous préviendrons dès que Shizu arrive dans votre quartier."
              : "Thanks! We'll notify you when Shizu reaches your area."}
          </p>
        )}
      </div>

      {/* Address (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isFr ? "Adresse ou point de repère (optionnel)" : "Address or landmark (optional)"}
        </label>
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

  // ── Step 5: Récapitulatif ─────────────────────────────────────────────────
  const urgencyLabel = isFr
    ? (urgencyChip === "urgent_2h" ? "⚡ Urgence — 2h" : urgencyChip === "today" ? "Aujourd'hui" : urgencyChip === "this_week" ? "Cette semaine" : "3+ jours")
    : (urgencyChip === "urgent_2h" ? "⚡ Urgent — 2h"  : urgencyChip === "today" ? "Today"       : urgencyChip === "this_week" ? "This week"     : "3+ days");

  const timeLabel = isFr
    ? (timeSlot === "morning" ? "Matin · 8h–12h" : timeSlot === "afternoon" ? "Après-midi · 12h–17h" : "Soirée · 17h–20h")
    : (timeSlot === "morning" ? "Morning · 8–12" : timeSlot === "afternoon" ? "Afternoon · 12–17"     : "Evening · 17–20");

  const priceRange = formatPrice(pricing, isFr);

  const RecapRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[55%]">{value}</span>
    </div>
  );

  const effectiveDate = date ?? todayStr;

  const step5 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{isFr ? "Récapitulatif" : "Summary"}</h2>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Vérifiez les détails avant de confirmer." : "Review your details before confirming."}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 px-4">
        <RecapRow label={isFr ? "Service"    : "Service"}    value={subName || serviceName || ""} />
        {categoryName && <RecapRow label={isFr ? "Catégorie" : "Category"} value={categoryName} />}
        <RecapRow label={isFr ? "Urgence"    : "Urgency"}    value={urgencyLabel} />
        <RecapRow label={isFr ? "Horaire"    : "Time slot"}  value={timeLabel} />
        <RecapRow label={isFr ? "Date"       : "Date"}       value={isFr ? formatDateFr(effectiveDate) : effectiveDate} />
        <RecapRow label={isFr ? "Nom"        : "Name"}       value={name} />
        <RecapRow label={isFr ? "Téléphone"  : "Phone"}      value={phone} />
        <RecapRow label={isFr ? "Commune"    : "District"}   value={commune} />
        {address && <RecapRow label={isFr ? "Adresse" : "Address"} value={address} />}
        {notes   && <RecapRow label={isFr ? "Précisions" : "Notes"} value={notes} />}
      </div>

      <div className="rounded-xl bg-[#0F3A7A]/5 border border-[#0F3A7A]/15 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-[#0F3A7A]/80 font-medium">{isFr ? "Fourchette indicative" : "Indicative range"}</span>
        <span className="text-sm font-bold text-[#0F3A7A]">{priceRange}</span>
      </div>

      {/* Price-expectation note — adapted to the category pricing mode */}
      <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <MessageCircle className="h-4 w-4 text-[#0F3A7A] shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          {pricing?.is_quote_based
            ? (isFr
                ? "Ce service nécessite une évaluation. Nous vous envoyons un devis précis sur WhatsApp sous 2h (8h–20h). Aucun engagement avant votre accord."
                : "This service requires an assessment. We'll send you an accurate quote on WhatsApp within 2h (8am–8pm). No commitment until you approve it.")
            : (isFr
                ? "Le prix final dépend de votre commune, de l'urgence et de l'ampleur du travail. Un devis précis vous sera envoyé sur WhatsApp avant toute intervention. Vous ne payez rien avant de l'avoir accepté."
                : "The final price depends on your district, urgency and the scope of the work. An accurate quote will be sent to you on WhatsApp before any work begins. You pay nothing until you've accepted it.")}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
        {isFr ? "Paiement après validation du prestataire" : "Payment after provider confirmation"}
      </div>

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
