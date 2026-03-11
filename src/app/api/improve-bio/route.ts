import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { bio, locale } = await req.json()
    if (!bio || bio.trim().length < 10) {
      return NextResponse.json({ improved: null })
    }
    const lang = locale === 'en' ? 'English' : 'French'
    const prompt = `Tu es un assistant qui aide les prestataires de services à Abidjan à améliorer leur bio professionnelle.
Bio originale: "${bio}"
Améliore cette bio en ${lang}: rends-la plus professionnelle, accrocheuse et convaincante pour des clients potentiels.
Garde le même sens, 2-4 phrases max. Réponds UNIQUEMENT avec la bio améliorée, sans commentaire.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : null
    return NextResponse.json({ improved: text })
  } catch {
    return NextResponse.json({ improved: null }, { status: 500 })
  }
}
