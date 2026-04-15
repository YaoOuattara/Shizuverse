'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Sparkles, Save } from 'lucide-react'

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? 'https://shizu-verse.onrender.com'

export default function ProviderProfilePage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'fr'
  const router = useRouter()
  const isFr = locale === 'fr'

  const [bio, setBio] = useState('')
  const [originalBio, setOriginalBio] = useState('')
  const [providerName, setProviderName] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [isImproving, setIsImproving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    try {
      const info = JSON.parse(localStorage.getItem('provider_info') || 'null')
      if (info) {
        setBio(info.bio ?? '')
        setOriginalBio(info.bio ?? '')
        setProviderName(info.name ?? info.full_name ?? '')
        setServices(Array.isArray(info.services) ? info.services : [])
      }
    } catch { /* ignore */ }
  }, [])

  const handleImproveBio = async () => {
    if (!bio.trim() || isImproving) return
    setIsImproving(true)
    try {
      const res = await fetch('/api/improve-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, services }),
      })
      const data = await res.json()
      if (data.improved_bio) {
        setBio(data.improved_bio)
      }
    } catch (err) {
      console.error('[improve-bio] error:', err)
    } finally {
      setIsImproving(false)
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveStatus('idle')
    try {
      const token = localStorage.getItem('provider_token')
      const res = await fetch(`${FLASK_API}/api/provider/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bio }),
      })
      if (res.ok) {
        try {
          const info = JSON.parse(localStorage.getItem('provider_info') || 'null')
          if (info) {
            localStorage.setItem('provider_info', JSON.stringify({ ...info, bio }))
          }
        } catch { /* ignore */ }
        setOriginalBio(bio)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

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
        {providerName && (
          <p className="font-medium text-gray-800">{providerName}</p>
        )}

        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-blue-800 text-sm font-medium">
            {isFr
              ? '✓ Inscription complète — En attente de vérification par Shizu'
              : '✓ Registration complete — Awaiting Shizu verification'}
          </p>
        </div>

        {/* Bio section */}
        <div className="space-y-3 pt-2">
          <label className="block text-sm font-semibold text-gray-700">
            {isFr ? 'Votre présentation' : 'Your bio'}
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder={
              isFr
                ? 'Décrivez votre expérience, vos compétences et ce qui vous distingue...'
                : 'Describe your experience, skills, and what sets you apart...'
            }
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleImproveBio}
              disabled={!bio.trim() || isImproving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isFr ? "Améliorer avec l'IA" : 'Improve with AI'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || bio === originalBio}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isFr ? 'Sauvegarder' : 'Save'}
            </button>
          </div>

          {saveStatus === 'success' && (
            <p className="text-sm text-green-600">
              {isFr ? '✓ Bio mise à jour.' : '✓ Bio updated.'}
            </p>
          )}
          {saveStatus === 'error' && (
            <p className="text-sm text-red-500">
              {isFr
                ? 'Erreur lors de la sauvegarde. Réessayez.'
                : 'Failed to save. Please try again.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
