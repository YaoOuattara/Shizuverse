"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

export default function Footer() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isFr = locale === "fr";

  const services = [
    { label: isFr ? "Ménage"              : "Cleaning",          id: 1  },
    { label: isFr ? "Plomberie"           : "Plumbing",          id: 2  },
    { label: isFr ? "Électricité"         : "Electrical",        id: 3  },
    { label: isFr ? "Bricolage"           : "Handyman",          id: 4  },
    { label: isFr ? "Garde d'enfants"     : "Childcare",         id: 5  },
    { label: isFr ? "Beauté à domicile"   : "Beauty at Home",    id: 6  },
    { label: isFr ? "Jardinage"           : "Garden & Pool",     id: 7  },
    { label: isFr ? "Climatisation"       : "AC & Appliances",   id: 8  },
    { label: isFr ? "Aide aux seniors"    : "Senior Care",       id: 9  },
    { label: isFr ? "Peinture & Rénovation" : "Painting & Renovation", id: 10 },
  ];

  const platform = [
    { label: isFr ? "Comment ça marche" : "How It Works", href: `/${locale}#how-it-works` },
    { label: isFr ? "Tarifs"            : "Pricing",      href: `/${locale}#pricing`      },
    { label: isFr ? "Prestataires"      : "Providers",    href: `/${locale}/provider/register` },
    { label: isFr ? "Avis clients"      : "Reviews",      href: `/${locale}#reviews`      },
  ];

  const company = [
    { label: isFr ? "À propos" : "About",   href: `/${locale}/about`          },
    { label: "Contact",                       href: "mailto:contact@shizu.pro"  },
  ];

  return (
    <footer className="bg-gray-950 text-gray-400 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Top grid */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-12">

          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1 space-y-4">
            <Link href={`/${locale}`} className="inline-flex items-center gap-2">
              <Image
                src="/logo-white.png"
                alt="Le Gardien"
                width={120}
                height={32}
                className="h-8 w-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              {isFr ? "Services" : "Services"}
            </h3>
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/${locale}/services/${s.id}`}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform column */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              {isFr ? "Plateforme" : "Platform"}
            </h3>
            <ul className="space-y-2">
              {platform.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company column */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              {isFr ? "Société" : "Company"}
            </h3>
            <ul className="space-y-2">
              {company.map((c) => (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">
            © 2026 {t("appName")}.{" "}
            {isFr ? "Tous droits réservés." : "All rights reserved."}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>Abidjan, Côte d&apos;Ivoire</span>
            <span>·</span>
            <span>CFA (XOF)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
