"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Droplets, Zap, Wind, Lock, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface ApiCategory {
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
}

interface UrgentCard {
  matchFr: string;
  labelFr: string;
  labelEn: string;
  Icon: LucideIcon;
  staticHref?: string; // used for "Autre urgence" which has no category
}

const URGENT_CARDS: UrgentCard[] = [
  { matchFr: "plomb",   labelFr: "Fuite d'eau",            labelEn: "Water leak",       Icon: Droplets  },
  { matchFr: "électr",  labelFr: "Panne électrique",       labelEn: "Power failure",    Icon: Zap       },
  { matchFr: "clim",    labelFr: "Climatisation en panne", labelEn: "AC breakdown",     Icon: Wind      },
  { matchFr: "bricol",  labelFr: "Serrure / porte",        labelEn: "Lock / door",      Icon: Lock      },
  {
    matchFr: "",
    labelFr: "Autre urgence",
    labelEn: "Other emergency",
    Icon: HelpCircle,
    staticHref: "services?urgency=urgent",
  },
];

export default function UrgentBookingPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";
  const router = useRouter();

  const [categories, setCategories] = useState<ApiCategory[]>([]);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const getHref = (card: UrgentCard): string => {
    if (card.staticHref) return `/${locale}/${card.staticHref}`;
    const match = categories.find((c) =>
      (c.name_fr || c.name).toLowerCase().includes(card.matchFr.toLowerCase())
    );
    return match
      ? `/${locale}/booking/${match.id}?urgency=urgent_2h`
      : `/${locale}/services?urgency=urgent`;
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-[#0F3A7A] px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/${locale}`)}
          className="text-white/70 hover:text-white transition-colors"
          aria-label={isFr ? "Retour" : "Back"}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-white font-semibold text-sm">
          {isFr ? "Réservation urgente" : "Urgent booking"}
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Urgency badge + heading */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            {isFr ? "Service urgent · disponible maintenant" : "Urgent service · available now"}
          </span>
          <h1 className="text-2xl font-bold text-gray-900">
            {isFr ? "Quel est votre besoin urgent ?" : "What's your urgent need?"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isFr
              ? "Un prestataire intervient chez vous dans les 2 heures."
              : "A provider will be at your location within 2 hours."}
          </p>
        </div>

        {/* 2-column card grid — last card spans both columns */}
        <div className="grid grid-cols-2 gap-3">
          {URGENT_CARDS.map((card, i) => {
            const isLast = i === URGENT_CARDS.length - 1;
            return (
              <Link
                key={card.labelFr}
                href={getHref(card)}
                className={`
                  ${isLast ? "col-span-2" : ""}
                  group flex flex-col items-center justify-center gap-3
                  bg-white rounded-2xl border-2 border-gray-100 p-6 text-center
                  hover:border-red-400 hover:shadow-md hover:shadow-red-50
                  active:scale-[0.98] transition-all
                `}
              >
                <div className="w-14 h-14 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors flex items-center justify-center shrink-0">
                  <card.Icon className="h-7 w-7 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-snug">
                    {isFr ? card.labelFr : card.labelEn}
                  </p>
                  <p className="text-xs text-red-600 font-medium mt-0.5">
                    {isFr ? "Intervention dans 2h" : "Response within 2h"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Back to homepage */}
        <p className="text-center mt-8">
          <Link
            href={`/${locale}`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← {isFr ? "Retour à l'accueil" : "Back to home"}
          </Link>
        </p>

      </div>
    </div>
  );
}
