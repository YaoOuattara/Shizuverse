"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Copy, Check, X, CalendarDays } from "lucide-react";

const REF_KEY = "shizu_client_ref";

export default function BookingSuccessPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";
  const router = useRouter();
  const searchParams = useSearchParams();

  const refFromUrl = searchParams.get("ref"); // e.g. "SHZ-2025-32"
  const displayRef = refFromUrl ? `#${refFromUrl}` : null;

  const [showNudge, setShowNudge] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const hasToken = !!localStorage.getItem("client_token");
    setShowNudge(!hasToken);
    // Persist ref so /bookings can auto-unlock on return
    if (refFromUrl) {
      localStorage.setItem(REF_KEY, refFromUrl);
    }
  }, [refFromUrl]);

  function handleCopy() {
    if (!displayRef) return;
    navigator.clipboard.writeText(displayRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="min-h-screen bg-[#EDF4FC] flex flex-col items-center justify-center px-4 py-16">
      {/* Success card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#B5D4F4] p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#0D2B6B]">
          {isFr ? "Demande envoyée !" : "Request sent!"}
        </h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          {isFr
            ? "Votre demande a bien été transmise. Un prestataire va vous contacter très prochainement."
            : "Your request has been submitted. A provider will contact you very soon."}
        </p>

        {/* Booking reference — prominent */}
        {displayRef && (
          <div className="mt-6 rounded-2xl bg-[#0D2B6B]/5 border border-[#0D2B6B]/15 px-5 py-4">
            <p className="text-xs font-medium text-[#0D2B6B]/70 mb-2">
              {isFr
                ? "Gardez votre numéro de réservation pour suivre votre demande"
                : "Keep your booking reference to track your request"}
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono font-bold text-[#0D2B6B] text-lg tracking-wide">
                {displayRef}
              </span>
              <button
                onClick={handleCopy}
                aria-label={isFr ? "Copier la référence" : "Copy reference"}
                className="flex items-center justify-center w-11 h-11 rounded-lg bg-[#0D2B6B]/10 hover:bg-[#0D2B6B]/20 text-[#0D2B6B] transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-[#0D2B6B]/50 mt-2">
              {isFr
                ? "Vous en aurez besoin pour consulter vos réservations"
                : "You will need it to look up your bookings"}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <Link
            href={`/${locale}/bookings`}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            {isFr ? "Suivre ma demande" : "Track my request"}
          </Link>
          <Link
            href={`/${locale}/services`}
            className="w-full min-h-[44px] flex items-center justify-center border border-[#B5D4F4] text-[#185FA5] text-sm font-medium py-2.5 rounded-xl hover:bg-[#E8F0FB] transition-colors"
          >
            {isFr ? "Réserver un autre service" : "Book another service"}
          </Link>
          <Link
            href={`/${locale}`}
            className="w-full min-h-[44px] flex items-center justify-center text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
          >
            {isFr ? "Retour à l'accueil" : "Back to home"}
          </Link>
        </div>
      </div>

      {/* Account nudge — only shown when no client_token */}
      {showNudge && (
        <div className="mt-5 bg-white border border-[#B5D4F4] rounded-2xl p-5 max-w-md w-full shadow-sm relative">
          <button
            onClick={() => setShowNudge(false)}
            className="absolute top-2 right-2 p-3 text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-[#0D2B6B] pr-6">
            {isFr
              ? "Suivez toutes vos réservations sans numéro de référence"
              : "Track all your bookings without a reference number"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isFr
              ? "Créez un compte gratuit et retrouvez toutes vos demandes en un clic."
              : "Create a free account and find all your requests in one click."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Link
              href={`/${locale}/register`}
              className="flex-1 min-h-[44px] flex items-center justify-center bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {isFr ? "Créer mon compte gratuit" : "Create my free account"}
            </Link>
            <button
              onClick={() => setShowNudge(false)}
              className="min-h-[44px] text-xs text-gray-400 hover:text-gray-600 transition-colors px-2"
            >
              {isFr ? "Non merci" : "No thanks"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
