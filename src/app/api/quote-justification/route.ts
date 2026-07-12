import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Generates a short, client-facing note (French) explaining why a quote
// exceeds the category's indicative range. Admin-only, never auto-sent.
export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic()
    const {
      service, category, rangeMin, rangeMax, amount,
      commune, urgency, timePreference, description,
    } = await req.json() as {
      service?: string; category?: string;
      rangeMin?: number | null; rangeMax?: number | null; amount?: number;
      commune?: string; urgency?: string; timePreference?: string; description?: string;
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ note: null, error: 'invalid_amount' }, { status: 400 })
    }

    const fmt = (n?: number | null) =>
      n != null ? new Intl.NumberFormat('fr-FR').format(n) + ' FCFA' : '—'
    const range =
      rangeMin != null && rangeMax != null ? `${fmt(rangeMin)} – ${fmt(rangeMax)}`
      : rangeMin != null ? `à partir de ${fmt(rangeMin)}`
      : 'non précisée'

    const context = [
      `Service demandé : ${service || 'non précisé'}`,
      `Catégorie : ${category || 'non précisée'}`,
      `Fourchette indicative affichée au client : ${range}`,
      `Montant du devis : ${fmt(amount)}`,
      commune ? `Commune : ${commune}` : null,
      urgency ? `Urgence : ${urgency}` : null,
      timePreference ? `Préférence horaire : ${timePreference}` : null,
      description ? `Description du besoin : ${description}` : null,
    ].filter(Boolean).join('\n')

    const prompt = `Tu écris une note destinée AU CLIENT pour une plateforme de services à domicile à Abidjan.
Le devis proposé dépasse la fourchette indicative affichée. Rédige une note courte (2 à 3 phrases), en français, qui explique de façon factuelle et rassurante pourquoi le montant est plus élevé que la fourchette (ampleur du travail, spécificités de la demande, urgence, déplacement, etc., selon le contexte).
Ton : professionnel, factuel, rassurant. Justifie sans t'excuser. N'invente pas de détails absents du contexte ; reste général si nécessaire.
Réponds UNIQUEMENT avec la note, sans préambule ni guillemets.

Contexte :
${context}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }],
    })

    const note = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : null

    return NextResponse.json({ note })
  } catch (err) {
    console.error('[quote-justification] error:', err)
    return NextResponse.json({ note: null, error: 'ai_error' }, { status: 500 })
  }
}
