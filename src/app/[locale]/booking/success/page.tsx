"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Copy, Check, UserPlus, X, CalendarDays } from "lucide-react";

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
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      {/* Success card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
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

        {/* Booking reference — prominent */}
        {displayRef && (
          <div className="mt-6 rounded-2xl bg-[#0F3A7A]/5 border border-[#0F3A7A]/15 px-5 py-4">
            <p className="text-xs font-medium text-[#0F3A7A]/70 mb-2">
              {isFr
                ? "Gardez votre numéro de réservation pour suivre votre demande"
                : "Keep your booking reference to track your request"}
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono font-bold text-[#0F3A7A] text-lg tracking-wide">
                {displayRef}
              </span>
              <button
                onClick={handleCopy}
                aria-label={isFr ? "Copier la référence" : "Copy reference"}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F3A7A]/10 hover:bg-[#0F3A7A]/20 text-[#0F3A7A] transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-[#0F3A7A]/50 mt-2">
              {isFr
                ? "Vous en aurez besoin pour consulter vos réservations"
                : "You will need it to look up your bookings"}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <Link
            href={`/${locale}/bookings`}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            {isFr ? "Suivre ma demande" : "Track my request"}
          </Link>
          <Link
            href={`/${locale}/services`}
            className="w-full border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {isFr ? "Réserver un autre service" : "Book another service"}
          </Link>
          <Link
            href={`/${locale}`}
            className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
          >
            {isFr ? "Retour à l'accueil" : "Back to home"}
          </Link>
        </div>
      </div>

      {/* Account nudge — only for anonymous users */}
      {showNudge && (
        <div className="mt-5 bg-blue-50 border border-blue-100 rounded-2xl p-6 max-w-md w-full relative">
          <button
            onClick={() => setShowNudge(false)}
            className="absolute top-4 right-4 text-blue-300 hover:text-blue-500 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-[#0F3A7A]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0F3A7A] text-sm">
                {isFr
                  ? "Suivez vos réservations en temps réel"
                  : "Track your bookings in real time"}
              </h2>
              <p className="text-blue-700/70 text-xs mt-1 leading-relaxed">
                {isFr
                  ? "Créez un compte gratuit pour consulter l'état de vos réservations, contacter votre prestataire et gérer vos demandes."
                  : "Create a free account to check your booking status, contact your provider, and manage your requests."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Link
                  href={`/${locale}/auth/register`}
                  className="bg-[#0F3A7A] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#0d3068] transition-colors text-center"
                >
                  {isFr ? "Créer mon compte" : "Create my account"}
                </Link>
                <button
                  onClick={() => setShowNudge(false)}
                  className="text-xs text-blue-400 hover:text-blue-600 transition-colors px-2"
                >
                  {isFr ? "Non merci, continuer sans compte" : "No thanks, continue without account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
