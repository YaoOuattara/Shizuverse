'use client'

import Link from 'next/link'
import {
  Sparkles, Wrench, Zap, Hammer, Baby, Scissors, ChefHat, Leaf,
  type LucideIcon,
} from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

interface Service {
  icon: LucideIcon
  name: string
  desc: string
  slug: string
}

export default function ServicesGrid({ locale }: { locale: string }) {
  const SERVICES: Service[] = [
    { icon: Sparkles, name: locale === 'fr' ? 'Ménage & Nettoyage'       : 'Cleaning',           desc: locale === 'fr' ? 'Nettoyage régulier ou ponctuel'        : 'Regular or one-time cleaning',     slug: 'menage' },
    { icon: Wrench,   name: locale === 'fr' ? 'Plomberie'                : 'Plumbing',           desc: locale === 'fr' ? 'Réparations & installations'           : 'Repairs & installations',          slug: 'plomberie' },
    { icon: Zap,      name: locale === 'fr' ? 'Électricité'              : 'Electrical',         desc: locale === 'fr' ? 'Dépannage & câblage'                   : 'Troubleshooting & wiring',         slug: 'electricite' },
    { icon: Hammer,   name: locale === 'fr' ? 'Bricolage & Réparations'  : 'Handyman',           desc: locale === 'fr' ? 'Petits travaux, montage, réparations'  : 'Small jobs, assembly, repairs',    slug: 'bricolage' },
    { icon: Baby,     name: locale === 'fr' ? 'Nounou & Baby-sitting'    : 'Childcare',          desc: locale === 'fr' ? 'Garde ponctuelle ou régulière'         : 'Occasional or regular care',       slug: 'nounou' },
    { icon: Scissors, name: locale === 'fr' ? 'Beauté à domicile'        : 'Beauty at Home',     desc: locale === 'fr' ? 'Coiffure, manucure, soins'             : 'Hair, nails, beauty care',         slug: 'beaute' },
    { icon: ChefHat,  name: locale === 'fr' ? 'Traiteur & Cuisine'       : 'Catering & Cooking', desc: locale === 'fr' ? 'Événements, repas à domicile'          : 'Events, home-cooked meals',        slug: 'traiteur' },
    { icon: Leaf,     name: locale === 'fr' ? 'Jardinage & Piscine'      : 'Garden & Pool',      desc: locale === 'fr' ? 'Entretien de jardin et piscine'        : 'Garden and pool maintenance',      slug: 'jardinage' },
  ]

  return (
    <section className="bg-gray-50 py-16 px-6">
      <div className="max-w-5xl mx-auto text-center mb-10">
        <h2 className="text-2xl font-bold text-gray-900">
          {locale === 'fr' ? 'Nos Services' : 'Our Services'}
        </h2>
        <p className="text-gray-500 mt-2">
          {locale === 'fr'
            ? 'Des professionnels qualifiés pour chaque besoin'
            : 'Qualified professionals for every need'}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {SERVICES.map((s) => (
          <Link
            key={s.slug}
            href={`/${locale}/bookings?service=${s.slug}`}
            className="bg-white rounded-2xl border border-gray-100 p-6 text-center hover:shadow-md hover:border-[#0F3A7A]/20 transition-all cursor-pointer group"
            onClick={() => trackEvent('service_viewed', { service_slug: s.slug, service_name: s.name, locale })}
          >
            <s.icon className="h-8 w-8 text-[#0F3A7A] mx-auto group-hover:scale-110 transition-transform" />
            <p className="font-semibold text-gray-800 mt-3 group-hover:text-[#0F3A7A] transition-colors">
              {s.name}
            </p>
            <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
