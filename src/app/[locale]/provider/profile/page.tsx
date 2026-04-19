'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2, Sparkles, Save, CheckCircle2, XCircle,
  ShieldCheck, ShieldAlert, ShieldX, Clock, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? 'https://shizu-verse.onrender.com'

// ── Cloudinary upload ──────────────────────────────────────────────────────────

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary env vars not set')
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.secure_url as string
}

// ── Types ──────────────────────────────────────────────────────────────────────

type VerificationStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended'

interface ProfileState {
  bio: string
  profile_photo_url: string
  id_document_url: string
  document_type: string
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
  document_type: '',
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

// ── Sub-components ─────────────────────────────────────────────────────────────

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

// Three button states: idle → uploading → uploaded (thumbnail + Modifier)
function ImageUpload({
  value,
  onChange,
  isFr,
  accept = 'image/*',
  previewRound = false,
}: {
  value: string
  onChange: (url: string) => void
  isFr: boolean
  accept?: string
  previewRound?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file)
      onChange(url)
    } catch (err) {
      console.error('[cloudinary]', err)
      toast({
        title: isFr ? 'Erreur upload' : 'Upload error',
        description: isFr ? "Impossible d'envoyer le fichier." : 'Could not upload the file.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={value}
          alt=""
          className={`h-16 w-16 object-cover border border-border ${
            previewRound ? 'rounded-full' : 'rounded-lg'
          }`}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
        <label
          className={`inline-flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/50 transition-colors ${
            uploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
          }`}
        >
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />{isFr ? 'Envoi en cours...' : 'Uploading...'}</>
          ) : (
            <><Upload className="h-3.5 w-3.5" />{isFr ? 'Modifier' : 'Change'}</>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
      </div>
    )
  }

  return (
    <label
      className={`inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-border hover:bg-muted/50 text-sm text-muted-foreground transition-colors ${
        uploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      }`}
    >
      {uploading ? (
        <><Loader2 className="h-4 w-4 animate-spin" />{isFr ? 'Envoi en cours...' : 'Uploading...'}</>
      ) : (
        <><Upload className="h-4 w-4" />{isFr ? 'Choisir un fichier' : 'Choose a file'}</>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
        disabled={uploading}
      />
    </label>
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
              ? "Votre compte a été suspendu. Contactez le support Shizu pour plus d'informations."
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

// ── Main page ──────────────────────────────────────────────────────────────────

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
  const [forceForm, setForceForm] = useState(false)

  useEffect(() => {
    // 1. Show localStorage immediately (no flicker)
    try {
      const info = JSON.parse(localStorage.getItem('provider_info') || 'null')
      if (info) {
        setProviderName(info.name ?? info.full_name ?? info.company_name ?? '')
        setServices(Array.isArray(info.services) ? info.services : [])
        setProfile({
          bio:                   info.bio ?? '',
          profile_photo_url:     info.profile_photo_url ?? '',
          id_document_url:       info.id_document_url ?? '',
          document_type:         info.document_type ?? '',
          experience_text:       info.experience_text ?? '',
          experience_photo_url:  info.experience_photo_url ?? '',
          mobile_money_number:   info.mobile_money_number ?? '',
          mobile_money_name:     info.mobile_money_name ?? '',
          mobile_money_operator: info.mobile_money_operator ?? '',
          verification_status:   info.verification_status ?? 'draft',
          rejection_reason:      info.rejection_reason ?? '',
        })
      }
    } catch { /* ignore */ }

    // 2. Fetch fresh data from API and override (catches admin status changes)
    const token = localStorage.getItem('provider_token')
    if (!token) return
    fetch(`${FLASK_API}/api/provider/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return
        const fresh: ProfileState = {
          bio:                   data.bio ?? '',
          profile_photo_url:     data.profile_photo_url ?? '',
          id_document_url:       data.id_document_url ?? '',
          document_type:         data.document_type ?? '',
          experience_text:       data.experience_text ?? '',
          experience_photo_url:  data.experience_photo_url ?? '',
          mobile_money_number:   data.mobile_money_number ?? '',
          mobile_money_name:     data.mobile_money_name ?? '',
          mobile_money_operator: data.mobile_money_operator ?? '',
          verification_status:   (data.verification_status as VerificationStatus) ?? 'draft',
          rejection_reason:      data.rejection_reason ?? '',
        }
        setProfile(fresh)
        setProviderName(data.name ?? '')
        setServices(Array.isArray(data.services) ? data.services : [])
        // Keep localStorage in sync
        try {
          const existing = JSON.parse(localStorage.getItem('provider_info') || '{}')
          localStorage.setItem('provider_info', JSON.stringify({
            ...existing, ...fresh,
            name: data.name,
            services: data.services,
          }))
        } catch { /* ignore */ }
      })
      .catch(() => { /* silently fall back to localStorage data already shown */ })
  }, [])

  const set = (field: keyof ProfileState, value: string) =>
    setProfile(prev => ({ ...prev, [field]: value }))

  const patchLocalStorage = (updates: Partial<ProfileState>) => {
    try {
      const info = JSON.parse(localStorage.getItem('provider_info') || 'null') ?? {}
      localStorage.setItem('provider_info', JSON.stringify({ ...info, ...updates }))
    } catch { /* ignore */ }
  }

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
        toast({ title: isFr ? 'Sauvegardé' : 'Saved', description: isFr ? 'Modifications enregistrées.' : 'Changes saved.' })
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
        document_type:         profile.document_type,
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

      {/* ── Bio ───────────────────────────────────────────────────────────── */}
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

      {/* ── Profile photo ─────────────────────────────────────────────────── */}
      <Section title={isFr ? 'Photo de profil' : 'Profile photo'}>
        <p className="text-xs text-muted-foreground">
          {isFr
            ? 'Une photo claire de votre visage aide les clients à vous reconnaître.'
            : 'A clear photo of your face helps clients recognise you.'}
        </p>
        <ImageUpload
          value={profile.profile_photo_url}
          onChange={url => set('profile_photo_url', url)}
          isFr={isFr}
          accept="image/*"
          previewRound
        />
      </Section>

      {/* ── ID document ───────────────────────────────────────────────────── */}
      <Section title={isFr ? "Pièce d'identité *" : 'ID Document *'}>
        <label className="block text-xs text-muted-foreground mb-1">
          {isFr ? 'Type de document' : 'Document type'}
        </label>
        <select
          value={profile.document_type}
          onChange={e => set('document_type', e.target.value)}
          className={inputCls}
        >
          <option value="">{isFr ? '— Choisir —' : '— Select —'}</option>
          <option value="cni">{isFr ? "Carte nationale d'identité (CNI)" : "National ID Card (CNI)"}</option>
          <option value="passeport">Passeport</option>
          <option value="permis">{isFr ? 'Permis de conduire' : "Driver's License"}</option>
          <option value="extrait">{isFr ? 'Extrait de naissance' : 'Birth Certificate'}</option>
          <option value="autre">{isFr ? 'Autre' : 'Other'}</option>
        </select>
        <p className="text-xs text-muted-foreground">
          {isFr
            ? 'Photo recto de votre document. Formats acceptés : image ou PDF.'
            : 'Front-facing photo of your document. Accepted: image or PDF.'}
        </p>
        <ImageUpload
          value={profile.id_document_url}
          onChange={url => set('id_document_url', url)}
          isFr={isFr}
          accept="image/*,.pdf"
        />
      </Section>

      {/* ── Experience ────────────────────────────────────────────────────── */}
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
          {isFr ? 'Photo de vos travaux' : 'Photo of your work'}
        </label>
        <ImageUpload
          value={profile.experience_photo_url}
          onChange={url => set('experience_photo_url', url)}
          isFr={isFr}
          accept="image/*"
        />
      </Section>

      {/* ── Mobile Money ──────────────────────────────────────────────────── */}
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

      {/* ── Verification checklist + action buttons ───────────────────────── */}
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

      {/* Save button when status card is shown */}
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
