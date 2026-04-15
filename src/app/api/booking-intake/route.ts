import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface IntakeResult {
  suggested_notes: string | null
  suggested_date_hint: string | null
  suggested_location_hint: string | null
}

export async function POST(req: NextRequest) {
  try {
    const { user_input, service_name, locale = 'fr' } =
      await req.json() as { user_input: string; service_name?: string; locale?: string }

    if (!user_input || user_input.trim().length < 3) {
      return NextResponse.json({ suggested_notes: null, suggested_date_hint: null, suggested_location_hint: null })
    }

    const prompt =
      locale === 'fr'
        ? `Service demandé : ${service_name || 'non précisé'}\nDescription du client : "${user_input}"\n\nExtrais les informations et retourne le JSON.`
        : `Requested service: ${service_name || 'unspecified'}\nClient description: "${user_input}"\n\nExtract the information and return the JSON.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system:
        "Tu es un assistant de réservation pour Shizu à Abidjan. " +
        "L'utilisateur décrit son besoin en langage naturel. " +
        "Extrais les informations clés et retourne UNIQUEMENT un JSON valide " +
        "avec les champs: suggested_notes, suggested_date_hint, " +
        "suggested_location_hint. Pas de texte supplémentaire.",
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const result: IntakeResult = JSON.parse(cleaned)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[booking-intake] error:', err)
    return NextResponse.json(
      { suggested_notes: null, suggested_date_hint: null, suggested_location_hint: null },
      { status: 500 }
    )
  }
}
