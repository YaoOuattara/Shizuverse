"use client";

import { useLocale } from "next-intl";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Section = {
  title: string;
  body?: string[];
  items?: string[];
  outro?: string[];
  extraItems?: string[];
  warning?: string;
};

type Content = {
  heroTag: string;
  title: string;
  subtitle: string;
  sections: Section[];
  contactLine: string;
};

const CONTENT: Record<string, Content> = {
  fr: {
    heroTag: "Shizu · Mai 2026",
    title: "Conditions Générales d'Utilisation — Clients",
    subtitle: "Version 1.0 — Mai 2026",
    sections: [
      {
        title: "1. Objet",
        body: [
          "Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'utilisation de la plateforme Shizu par les clients. En effectuant une réservation, le client accepte sans réserve les présentes CGU.",
        ],
      },
      {
        title: "2. Services Disponibles",
        body: [
          "Shizu propose des services à domicile dans les catégories suivantes :",
        ],
        items: [
          "Ménage",
          "Plomberie",
          "Électricité",
          "Bricolage",
          "Garde d'enfants",
          "Beauté à domicile",
          "Jardinage & Piscine",
          "Climatisation & Électroménager",
          "Aide aux seniors",
          "Peinture & Rénovation",
        ],
        outro: [
          "Zones desservies : Cocody, Bingerville, Marcory, Zone 4, Biétry et communes avoisinantes d'Abidjan.",
        ],
      },
      {
        title: "3. Réservation",
        body: [
          "La réservation est effectuée en ligne via la plateforme Shizu. Le client reçoit une confirmation par SMS ou message WhatsApp dans les 2 heures suivant la réservation. Shizu se réserve le droit de refuser ou d'annuler une réservation si aucun prestataire disponible ne correspond à la demande.",
        ],
      },
      {
        title: "4. Paiement",
        items: [
          "Tier 1 (inférieur à 15 000 FCFA) : paiement intégral le jour de la prestation, à la fin du service.",
          "Tier 2 (entre 15 000 et 50 000 FCFA) : acompte de 30 % à la confirmation de la réservation ; solde payé à la fin du service.",
          "Tier 3 (supérieur à 50 000 FCFA) : paiement complet avant le début de la prestation.",
        ],
        warning:
          "Ne jamais payer sur un autre compte que celui communiqué officiellement par Shizu. En cas de doute, contactez-nous avant tout paiement à contact@shizu.pro.",
      },
      {
        title: "5. Politique d'Annulation",
        items: [
          "Annulation plus de 4 heures avant la prestation : remboursement intégral de l'acompte.",
          "Annulation moins de 4 heures avant la prestation : 50 % de l'acompte est retenu.",
          "Non-présentation du client : l'acompte total est retenu.",
        ],
      },
      {
        title: "6. Garanties Shizu",
        body: ["Ce que Shizu garantit :"],
        items: [
          "Tous les prestataires ont été vérifiés manuellement (identité et expérience).",
          "Un support client est disponible 7 jours sur 7.",
          "En cas de problème avéré avec un prestataire, Shizu intervient pour trouver une solution.",
        ],
        outro: ["Ce que Shizu ne garantit pas :"],
        extraItems: [
          "La disponibilité immédiate d'un prestataire pour toute demande urgente.",
          "Des résultats spécifiques liés à des contraintes techniques ou structurelles du logement du client.",
          "La responsabilité pour des dommages causés par un cas de force majeure ou une mauvaise utilisation déclarée par le client.",
        ],
      },
      {
        title: "7. Litiges et Réclamations",
        body: [
          "Toute réclamation doit être soumise à Shizu dans les 24 heures suivant la prestation à contact@shizu.pro. Shizu s'engage à proposer une résolution dans les 72 heures suivant la réception de la réclamation.",
          "Trois types de résolution sont possibles :",
        ],
        items: [
          "Remboursement partiel ou total selon les circonstances.",
          "Reprogrammation de la prestation avec un autre prestataire.",
          "Médiation entre le client et le prestataire.",
        ],
      },
      {
        title: "8. Comportement Attendu",
        items: [
          "Traiter le prestataire avec respect et courtoisie.",
          "Être présent ou représenté à l'heure convenue.",
          "Fournir un accès sûr et adéquat au lieu de la prestation.",
          "Ne pas demander au prestataire d'effectuer des travaux illégaux ou dangereux.",
        ],
      },
      {
        title: "9. Protection des Données",
        body: [
          "Les données personnelles du client sont traitées conformément à la Politique de Confidentialité de Shizu disponible sur www.shizu.pro/privacy. Elles sont utilisées pour la gestion des réservations et l'amélioration du service.",
        ],
      },
      {
        title: "10. Contact",
        body: [
          "Pour toute question relative à ces CGU ou à une réservation, contactez-nous à contact@shizu.pro.",
        ],
      },
    ],
    contactLine: "contact@shizu.pro · www.shizu.pro · Abidjan, Côte d'Ivoire",
  },
  en: {
    heroTag: "Shizu · May 2026",
    title: "Terms of Use — Clients",
    subtitle: "Version 1.0 — May 2026",
    sections: [
      {
        title: "1. Purpose",
        body: [
          "These Terms of Use (\"Terms\") govern the use of the Shizu platform by clients. By making a booking, the client unconditionally accepts these Terms.",
        ],
      },
      {
        title: "2. Available Services",
        body: ["Shizu offers home services in the following categories:"],
        items: [
          "Cleaning",
          "Plumbing",
          "Electrical",
          "Handyman",
          "Childcare",
          "Beauty at Home",
          "Garden & Pool",
          "AC & Appliances",
          "Senior Care",
          "Painting & Renovation",
        ],
        outro: [
          "Service zones: Cocody, Bingerville, Marcory, Zone 4, Biétry, and surrounding communes of Abidjan.",
        ],
      },
      {
        title: "3. Booking",
        body: [
          "Bookings are made online through the Shizu platform. The client receives confirmation by SMS or WhatsApp message within 2 hours of booking. Shizu reserves the right to decline or cancel a booking if no available provider matches the request.",
        ],
      },
      {
        title: "4. Payment",
        items: [
          "Tier 1 (under 15,000 FCFA): full payment on the day of the service, at completion.",
          "Tier 2 (between 15,000 and 50,000 FCFA): 30% deposit upon booking confirmation; balance paid at service completion.",
          "Tier 3 (over 50,000 FCFA): full payment before the service begins.",
        ],
        warning:
          "Never pay to any account other than the one officially provided by Shizu. If in doubt, contact us before any payment at contact@shizu.pro.",
      },
      {
        title: "5. Cancellation Policy",
        items: [
          "Cancellation more than 4 hours before the service: full refund of the deposit.",
          "Cancellation less than 4 hours before the service: 50% of the deposit is retained.",
          "Client no-show: the full deposit is retained.",
        ],
      },
      {
        title: "6. Shizu Guarantees",
        body: ["What Shizu guarantees:"],
        items: [
          "All providers have been manually verified (identity and experience).",
          "Customer support is available 7 days a week.",
          "In the event of a proven issue with a provider, Shizu will intervene to find a resolution.",
        ],
        outro: ["What Shizu does not guarantee:"],
        extraItems: [
          "Immediate availability of a provider for urgent requests.",
          "Specific results affected by technical or structural constraints in the client's home.",
          "Liability for damage caused by force majeure or misuse declared by the client.",
        ],
      },
      {
        title: "7. Disputes and Complaints",
        body: [
          "Any complaint must be submitted to Shizu within 24 hours of the service at contact@shizu.pro. Shizu commits to proposing a resolution within 72 hours of receiving the complaint.",
          "Three types of resolution are available:",
        ],
        items: [
          "Partial or full refund depending on circumstances.",
          "Rescheduling of the service with a different provider.",
          "Mediation between the client and the provider.",
        ],
      },
      {
        title: "8. Expected Behavior",
        items: [
          "Treat the provider with respect and courtesy.",
          "Be present or represented at the agreed time.",
          "Provide safe and adequate access to the service location.",
          "Do not ask the provider to perform illegal or dangerous work.",
        ],
      },
      {
        title: "9. Data Protection",
        body: [
          "The client's personal data is processed in accordance with Shizu's Privacy Policy available at www.shizu.pro/privacy. It is used for booking management and service improvement.",
        ],
      },
      {
        title: "10. Contact",
        body: [
          "For any questions regarding these Terms or a booking, contact us at contact@shizu.pro.",
        ],
      },
    ],
    contactLine: "contact@shizu.pro · www.shizu.pro · Abidjan, Côte d'Ivoire",
  },
};

export default function ClientTermsPage() {
  const locale = useLocale() as keyof typeof CONTENT;
  const c = CONTENT[locale] ?? CONTENT.fr;

  return (
    <>
      <Navbar />

      <section className="bg-[#0D2B6B] py-16 px-6 text-center">
        <p className="text-sm font-medium text-white/50 uppercase tracking-widest mb-3">
          {c.heroTag}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          {c.title}
        </h1>
        <p className="text-base text-white/60">{c.subtitle}</p>
      </section>

      <main className="bg-white py-16 px-6">
        <div className="max-w-2xl mx-auto space-y-10">
          {c.sections.map((s) => (
            <section key={s.title} className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900">{s.title}</h2>
              {s.body?.map((p, i) => (
                <p key={i} className="text-gray-700 leading-relaxed">{p}</p>
              ))}
              {s.items && (
                <ul className="list-disc pl-5 space-y-2">
                  {s.items.map((item, i) => (
                    <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                  ))}
                </ul>
              )}
              {s.outro?.map((p, i) => (
                <p key={i} className="text-gray-700 leading-relaxed">{p}</p>
              ))}
              {s.extraItems && (
                <ul className="list-disc pl-5 space-y-2">
                  {s.extraItems.map((item, i) => (
                    <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                  ))}
                </ul>
              )}
              {s.warning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 leading-relaxed">{s.warning}</p>
                </div>
              )}
            </section>
          ))}

          <div className="border-t border-gray-200 pt-8 text-center">
            <p className="text-sm text-gray-400">{c.contactLine}</p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
