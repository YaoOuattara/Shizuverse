'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import PhoneInput from '@/components/PhoneInput'

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? 'https://shizu-verse.onrender.com'

export default function ProviderLoginPage() {
  const t = useTranslations('providerLogin')
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) ?? 'fr'

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${FLASK_API}/api/provider/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 401 ? t('errorInvalid') : t('errorGeneral'))
        return
      }
      const store = rememberMe ? localStorage : sessionStorage
      store.setItem('provider_token', data.token)
      if (data.provider) {
        store.setItem('provider_info', JSON.stringify(data.provider))
      }
      router.push(`/${locale}/provider`)
    } catch {
      setError(t('errorGeneral'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <PhoneInput
                id="phone"
                defaultValue={phone}
                onChange={setPhone}
                required
                selectClassName="rounded-l-md border-input bg-muted text-muted-foreground"
                inputClassName="rounded-r-md border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">
                {locale === 'fr' ? 'Se souvenir de moi (30 jours)' : 'Remember me (30 days)'}
              </span>
            </label>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </form>

          <div className="mt-3 text-center">
            <a
              href={`/${locale}/provider/forgot-password`}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              {t('forgotPasswordLink')}
            </a>
          </div>

          <p className="mt-3 text-center text-sm text-muted-foreground">
            {t('noAccount')}{' '}
            <a
              href={`/${locale}/provider/register`}
              className="text-primary underline underline-offset-4"
            >
              {t('registerLink')}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
