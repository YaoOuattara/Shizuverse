'use client'

import { useParams, useRouter } from 'next/navigation'

export default function ProviderProfilePage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'fr'
  const router = useRouter()
  const isFr = locale === 'fr'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          ← {isFr ? 'Retour' : 'Back'}
        </button>
        <h1 className="text-2xl font-bold">
          {isFr ? 'Mon profil' : 'My Profile'}
        </h1>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <p className="text-gray-500 text-sm">
          {isFr
            ? 'Votre profil est en cours de configuration.'
            : 'Your profile is being set up.'}
        </p>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-blue-800 text-sm font-medium">
            {isFr
              ? '✓ Inscription complète — En attente de vérification par Shizu'
              : '✓ Registration complete — Awaiting Shizu verification'}
          </p>
        </div>
      </div>
    </div>
  )
}
