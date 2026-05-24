"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isFr = locale === "fr";

  const services = [
    { label: isFr ? "Ménage"                  : "Cleaning",             id: 1  },
    { label: isFr ? "Plomberie"               : "Plumbing",             id: 2  },
    { label: isFr ? "Électricité"             : "Electrical",           id: 3  },
    { label: isFr ? "Bricolage"               : "Handyman",             id: 4  },
    { label: isFr ? "Garde d'enfants"         : "Childcare",            id: 5  },
    { label: isFr ? "Beauté à domicile"       : "Beauty at Home",       id: 6  },
    { label: isFr ? "Jardinage"               : "Garden & Pool",        id: 7  },
    { label: isFr ? "Climatisation"           : "AC & Appliances",      id: 8  },
    { label: isFr ? "Aide aux seniors"        : "Senior Care",          id: 9  },
    { label: isFr ? "Peinture & Rénovation"   : "Painting & Renovation",id: 10 },
  ];

  const platform = [
    { label: isFr ? "Comment ça marche" : "How It Works", href: `/${locale}#how-it-works`        },
    { label: isFr ? "Tarifs"            : "Pricing",      href: `/${locale}#pricing`              },
    { label: isFr ? "Prestataires"      : "Providers",    href: `/${locale}/provider/register`    },
    { label: isFr ? "Avis clients"      : "Reviews",      href: `/${locale}#reviews`              },
  ];

  const company = [
    { label: isFr ? "À propos" : "About", href: `/${locale}/about`         },
    { label: "Contact",                    href: "mailto:contact@shizu.pro" },
  ];

  const headingClass = "text-xs font-semibold uppercase tracking-wider text-gray-400";
  const linkClass    = "text-sm text-gray-600 hover:text-[#0D2B6B] transition-colors";

  return (
    <footer className="border-t border-gray-200 bg-gray-50 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Top grid */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-12">

          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1 space-y-4">
            <Link href={`/${locale}`} className="inline-flex items-center">
              <img
                src="https://res.cloudinary.com/ddilgv5ir/image/upload/v1779646648/shizu_logo_horizontal_dark_khesrn.png"
                alt={t("appName")}
                style={{ height: "32px", width: "auto", objectFit: "contain" }}
              />
            </Link>
            <p className="text-sm leading-relaxed text-gray-500 max-w-[200px]">
              {isFr
                ? "Services à domicile de confiance à Abidjan."
                : "Trusted home services across Abidjan."}
            </p>
          </div>

          {/* Services column */}
          <div className="space-y-3">
            <h3 className={headingClass}>
              {isFr ? "Services" : "Services"}
            </h3>
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id}>
                  <Link href={`/${locale}/services/${s.id}`} className={linkClass}>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform column */}
          <div className="space-y-3">
            <h3 className={headingClass}>
              {isFr ? "Plateforme" : "Platform"}
            </h3>
            <ul className="space-y-2">
              {platform.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className={linkClass}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company column */}
          <div className="space-y-3">
            <h3 className={headingClass}>
              {isFr ? "Société" : "Company"}
            </h3>
            <ul className="space-y-2">
              {company.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className={linkClass}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright row */}
        <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © 2026 {t("appName")}.{" "}
            {isFr ? "Tous droits réservés." : "All rights reserved."}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Abidjan, Côte d&apos;Ivoire</span>
            <span>·</span>
            <span>CFA (XOF)</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
