'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Wrench, Zap, Hammer, Baby, Scissors, ChefHat, Leaf, Heart, Wind, Star,
  type LucideIcon,
} from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

interface ApiCategory {
  id: number
  name: string
  name_fr: string
  name_en: string
  description: string
}

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || 'https://shizu-verse.onrender.com'

const ICON_MAP: Record<string, LucideIcon> = {
  'cleaning': Sparkles,
  'plumbing': Wrench,
  'electrical': Zap,
  'handyman': Hammer,
  'childcare': Baby,
  'nounou & baby-sitting': Baby,
  'beauty at home': Scissors,
  'catering & cooking': ChefHat,
  'garden & pool': Leaf,
  'elderly care / aide aux seniors': Heart,
  'climatisation & electromenager': Wind,
}

const FALLBACK_ICONS: LucideIcon[] = [
  Sparkles, Wrench, Zap, Hammer, Baby, Scissors, ChefHat, Leaf, Heart, Wind, Star,
]

function getIcon(name: string, index: number): LucideIcon {
  return ICON_MAP[name.toLowerCase()] ?? FALLBACK_ICONS[index % FALLBACK_ICONS.length]
}

function displayName(cat: ApiCategory, locale: string): string {
  return locale === 'fr' ? (cat.name_fr || cat.name) : (cat.name_en || cat.name)
}

export default function ServicesGrid({ locale }: { locale: string }) {
  const [categories, setCategories] = useState<ApiCategory[]>([])

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [])

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
        {categories.map((cat, i) => {
          const Icon = getIcon(cat.name, i)
          const name = displayName(cat, locale)
          return (
            <Link
              key={cat.id}
              href={`/${locale}/services`}
              className="bg-white rounded-2xl border border-gray-100 p-6 text-center hover:shadow-md hover:border-[#0F3A7A]/20 transition-all cursor-pointer group"
              onClick={() => trackEvent('service_viewed', { service_name: name, locale })}
            >
              <Icon className="h-8 w-8 text-[#0F3A7A] mx-auto group-hover:scale-110 transition-transform" />
              <p className="font-semibold text-gray-800 mt-3 group-hover:text-[#0F3A7A] transition-colors">
                {name}
              </p>
              {cat.description && (
                <p className="text-xs text-gray-400 mt-1">{cat.description}</p>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
