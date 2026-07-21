"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { timeSlotLabel } from "@/lib/timeSlots";
import {
  Loader2, CheckCircle, XCircle, ShieldCheck, MessageCircle,
  Calendar, MapPin, Sparkles, Copy, Check,
} from "lucide-react";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
const BLUE = "#0F3A7A";

interface Quote {
  service_name: string;
  amount_xof: number | null;
  payment_tier: string | null;
  deposit_amount: number | null;
  quote_note: string | null;
  appointment_date: string | null;
  time_slot: string | null;
  commune: string | null;
  status: string;
}

type DeclineReason = "trop_cher" | "plus_disponible" | "trouve_ailleurs" | "autre";

const REASONS: { value: DeclineReason; fr: string; en: string }[] = [
  { value: "trop_cher",       fr: "Trop cher",               en: "Too expensive" },
  { value: "plus_disponible", fr: "Je ne suis plus disponible", en: "No longer available" },
  { value: "trouve_ailleurs", fr: "J'ai trouvé ailleurs",    en: "Found elsewhere" },
  { value: "autre",           fr: "Autre",                   en: "Other" },
];

function tierLabel(tier: string | null, isFr: boolean): string | null {
  switch (tier) {
    case "after_service": return isFr ? "Paiement à la fin de la prestation." : "Payment at completion.";
    case "deposit_30":    return isFr ? "Acompte de 30 % à la confirmation, solde à la fin." : "30% deposit on confirmation, balance at completion.";
    case "deposit_40":    return isFr ? "Acompte de 40 % à la confirmation, solde à la fin." : "40% deposit on confirmation, balance at completion.";
    case "full_prepay":   return isFr ? "Paiement intégral avant le début de la prestation." : "Full payment before the service begins.";
    default: return null;
  }
}

const fmtMoney = (n: number | null) =>
  n != null ? new Intl.NumberFormat("fr-FR").format(n) + " FCFA" : "—";

function fmtDate(iso: string | null, isFr: boolean): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(isFr ? "fr-FR" : "en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Payment instructions (shown only after acceptance) ──────────────────────
interface PaymentInfo {
  payment_tier: string | null;
  amount_xof: number | null;
  deposit_amount: number | null;
  payment_methods: Record<string, string>;
}

const METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange: "Orange Money",
  mtn: "MTN MoMo",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 w-full rounded-2xl border border-gray-200 bg-white p-5 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BLUE }}>{title}</p>
      {children}
    </div>
  );
}

function CopyRow({ label, value, isFr }: { label: string; value: string; isFr: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the number stays visible for manual entry */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-base font-semibold text-gray-900 tabular-nums truncate">{value}</p>
      </div>
      <button
        onClick={copy}
        aria-label={isFr ? `Copier le numéro ${label}` : `Copy ${label} number`}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
        style={copied ? { backgroundColor: "#16a34a", color: "#fff" } : { backgroundColor: `${BLUE}0D`, color: BLUE }}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? (isFr ? "Copié" : "Copied") : (isFr ? "Copier" : "Copy")}
      </button>
    </div>
  );
}

function PaymentInstructions({ info, isFr, waUrl }: { info: PaymentInfo; isFr: boolean; waUrl: string }) {
  const title = isFr ? "Comment payer" : "How to pay";
  const tier = info.payment_tier;
  const methods = info.payment_methods || {};
  const methodKeys = Object.keys(methods).filter((k) => methods[k]);

  // after_service: nothing is due now — never surface any number.
  if (tier === "after_service") {
    return (
      <Section title={title}>
        <p className="text-sm text-gray-700 leading-relaxed">
          {isFr
            ? "Rien à régler maintenant. Vous paierez à la fin de la prestation."
            : "Nothing to pay now. You'll pay at the end of the service."}
        </p>
      </Section>
    );
  }

  // Lead sentence + which amount matters, per tier (deposit_40 == deposit_30).
  let lead: string;
  if (tier === "deposit_30" || tier === "deposit_40") {
    lead = isFr
      ? `Acompte de ${fmtMoney(info.deposit_amount)} à régler pour confirmer votre réservation.`
      : `Deposit of ${fmtMoney(info.deposit_amount)} to confirm your booking.`;
  } else if (tier === "full_prepay") {
    lead = isFr
      ? `Montant de ${fmtMoney(info.amount_xof)} à régler avant le début de la prestation.`
      : `Amount of ${fmtMoney(info.amount_xof)} to pay before the service begins.`;
  } else {
    // null / unknown tier: show the amount, no tier phrasing.
    lead = isFr
      ? `Montant à régler : ${fmtMoney(info.amount_xof)}.`
      : `Amount to pay: ${fmtMoney(info.amount_xof)}.`;
  }

  return (
    <Section title={title}>
      <p className="text-sm text-gray-700 leading-relaxed">{lead}</p>

      {methodKeys.length > 0 ? (
        <>
          <div className="mt-3 space-y-2">
            {methodKeys.map((k) => (
              <CopyRow key={k} label={METHOD_LABELS[k] ?? k} value={methods[k]} isFr={isFr} />
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500 leading-relaxed">
            <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            {isFr
              ? "Shizu ne demande jamais de paiement directement à un prestataire. Tout règlement passe par les numéros ci-dessus."
              : "Shizu never asks you to pay a provider directly. All payments go through the numbers above."}
          </p>
        </>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            {isFr
              ? "Pour régler votre prestation, contactez Shizu."
              : "To pay for your service, contact Shizu."}
          </p>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
             className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors">
            <MessageCircle className="h-4 w-4" />
            {isFr ? "Contacter Shizu sur WhatsApp" : "Contact Shizu on WhatsApp"}
          </a>
        </div>
      )}
    </Section>
  );
}

export default function QuotePage() {
  const params = useParams();
  const locale = (params?.locale as string) || "fr";
  const token = params?.token as string;
  const isFr = locale === "fr";

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [errKind, setErrKind] = useState<"none" | "not_found" | "expired" | "already" | "network">("none");
  const [alreadyStatus, setAlreadyStatus] = useState<string | null>(null);
  const [payInfo, setPayInfo] = useState<PaymentInfo | null>(null);

  const [declineMode, setDeclineMode] = useState(false);
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const waNumber = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "2250700000000").replace("+", "");
  const waUrl = `https://wa.me/${waNumber}`;

  // PaymentInstructions renders its OWN WhatsApp button ONLY in the "no number
  // available" case (money is due but SHIZU_WAVE/ORANGE/MTN are empty). Only
  // then do we drop the generic ContactShizu to avoid two identical buttons —
  // when numbers show (or for after_service) the pay block has no help link, so
  // the client keeps ContactShizu for any non-payment question.
  const payBlockCarriesWhatsApp =
    !!payInfo &&
    payInfo.payment_tier !== "after_service" &&
    Object.keys(payInfo.payment_methods ?? {}).length === 0;

  useEffect(() => {
    if (!token) return;
    fetch(`${FLASK_API}/api/quote/${token}`)
      .then(async (res) => {
        if (res.ok) { setQuote(await res.json()); return; }
        if (res.status === 404) setErrKind("not_found");
        else if (res.status === 410) setErrKind("expired");
        else if (res.status === 409) {
          const b = await res.json().catch(() => ({}));
          const decision = b?.decision ?? b?.status ?? null;
          setAlreadyStatus(decision);
          if (decision === "accepted") {
            setPayInfo({
              payment_tier: b?.payment_tier ?? null,
              amount_xof: b?.amount_xof ?? null,
              deposit_amount: b?.deposit_amount ?? null,
              payment_methods: b?.payment_methods ?? {},
            });
          }
          setErrKind("already");
        } else setErrKind("network");
      })
      .catch(() => setErrKind("network"))
      .finally(() => setLoading(false));
  }, [token]);

  const act = async (path: string, body?: object) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${FLASK_API}/api/quote/${token}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (res.ok) {
        if (path === "accept") {
          const b = await res.json().catch(() => ({}));
          setPayInfo({
            payment_tier: b?.payment_tier ?? quote?.payment_tier ?? null,
            amount_xof: b?.amount_xof ?? quote?.amount_xof ?? null,
            deposit_amount: b?.deposit_amount ?? quote?.deposit_amount ?? null,
            payment_methods: b?.payment_methods ?? {},
          });
        }
        setDone(path === "accept" ? "accepted" : "declined");
      } else if (res.status === 409) {
        const b = await res.json().catch(() => ({}));
        setAlreadyStatus(b?.decision ?? b?.status ?? null);
        setErrKind("already");
      } else if (res.status === 410) {
        setErrKind("expired");
      } else {
        setErrKind("network");
      }
    } catch {
      setErrKind("network");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shells ────────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-[100dvh] bg-gray-50 px-4 py-8 flex flex-col">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">{children}</div>
    </main>
  );

  const ContactShizu = () => (
    <a href={waUrl} target="_blank" rel="noopener noreferrer"
       className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors">
      <MessageCircle className="h-4 w-4" />
      {isFr ? "Contacter Shizu sur WhatsApp" : "Contact Shizu on WhatsApp"}
    </a>
  );

  if (loading) {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: BLUE }} />
        </div>
      </Shell>
    );
  }

  // ── Error / already-decided screens ───────────────────────────────────────
  if (errKind !== "none" && !done) {
    const title =
      errKind === "expired" ? (isFr ? "Lien expiré" : "Link expired")
      : errKind === "already" ? (isFr ? "Devis déjà traité" : "Quote already handled")
      : errKind === "not_found" ? (isFr ? "Lien invalide" : "Invalid link")
      : (isFr ? "Connexion impossible" : "Connection error");
    const body =
      errKind === "expired" ? (isFr ? "Ce devis a expiré. Contactez Shizu pour en recevoir un nouveau." : "This quote has expired. Contact Shizu for a new one.")
      : errKind === "already" ? (alreadyStatus === "accepted"
          ? (isFr ? "Ce devis a déjà été accepté. Merci !" : "This quote was already accepted. Thank you!")
          : (isFr ? "Ce devis a déjà été refusé." : "This quote was already declined."))
      : errKind === "not_found" ? (isFr ? "Ce lien n'est pas valide. Vérifiez le message reçu ou contactez Shizu." : "This link isn't valid. Check your message or contact Shizu.")
      : (isFr ? "Réessayez dans un instant." : "Please try again shortly.");
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ShieldCheck className="h-7 w-7 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">{body}</p>
          {errKind === "already" && alreadyStatus === "accepted" && payInfo && (
            <PaymentInstructions info={payInfo} isFr={isFr} waUrl={waUrl} />
          )}
          {!(errKind === "already" && alreadyStatus === "accepted" && payInfo && payBlockCarriesWhatsApp) && (
            <ContactShizu />
          )}
        </div>
      </Shell>
    );
  }

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (done) {
    const accepted = done === "accepted";
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${accepted ? "bg-green-50" : "bg-gray-100"}`}>
            {accepted ? <CheckCircle className="h-8 w-8 text-green-500" /> : <XCircle className="h-8 w-8 text-gray-400" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {accepted ? (isFr ? "Devis accepté !" : "Quote accepted!") : (isFr ? "Devis refusé" : "Quote declined")}
          </h1>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
            {accepted
              ? (isFr ? "Merci ! Nous assignons un prestataire vérifié et revenons vers vous très vite." : "Thank you! We're assigning a verified provider and will get back to you shortly.")
              : (isFr ? "Merci pour votre retour, il nous aide à nous améliorer." : "Thank you for your feedback — it helps us improve.")}
          </p>

          {accepted && payInfo && (
            <PaymentInstructions info={payInfo} isFr={isFr} waUrl={waUrl} />
          )}

          {accepted && (
            <div className="mt-6 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" style={{ color: BLUE }} />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {isFr ? "Créez un compte pour suivre vos réservations" : "Create an account to track your bookings"}
                </p>
                <a href={`/${locale}/auth/register`} className="text-sm font-semibold" style={{ color: BLUE }}>
                  {isFr ? "Créer mon compte →" : "Create my account →"}
                </a>
              </div>
            </div>
          )}
          {/* Keep the generic help link, except when the pay block already
              carries its own WhatsApp (the no-number-available case). */}
          {!(accepted && payInfo && payBlockCarriesWhatsApp) && <ContactShizu />}
        </div>
      </Shell>
    );
  }

  if (!quote) return null;

  // ── Decline reason screen ─────────────────────────────────────────────────
  if (declineMode) {
    return (
      <Shell>
        <button onClick={() => setDeclineMode(false)} className="text-sm text-gray-400 mb-4 self-start">
          {isFr ? "← Retour" : "← Back"}
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isFr ? "Pourquoi refusez-vous ?" : "Why are you declining?"}</h1>
        <p className="text-gray-500 text-sm mt-1">{isFr ? "Votre retour nous aide à ajuster nos prix." : "Your feedback helps us adjust our pricing."}</p>

        <div className="mt-5 space-y-2">
          {REASONS.map((r) => (
            <button key={r.value} onClick={() => setReason(r.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                reason === r.value ? "border-transparent text-white" : "border-gray-200 bg-white text-gray-700"}`}
              style={reason === r.value ? { backgroundColor: BLUE } : undefined}>
              {isFr ? r.fr : r.en}
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={isFr ? "Commentaire (optionnel)" : "Comment (optional)"}
          className="mt-4 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />

        <div className="mt-auto pt-6">
          <button
            disabled={!reason || submitting}
            onClick={() => act("decline", { reason, comment })}
            className="w-full inline-flex items-center justify-center gap-2 text-white text-sm font-semibold py-3.5 rounded-xl disabled:opacity-50"
            style={{ backgroundColor: BLUE }}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isFr ? "Confirmer le refus" : "Confirm decline"}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Quote screen ──────────────────────────────────────────────────────────
  const tl = tierLabel(quote.payment_tier, isFr);
  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{isFr ? "Votre devis Shizu" : "Your Shizu quote"}</p>
      <h1 className="text-xl font-bold text-gray-900 mt-1">{quote.service_name}</h1>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 text-center">
        <p className="text-sm text-gray-500">{isFr ? "Montant" : "Amount"}</p>
        <p className="text-4xl font-extrabold mt-1" style={{ color: BLUE }}>{fmtMoney(quote.amount_xof)}</p>
      </div>

      {tl && (
        <div className="mt-3 rounded-xl bg-[#0F3A7A]/5 border border-[#0F3A7A]/15 px-4 py-3">
          <p className="text-xs font-semibold" style={{ color: BLUE }}>{isFr ? "Modalité de paiement" : "Payment terms"}</p>
          <p className="text-sm text-gray-700 mt-0.5">{tl}</p>
        </div>
      )}

      {quote.quote_note && (
        <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-600 leading-relaxed">{quote.quote_note}</p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 px-4">
        <div className="flex items-center gap-2 py-2.5 text-sm text-gray-700">
          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
          {fmtDate(quote.appointment_date, isFr)}{quote.time_slot ? ` · ${timeSlotLabel(quote.time_slot, isFr)}` : ""}
        </div>
        {quote.commune && (
          <div className="flex items-center gap-2 py-2.5 text-sm text-gray-700">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            {quote.commune}
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 space-y-3">
        <button
          disabled={submitting}
          onClick={() => act("accept")}
          className="w-full inline-flex items-center justify-center gap-2 text-white text-base font-semibold py-3.5 rounded-xl disabled:opacity-50"
          style={{ backgroundColor: BLUE }}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          {isFr ? "Accepter le devis" : "Accept quote"}
        </button>
        <button
          disabled={submitting}
          onClick={() => setDeclineMode(true)}
          className="w-full inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-3 rounded-xl disabled:opacity-50">
          {isFr ? "Refuser" : "Decline"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
          {isFr ? "Aucun paiement avant votre acceptation" : "No payment before you accept"}
        </p>
      </div>
    </Shell>
  );
}
