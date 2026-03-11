import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { text, rating } = await req.json()
    if (!text || text.trim().length < 5) {
      return NextResponse.json({ status: 'approved', reason: 'no_text' })
    }

    const prompt = `Modère cet avis pour une plateforme de services à Abidjan.
Avis: "${text}" (note: ${rating}/5)
Réponds UNIQUEMENT avec JSON valide: {"status":"approved","reason":"ok"} ou {"status":"flagged","reason":"raison courte"}
Flaguer: spam, insultes, haine. Approuver: avis honnête même négatif.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ status: 'pending', reason: 'moderation_failed' })
  }
}
