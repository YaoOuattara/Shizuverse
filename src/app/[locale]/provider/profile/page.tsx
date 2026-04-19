'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2, Sparkles, Save, CheckCircle2, XCircle,
  ShieldCheck, ShieldAlert, ShieldX, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? 'https://shizu-verse.onrender.com'

type VerificationStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended'

interface ProfileState {
  bio: string
  profile_photo_url: string
  id_document_url: string
  experience_text: string
  experience_photo_url: string
  mobile_money_number: string
  mobile_money_name: string
  mobile_money_operator: string
  verification_status: VerificationStatus
  rejection_reason: string
}

const EMPTY: ProfileState = {
  bio: '',
  profile_photo_url: '',
  id_document_url: '',
  experience_text: '',
  experience_photo_url: '',
  mobile_money_number: '',
  mobile_money_name: '',
  mobile_money_operator: '',
  verification_status: 'draft',
  rejection_reason: '',
}

const inputCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0'

// ── sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 mb-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  )
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
      }
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  )
}

interface StatusCardProps {
  status: VerificationStatus
  rejectionReason: string
  isFr: boolean
  onResubmit: () => void
}

function StatusCard({ status, rejectionReason, isFr, onResubmit }: StatusCardProps) {
  if (status === 'approved') {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {isFr ? 'Profil approuvé ✓' : 'Profile approved ✓'}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
            {isFr
              ? 'Votre profil est visible par les clients sur la plateforme.'
              : 'Your profile is visible to clients on the platform.'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'submitted') {
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {isFr ? 'En cours de vérification' : 'Under review'}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            {isFr
              ? "Notre équipe examine votre profil. Vous serez notifié par SMS dès que c'est traité."
              : 'Our team is reviewing your profile. You will be notified by SMS once processed.'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'suspended') {
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {isFr ? 'Compte suspendu' : 'Account suspended'}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            {isFr
              ? 'Votre compte a été suspendu. Contactez le support Shizu pour plus d\'informations.'
              : 'Your account has been suspended. Contact Shizu support for more information.'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldX className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {isFr ? 'Profil refusé' : 'Profile rejected'}
            </p>
            {rejectionReason && (
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                {isFr ? 'Raison : ' : 'Reason: '}{rejectionReason}
              </p>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" onClick={onResubmit}>
          {isFr ? 'Corriger et resoumettre' : 'Fix and resubmit'}
        </Button>
      </div>
    )
  }

  return null
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProviderProfilePage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'fr'
  const router = useRouter()
  const isFr = locale === 'fr'
  const { toast } = useToast()

  const [providerName, setProviderName] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [profile, setProfile] = useState<ProfileState>(EMPTY)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  // Allows re-showing the form from a status card (e.g. after rejection)
  const [forceForm, setForceForm] = useState(false)

  useEffect(() => {
    try {
      const info = JSON.parse(localStorage.getItem('provider_info') || 'null')
      if (!info) return
      setProviderName(info.name ?? info.full_name ?? info.company_name ?? '')
      setServices(Array.isArray(info.services) ? info.services : [])
      setProfile({
        bio:                  info.bio ?? '',
        profile_photo_url:    info.profile_photo_url ?? '',
        id_document_url:      info.id_document_url ?? '',
        experience_text:      info.experience_text ?? '',
        experience_photo_url: info.experience_photo_url ?? '',
        mobile_money_number:  info.mobile_money_number ?? '',
        mobile_money_name:    info.mobile_money_name ?? '',
        mobile_money_operator: info.mobile_money_operator ?? '',
        verification_status:  info.verification_status ?? 'draft',
        rejection_reason:     info.rejection_reason ?? '',
      })
    } catch { /* ignore */ }
  }, [])

  const set = (field: keyof ProfileState, value: string) =>
    setProfile(prev => ({ ...prev, [field]: value }))

  const patchLocalStorage = (updates: Partial<ProfileState>) => {
    try {
      const info = JSON.parse(localStorage.getItem('provider_info') || 'null') ?? {}
      localStorage.setItem('provider_info', JSON.stringify({ ...info, ...updates }))
    } catch { /* ignore */ }
  }

  // Required to enable the Submit button
  const requiredFilled =
    profile.bio.trim() !== '' &&
    profile.id_document_url.trim() !== ''

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const token = localStorage.getItem('provider_token')
      const body = {
        bio:                   profile.bio,
        experience_text:       profile.experience_text,
        mobile_money_number:   profile.mobile_money_number,
        mobile_money_name:     profile.mobile_money_name,
        mobile_money_operator: profile.mobile_money_operator,
      }
      const res = await fetch(`${FLASK_API}/api/provider/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        patchLocalStorage(body)
        toast({
          title: isFr ? 'Sauvegardé' : 'Saved',
          description: isFr ? 'Modifications enregistrées.' : 'Changes saved.',
        })
      } else {
        toast({ title: isFr ? 'Erreur' : 'Error', description: isFr ? 'Échec de la sauvegarde.' : 'Save failed.', variant: 'destructive' })
      }
    } catch {
      toast({ title: isFr ? 'Erreur réseau' : 'Network error', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!requiredFilled || isSubmitting) return
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('provider_token')
      const body = {
        bio:                   profile.bio,
        profile_photo_url:     profile.profile_photo_url,
        id_document_url:       profile.id_document_url,
        experience_text:       profile.experience_text,
        experience_photo_url:  profile.experience_photo_url,
        mobile_money_number:   profile.mobile_money_number,
        mobile_money_name:     profile.mobile_money_name,
        mobile_money_operator: profile.mobile_money_operator,
      }
      const res = await fetch(`${FLASK_API}/api/provider/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        const newStatus: VerificationStatus = data.provider?.verification_status ?? 'submitted'
        setProfile(prev => ({ ...prev, ...body, verification_status: newStatus }))
        patchLocalStorage({ ...body, verification_status: newStatus })
        setForceForm(false)
        toast({
          title: isFr ? 'Profil soumis !' : 'Profile submitted!',
          description: isFr
            ? 'Notre équipe va examiner votre profil sous 24–48 h.'
            : 'Our team will review your profile within 24–48 h.',
        })
      } else {
        toast({ title: isFr ? 'Erreur' : 'Error', description: isFr ? 'Échec de la soumission.' : 'Submission failed.', variant: 'destructive' })
      }
    } catch {
      toast({ title: isFr ? 'Erreur réseau' : 'Network error', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImproveBio = async () => {
    if (!profile.bio.trim() || isImproving) return
    setIsImproving(true)
    try {
      const res = await fetch('/api/improve-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: profile.bio, services }),
      })
      const data = await res.json()
      if (data.improved_bio) set('bio', data.improved_bio)
    } catch (err) {
      console.error('[improve-bio]', err)
    } finally {
      setIsImproving(false)
    }
  }

  const status = profile.verification_status
  const showStatusCard =
    !forceForm &&
    (status === 'submitted' || status === 'approved' || status === 'rejected' || status === 'suspended')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {isFr ? 'Retour' : 'Back'}
        </button>
        <h1 className="text-2xl font-bold">{isFr ? 'Mon profil' : 'My Profile'}</h1>
      </div>

      {providerName && (
        <p className="font-semibold text-foreground mb-4">{providerName}</p>
      )}

      {/* Verification status card */}
      <StatusCard
        status={status}
        rejectionReason={profile.rejection_reason}
        isFr={isFr}
        onResubmit={() => setForceForm(true)}
      />

      {/* ── Bio ─────────────────────────────────────────────────────────────── */}
      <Section title={isFr ? 'Présentation *' : 'Bio *'}>
        <textarea
          value={profile.bio}
          onChange={e => set('bio', e.target.value)}
          rows={4}
          placeholder={
            isFr
              ? 'Décrivez votre expérience, vos compétences et ce qui vous distingue...'
              : 'Describe your experience, skills, and what sets you apart...'
          }
          className={`${inputCls} resize-none`}
        />
        <button
          type="button"
          onClick={handleImproveBio}
          disabled={!profile.bio.trim() || isImproving}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isImproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {isFr ? "Améliorer avec l'IA" : 'Improve with AI'}
        </button>
      </Section>

      {/* ── Profile photo ────────────────────────────────────────────────────── */}
      <Section title={isFr ? 'Photo de profil' : 'Profile photo'}>
        <p className="text-xs text-muted-foreground">
          {isFr
            ? 'Collez le lien (URL) d\'une photo de vous. Ex : photo WhatsApp partagée en lien, Google Drive, etc.'
            : 'Paste a link (URL) to a photo of yourself. E.g. a shared WhatsApp photo, Google Drive, etc.'}
        </p>
        <input
          type="url"
          value={profile.profile_photo_url}
          onChange={e => set('profile_photo_url', e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
        {profile.profile_photo_url && (
          <img
            src={profile.profile_photo_url}
            alt={isFr ? 'Aperçu' : 'Preview'}
            className="mt-2 h-16 w-16 rounded-full object-cover border border-border"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
      </Section>

      {/* ── ID document ─────────────────────────────────────────────────────── */}
      <Section title={isFr ? "Pièce d'identité *" : 'ID Document *'}>
        <p className="text-xs text-muted-foreground">
          {isFr
            ? "Photo de votre CNI ou passeport (recto). Partagez un lien vers la photo."
            : 'Photo of your national ID or passport (front). Share a link to the photo.'}
        </p>
        <input
          type="url"
          value={profile.id_document_url}
          onChange={e => set('id_document_url', e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </Section>

      {/* ── Experience ──────────────────────────────────────────────────────── */}
      <Section title={isFr ? 'Expérience professionnelle' : 'Professional experience'}>
        <textarea
          value={profile.experience_text}
          onChange={e => set('experience_text', e.target.value)}
          rows={3}
          placeholder={
            isFr
              ? 'Ex : 5 ans de plomberie, formations suivies, certifications...'
              : 'E.g. 5 years of plumbing, training attended, certifications...'
          }
          className={`${inputCls} resize-none`}
        />
        <label className="block text-xs text-muted-foreground mt-3 mb-1">
          {isFr ? 'Photo de vos travaux (lien URL)' : 'Photo of your work (URL link)'}
        </label>
        <input
          type="url"
          value={profile.experience_photo_url}
          onChange={e => set('experience_photo_url', e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </Section>

      {/* ── Mobile Money ────────────────────────────────────────────────────── */}
      <Section title={isFr ? 'Mobile Money (pour les paiements)' : 'Mobile Money (for payments)'}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {isFr ? 'Opérateur' : 'Operator'}
            </label>
            <select
              value={profile.mobile_money_operator}
              onChange={e => set('mobile_money_operator', e.target.value)}
              className={inputCls}
            >
              <option value="">{isFr ? '— Choisir —' : '— Select —'}</option>
              <option value="wave">Wave</option>
              <option value="orange_money">Orange Money</option>
              <option value="mtn_momo">MTN MoMo</option>
              <option value="moov_money">Moov Money</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {isFr ? 'Numéro' : 'Number'}
            </label>
            <input
              type="tel"
              value={profile.mobile_money_number}
              onChange={e => set('mobile_money_number', e.target.value)}
              placeholder="+225 07 XX XX XX XX"
              className={inputCls}
            />
          </div>
        </div>
        <label className="block text-xs text-muted-foreground mt-3 mb-1">
          {isFr ? 'Nom sur le compte Mobile Money' : 'Name on Mobile Money account'}
        </label>
        <input
          type="text"
          value={profile.mobile_money_name}
          onChange={e => set('mobile_money_name', e.target.value)}
          placeholder={isFr ? 'Kouassi Marie' : 'Full name'}
          className={inputCls}
        />
      </Section>

      {/* ── Verification checklist + action buttons ──────────────────────────── */}
      {!showStatusCard && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
          <h3 className="text-sm font-semibold">
            {isFr ? 'Checklist avant soumission' : 'Pre-submission checklist'}
          </h3>
          <ul className="space-y-2">
            <CheckItem
              done={profile.bio.trim() !== ''}
              label={isFr ? 'Présentation rédigée *' : 'Bio written *'}
            />
            <CheckItem
              done={profile.id_document_url.trim() !== ''}
              label={isFr ? "Pièce d'identité fournie *" : 'ID document provided *'}
            />
            <CheckItem
              done={profile.profile_photo_url.trim() !== ''}
              label={isFr ? 'Photo de profil ajoutée' : 'Profile photo added'}
            />
            <CheckItem
              done={profile.experience_text.trim() !== ''}
              label={isFr ? 'Expérience décrite' : 'Experience described'}
            />
            <CheckItem
              done={profile.mobile_money_number.trim() !== '' && profile.mobile_money_operator !== ''}
              label={isFr ? 'Mobile Money renseigné' : 'Mobile Money set up'}
            />
          </ul>

          {!requiredFilled && (
            <p className="text-xs text-muted-foreground">
              {isFr
                ? '* Remplissez les champs obligatoires pour soumettre votre profil.'
                : '* Fill the required fields to submit your profile.'}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Save className="h-4 w-4 mr-2" />
              }
              {isFr ? 'Sauvegarder' : 'Save'}
            </Button>

            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!requiredFilled || isSubmitting}
            >
              {isSubmitting
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <ShieldCheck className="h-4 w-4 mr-2" />
              }
              {isFr ? 'Soumettre mon profil' : 'Submit my profile'}
            </Button>
          </div>
        </div>
      )}

      {/* Save button when status card is shown (profile already submitted/approved) */}
      {showStatusCard && (
        <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="mt-2">
          {isSaving
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <Save className="h-4 w-4 mr-2" />
          }
          {isFr ? 'Sauvegarder les modifications' : 'Save changes'}
        </Button>
      )}

    </div>
  )
}
