'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Wrench, Zap, Hammer, Baby, Scissors,
  type LucideIcon,
} from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { Skeleton } from '@/components/ui/skeleton'

interface ApiCategory {
  id: number
  name: string
  name_fr: string
  name_en: string
  description: string
}

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || 'https://shizu-verse.onrender.com'

// Featured 6 — price ranges are indicative and static
interface Featured {
  matchFr: string      // substring to match against category name_fr
  nameFr: string
  nameEn: string
  price: string        // FCFA range
  Icon: LucideIcon
}

const FEATURED: Featured[] = [
  { matchFr: 'ménage',      nameFr: 'Ménage',       nameEn: 'Cleaning',   price: '5 000–15 000 FCFA', Icon: Sparkles },
  { matchFr: 'plomberie',   nameFr: 'Plomberie',    nameEn: 'Plumbing',   price: '10 000–35 000 FCFA', Icon: Wrench },
  { matchFr: 'électricité', nameFr: 'Électricité',  nameEn: 'Electrical', price: '15 000–50 000 FCFA', Icon: Zap },
  { matchFr: 'bricolage',   nameFr: 'Bricolage',    nameEn: 'Handyman',   price: '8 000–25 000 FCFA',  Icon: Hammer },
  { matchFr: 'nounou',      nameFr: 'Nounou',       nameEn: 'Childcare',  price: '5 000–12 000 FCFA',  Icon: Baby },
  { matchFr: 'beauté',      nameFr: 'Beauté',       nameEn: 'Beauty',     price: '5 000–20 000 FCFA',  Icon: Scissors },
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

  // Match each Featured entry to an API category for the real ID (used in href)
  const cards = FEATURED.map((f) => {
    const match = categories.find((c) =>
      (c.name_fr || c.name).toLowerCase().includes(f.matchFr.toLowerCase())
    )
    return {
      id: match?.id ?? null,
      nameFr: f.nameFr,
      nameEn: f.nameEn,
      name: isFr ? f.nameFr : f.nameEn,
      price: f.price,
      Icon: f.Icon,
    }
  })

  return (
    <section className="bg-gray-50 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-10">
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-3/4 mt-3 rounded" />
                  <Skeleton className="h-3 w-1/2 mt-2 rounded" />
                </div>
              ))
            : cards.map((card) => (
                <Link
                  key={card.nameFr}
                  href={`/${locale}/services`}
                  className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md hover:border-[#0F3A7A]/20 transition-all cursor-pointer group"
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
