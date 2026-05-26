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
    title: "Politique de Confidentialité",
    subtitle: "Version 1.0 — Mai 2026",
    sections: [
      {
        title: "1. Qui sommes-nous",
        body: [
          "Shizu est une marketplace de services à domicile opérée depuis Abidjan, Côte d'Ivoire. Nous mettons en relation des clients avec des prestataires vérifiés pour des services à domicile.",
          "Pour toute question relative à vos données personnelles, contactez-nous à contact@shizu.pro.",
        ],
      },
      {
        title: "2. Données Collectées",
        body: ["Clients :"],
        items: [
          "Nom et prénom",
          "Numéro de téléphone",
          "Commune de résidence",
          "Historique des réservations",
        ],
        outro: ["Prestataires :"],
        extraItems: [
          "Nom et prénom",
          "Numéro de téléphone",
          "Photo de profil",
          "Pièce d'identité",
          "Photos de travaux réalisés",
          "Coordonnées Mobile Money",
        ],
      },
      {
        title: "2b. Données Techniques",
        body: [
          "Nous collectons également des données techniques : journaux d'accès (logs), adresses IP et données de navigation. Ces données sont utilisées uniquement à des fins de sécurité et d'amélioration de la plateforme.",
        ],
      },
      {
        title: "3. Utilisation des Données",
        body: ["Vos données sont utilisées pour :"],
        items: [
          "La mise en relation entre clients et prestataires.",
          "La vérification de l'identité des prestataires.",
          "L'amélioration continue de la plateforme.",
          "Les communications relatives aux réservations (confirmations, rappels, mises à jour).",
        ],
      },
      {
        title: "4. Partage des Données",
        body: [
          "Shizu ne vend jamais vos données personnelles. Nous partageons certaines données avec nos partenaires techniques dans le seul but de faire fonctionner la plateforme :",
        ],
        items: [
          "Cloudinary — hébergement et traitement des photos.",
          "Anthropic — fonctionnalités d'intelligence artificielle.",
          "Hébergeurs et prestataires d'infrastructure (Render, Vercel).",
        ],
        outro: [
          "Ces partenaires sont contractuellement tenus de protéger vos données et de ne pas les utiliser à d'autres fins.",
        ],
      },
      {
        title: "5. Conservation des Données",
        body: [
          "Vos données sont conservées pendant toute la durée d'activité de votre compte, plus 2 ans après sa fermeture.",
          "Les pièces d'identité des prestataires dont la candidature a été refusée sont supprimées dans les 30 jours suivant le refus.",
        ],
      },
      {
        title: "6. Vos Droits",
        body: [
          "Vous disposez des droits suivants sur vos données personnelles :",
        ],
        items: [
          "Droit d'accès : obtenir une copie des données que nous détenons sur vous.",
          "Droit de rectification : corriger des données inexactes ou incomplètes.",
          "Droit à la suppression : demander l'effacement de vos données.",
        ],
        outro: [
          "Pour exercer ces droits, adressez votre demande par email à contact@shizu.pro. Nous nous engageons à répondre dans un délai de 30 jours.",
        ],
      },
      {
        title: "7. Sécurité",
        body: [
          "Nous mettons en œuvre les mesures suivantes pour protéger vos données :",
        ],
        items: [
          "Chiffrement HTTPS pour toutes les communications.",
          "Accès aux données limité aux membres autorisés de l'équipe Shizu.",
          "Mots de passe stockés sous forme hachée — jamais en clair.",
        ],
      },
      {
        title: "8. Contact",
        body: [
          "Pour toute question relative à cette politique de confidentialité ou à vos données personnelles, contactez-nous :",
        ],
        items: [
          "Email : contact@shizu.pro",
          "Site web : www.shizu.pro",
          "Adresse : Abidjan, Côte d'Ivoire",
        ],
      },
    ],
    contactLine: "contact@shizu.pro · www.shizu.pro · Abidjan, Côte d'Ivoire",
  },
  en: {
    heroTag: "Shizu · May 2026",
    title: "Privacy Policy",
    subtitle: "Version 1.0 — May 2026",
    sections: [
      {
        title: "1. Who We Are",
        body: [
          "Shizu is a home services marketplace operated from Abidjan, Côte d'Ivoire. We connect clients with verified providers for home services.",
          "For any questions regarding your personal data, contact us at contact@shizu.pro.",
        ],
      },
      {
        title: "2. Data Collected",
        body: ["Clients:"],
        items: [
          "Full name",
          "Phone number",
          "Commune of residence",
          "Booking history",
        ],
        outro: ["Providers:"],
        extraItems: [
          "Full name",
          "Phone number",
          "Profile photo",
          "Identity document",
          "Photos of completed work",
          "Mobile Money details",
        ],
      },
      {
        title: "2b. Technical Data",
        body: [
          "We also collect technical data: access logs, IP addresses, and browsing data. This data is used solely for security purposes and platform improvement.",
        ],
      },
      {
        title: "3. Use of Data",
        body: ["Your data is used for:"],
        items: [
          "Matching clients with providers.",
          "Verifying provider identities.",
          "Continuously improving the platform.",
          "Booking-related communications (confirmations, reminders, updates).",
        ],
      },
      {
        title: "4. Data Sharing",
        body: [
          "Shizu never sells your personal data. We share certain data with our technical partners solely to operate the platform:",
        ],
        items: [
          "Cloudinary — photo hosting and processing.",
          "Anthropic — artificial intelligence features.",
          "Infrastructure providers (Render, Vercel).",
        ],
        outro: [
          "These partners are contractually bound to protect your data and not use it for any other purpose.",
        ],
      },
      {
        title: "5. Data Retention",
        body: [
          "Your data is retained for the entire period your account is active, plus 2 years after closure.",
          "Identity documents of providers whose application was rejected are deleted within 30 days of rejection.",
        ],
      },
      {
        title: "6. Your Rights",
        body: ["You have the following rights regarding your personal data:"],
        items: [
          "Right of access: obtain a copy of the data we hold about you.",
          "Right of rectification: correct inaccurate or incomplete data.",
          "Right to erasure: request deletion of your data.",
        ],
        outro: [
          "To exercise these rights, send your request by email to contact@shizu.pro. We commit to responding within 30 days.",
        ],
      },
      {
        title: "7. Security",
        body: ["We implement the following measures to protect your data:"],
        items: [
          "HTTPS encryption for all communications.",
          "Data access restricted to authorized Shizu team members.",
          "Passwords stored in hashed form — never in plain text.",
        ],
      },
      {
        title: "8. Contact",
        body: [
          "For any questions regarding this privacy policy or your personal data, contact us:",
        ],
        items: [
          "Email: contact@shizu.pro",
          "Website: www.shizu.pro",
          "Address: Abidjan, Côte d'Ivoire",
        ],
      },
    ],
    contactLine: "contact@shizu.pro · www.shizu.pro · Abidjan, Côte d'Ivoire",
  },
};

export default function PrivacyPage() {
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
