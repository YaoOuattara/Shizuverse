'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Wrench, Zap, Hammer, Baby, Scissors,
  type LucideIcon,
} from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice, type CategoryPricing } from '@/lib/formatPrice'

interface ApiCategory extends CategoryPricing {
  id: number
  name: string
  name_fr: string
  name_en: string
  description: string
}

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || 'https://shizu-verse.onrender.com'

// Featured 6 — PRESENTATION ONLY (icon + which category to surface).
// No prices here: the displayed price is read from the API (single source
// of truth = DB). `match` lists case-insensitive name candidates (EN + FR).
interface FeaturedCard {
  match: string[]
  Icon: LucideIcon
}

const FEATURED_CARDS: FeaturedCard[] = [
  { match: ['cleaning', 'ménage', 'nettoyage'], Icon: Sparkles },
  { match: ['plumbing', 'plomberie'],           Icon: Wrench   },
  { match: ['electrical', 'électricité'],       Icon: Zap      },
  { match: ['handyman', 'bricolage'],           Icon: Hammer   },
  { match: ['childcare', "garde d'enfants", 'nounou'], Icon: Baby },
  { match: ['beauty', 'beauté'],                Icon: Scissors },
]

export default function ServicesGrid({ locale }: { locale: string }) {
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const isFr = locale === 'fr'

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Match each featured card to an API category, then read name + price
  // from the API response. Cards with no matching category are dropped.
  const cards = FEATURED_CARDS.map((f) => {
    const match = categories.find((c) => {
      const names = [c.name, c.name_fr, c.name_en].filter(Boolean).map((n) => n.toLowerCase())
      return f.match.some((k) => names.some((n) => n.includes(k) || k.includes(n)))
    })
    if (!match) return null
    return {
      id: match.id,
      name: isFr ? (match.name_fr || match.name) : (match.name_en || match.name),
      price: formatPrice(match, isFr),
      Icon: f.Icon,
    }
  }).filter((c): c is NonNullable<typeof c> => c !== null)

  return (
    <section className="bg-gray-50 py-10 md:py-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6 md:mb-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isFr ? 'Services populaires' : 'Popular services'}
            </h2>
            <p className="text-gray-500 mt-1 text-sm">
              {isFr
                ? 'Des professionnels qualifiés pour chaque besoin'
                : 'Qualified professionals for every need'}
            </p>
          </div>
          <Link
            href={`/${locale}/services`}
            className="text-sm font-medium text-[#0F3A7A] hover:text-[#0d3068] transition-colors shrink-0"
          >
            {isFr ? 'Voir tout →' : 'See all →'}
          </Link>
        </div>

        {/* 6-card grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-3/4 mt-3 rounded" />
                  <Skeleton className="h-3 w-1/2 mt-2 rounded" />
                </div>
              ))
            : cards.map((card) => (
                <Link
                  key={card.id}
                  href={`/${locale}/services`}
                  className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 hover:shadow-md hover:border-[#0F3A7A]/20 transition-all cursor-pointer group"
                  onClick={() => trackEvent('service_viewed', { service_name: card.name, locale })}
                >
                  <card.Icon className="h-8 w-8 text-[#0F3A7A] group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-gray-800 mt-3 group-hover:text-[#0F3A7A] transition-colors">
                    {card.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{card.price}</p>
                </Link>
              ))}
        </div>
      </div>
    </section>
  )
}
