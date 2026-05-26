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
    title: "Conditions Générales d'Utilisation — Prestataires",
    subtitle: "Version 1.0 — Mai 2026",
    sections: [
      {
        title: "1. Objet et Définitions",
        body: [
          "Les présentes Conditions Générales d'Utilisation (« CGU ») définissent les règles applicables aux prestataires de services utilisant la plateforme Shizu. En s'inscrivant, le prestataire accepte sans réserve ces CGU.",
          "« Shizu » désigne la plateforme de mise en relation opérée depuis Abidjan, Côte d'Ivoire. « Prestataire » désigne toute personne proposant ses services via la plateforme. « Client » désigne toute personne réservant un service. « Mission » désigne une prestation réservée et confirmée.",
        ],
      },
      {
        title: "2. Inscription et Vérification",
        body: [
          "L'inscription est gratuite. Tout prestataire doit soumettre une pièce d'identité valide et au moins une photo de ses travaux. Shizu procède à une vérification manuelle avant toute activation du compte. Shizu se réserve le droit de refuser ou de désactiver tout compte sans justification.",
        ],
      },
      {
        title: "3. Commission et Rémunération",
        body: [
          "Shizu prélève une commission de 15 % sur chaque mission complétée. Le prestataire perçoit 85 % du montant de la mission. Le paiement est effectué via Mobile Money dans un délai de 48 heures ouvrées après confirmation par le client. Aucun virement n'est effectué pour les missions contestées ou annulées.",
        ],
      },
      {
        title: "4. Obligations du Prestataire",
        items: [
          "Ponctualité : arriver à l'heure convenue ou prévenir le client au moins 30 minutes avant en cas de retard.",
          "Qualité : garantir un travail conforme à la description du service et aux standards professionnels.",
          "Respect : adopter un comportement respectueux envers les clients, leur famille et leur domicile.",
          "Communication : répondre aux messages de Shizu et des clients dans un délai raisonnable.",
          "Honnêteté : ne pas surestimer ses compétences ni le temps nécessaire pour réaliser une mission.",
          "Exclusivité de facturation : toute facturation passe exclusivement par la plateforme. Aucun paiement direct hors plateforme n'est autorisé.",
        ],
      },
      {
        title: "5. Interdictions",
        items: [
          "Solliciter ou accepter des paiements directement auprès des clients en dehors de la plateforme.",
          "Partager les coordonnées personnelles des clients à des tiers.",
          "Réaliser des travaux non sécurisés ou dangereux.",
          "Effectuer des travaux supplémentaires non convenus sans accord préalable du client.",
          "Adopter un comportement agressif, harcelant ou discriminatoire envers un client.",
          "Créer plusieurs comptes ou utiliser un compte appartenant à un tiers.",
          "Fournir de fausses informations lors de l'inscription ou d'une mission.",
        ],
      },
      {
        title: "6. Sanctions",
        items: [
          "Faute mineure (retard non signalé, communication tardive) : avertissement écrit.",
          "Faute grave (paiement hors plateforme, comportement irrespectueux, mauvais travail répété) : suspension temporaire de 7 à 30 jours.",
          "Faute très grave (fraude, violence, harcèlement, vol) : désactivation permanente sans indemnité.",
        ],
      },
      {
        title: "7. Politique d'Annulation",
        items: [
          "Annulation par le prestataire plus de 4h avant la mission : aucune sanction au premier incident ; avertissement formel dès le deuxième dans le même mois.",
          "Annulation par le prestataire moins de 4h avant : avertissement automatique ; deux annulations tardives dans le même mois entraînent une suspension.",
          "Annulation par le client : le prestataire est indemnisé selon la politique d'annulation décrite dans les CGU Clients.",
        ],
      },
      {
        title: "8. Avis et Réputation",
        body: [
          "Les clients peuvent laisser un avis après chaque mission. Le prestataire peut signaler un avis abusif à Shizu mais ne peut pas en demander la suppression de bonne foi. Un prestataire dont la note descend en dessous de 3/5 après au moins 10 avis fait l'objet d'une revue de compte.",
        ],
      },
      {
        title: "9. Résiliation",
        body: [
          "Le prestataire peut résilier son compte à tout moment en contactant Shizu à contact@shizu.pro. Les missions en cours doivent être honorées avant la clôture. Shizu peut résilier un compte à tout moment en cas de violation des présentes CGU.",
        ],
      },
      {
        title: "10. Responsabilité",
        body: [
          "Shizu est une plateforme de mise en relation et n'est pas partie au contrat de prestation entre le prestataire et le client. Shizu ne garantit pas un volume minimum de missions. Le prestataire est seul responsable de la qualité de ses travaux et de sa conformité aux lois ivoiriennes applicables.",
        ],
      },
      {
        title: "11. Protection des Données",
        body: [
          "Les données personnelles du prestataire sont traitées conformément à la Politique de Confidentialité de Shizu disponible sur www.shizu.pro/privacy. Elles sont utilisées exclusivement pour la mise en relation avec des clients, la vérification d'identité et l'amélioration de la plateforme.",
        ],
      },
      {
        title: "12. Modification des Conditions",
        body: [
          "Shizu se réserve le droit de modifier ces CGU à tout moment. Les prestataires seront informés par email ou notification dans l'application. La poursuite de l'utilisation de la plateforme après notification vaut acceptation des nouvelles conditions.",
        ],
      },
    ],
    contactLine: "contact@shizu.pro · www.shizu.pro · Abidjan, Côte d'Ivoire",
  },
  en: {
    heroTag: "Shizu · May 2026",
    title: "Terms of Use — Providers",
    subtitle: "Version 1.0 — May 2026",
    sections: [
      {
        title: "1. Purpose and Definitions",
        body: [
          "These Terms of Use (\"Terms\") define the rules applicable to service providers using the Shizu platform. By registering, the provider unconditionally accepts these Terms.",
          "\"Shizu\" refers to the connection platform operated from Abidjan, Côte d'Ivoire. \"Provider\" means any individual offering services through the platform. \"Client\" means any person booking a service. \"Assignment\" means a booked and confirmed service.",
        ],
      },
      {
        title: "2. Registration and Verification",
        body: [
          "Registration is free. All providers must submit a valid identity document and at least one photo of their work. Shizu performs a manual verification before activating any account. Shizu reserves the right to refuse or deactivate any account without explanation.",
        ],
      },
      {
        title: "3. Commission and Payment",
        body: [
          "Shizu takes a 15% commission on each completed assignment. The provider receives 85% of the assignment amount. Payment is made via Mobile Money within 48 business hours after the client confirms the assignment. No payment is made for disputed or cancelled assignments.",
        ],
      },
      {
        title: "4. Provider Obligations",
        items: [
          "Punctuality: arrive at the agreed time or notify the client at least 30 minutes before any delay.",
          "Quality: guarantee work consistent with the service description and professional standards.",
          "Respect: maintain respectful behavior toward clients, their families, and their homes.",
          "Communication: respond to messages from Shizu and clients within a reasonable timeframe.",
          "Honesty: do not overstate your skills or the time required to complete an assignment.",
          "Billing exclusivity: all billing goes exclusively through the platform. Direct payments outside the platform are not permitted.",
        ],
      },
      {
        title: "5. Prohibited Actions",
        items: [
          "Soliciting or accepting payments directly from clients outside the platform.",
          "Sharing clients' personal contact details with third parties.",
          "Performing unsafe or dangerous work.",
          "Carrying out additional unplanned work without the client's prior agreement.",
          "Engaging in aggressive, harassing, or discriminatory behavior toward a client.",
          "Creating multiple accounts or using an account belonging to another person.",
          "Providing false information during registration or on any assignment.",
        ],
      },
      {
        title: "6. Sanctions",
        items: [
          "Minor violation (unannounced delay, late communication): written warning.",
          "Serious violation (off-platform payment, disrespectful behavior, repeated poor work): temporary suspension of 7 to 30 days.",
          "Severe violation (fraud, violence, harassment, theft): permanent deactivation without compensation.",
        ],
      },
      {
        title: "7. Cancellation Policy",
        items: [
          "Provider cancellation more than 4 hours before: no penalty for the first incident; formal warning from the second in the same month.",
          "Provider cancellation less than 4 hours before: automatic warning; two late cancellations in the same month result in suspension.",
          "Client cancellation: the provider is compensated according to the policy described in the Client Terms.",
        ],
      },
      {
        title: "8. Reviews and Reputation",
        body: [
          "Clients may leave a review after each assignment. The provider may report an abusive review to Shizu but cannot request removal of a good-faith review. A provider whose rating falls below 3/5 after at least 10 reviews will have their account reviewed.",
        ],
      },
      {
        title: "9. Termination",
        body: [
          "The provider may close their account at any time by contacting Shizu at contact@shizu.pro. Ongoing assignments must be completed before the account is closed. Shizu may close an account at any time for violation of these Terms.",
        ],
      },
      {
        title: "10. Liability",
        body: [
          "Shizu is a connection platform and is not party to the service contract between the provider and the client. Shizu does not guarantee a minimum volume of assignments. The provider is solely responsible for the quality of their work and compliance with applicable Ivorian law.",
        ],
      },
      {
        title: "11. Data Protection",
        body: [
          "The provider's personal data is processed in accordance with Shizu's Privacy Policy, available at www.shizu.pro/privacy. It is used exclusively for client matching, identity verification, and platform improvement.",
        ],
      },
      {
        title: "12. Amendments",
        body: [
          "Shizu reserves the right to modify these Terms at any time. Providers will be notified by email or in-app notification. Continued use of the platform after notification constitutes acceptance of the new terms.",
        ],
      },
    ],
    contactLine: "contact@shizu.pro · www.shizu.pro · Abidjan, Côte d'Ivoire",
  },
};

export default function ProviderTermsPage() {
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
