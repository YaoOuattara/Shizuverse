import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { bio, services } = await req.json() as { bio: string; services?: string[] }
    console.log('[improve-bio] bio length:', bio?.length, 'services:', services)

    if (!bio || bio.trim().length < 5) {
      return NextResponse.json({ improved_bio: null, error: 'bio_too_short' })
    }

    const serviceList = Array.isArray(services) && services.length > 0
      ? services.join(', ')
      : null

    const prompt = serviceList
      ? `Tu es un assistant qui aide les prestataires de services à Abidjan à améliorer leur bio professionnelle.
Le prestataire offre les services suivants : ${serviceList}.
Bio originale : "${bio}"
Améliore cette bio : rends-la plus professionnelle, accrocheuse et convaincante pour des clients potentiels à Abidjan.
Mets en valeur les services proposés. Garde le même sens, 2-4 phrases max.
Réponds UNIQUEMENT avec la bio améliorée, sans commentaire.`
      : `Tu es un assistant qui aide les prestataires de services à Abidjan à améliorer leur bio professionnelle.
Bio originale : "${bio}"
Améliore cette bio : rends-la plus professionnelle, accrocheuse et convaincante pour des clients potentiels.
Garde le même sens, 2-4 phrases max. Réponds UNIQUEMENT avec la bio améliorée, sans commentaire.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const improved_bio = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : null

    return NextResponse.json({ improved_bio })
  } catch (err) {
    console.error('[improve-bio] error:', err)
    return NextResponse.json({ improved_bio: null, error: String(err) }, { status: 500 })
  }
}
