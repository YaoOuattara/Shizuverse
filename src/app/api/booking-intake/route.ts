import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface IntakeResult {
  suggested_notes: string | null
  suggested_date_hint: string | null
  suggested_location_hint: string | null
}

export async function POST(req: NextRequest) {
  console.log('[booking-intake] env check:', {
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    keyLength: process.env.ANTHROPIC_API_KEY?.length ?? 0,
  })

  // Instantiate inside handler so missing-key errors are caught below
  const client = new Anthropic()

  try {
    const { user_input, service_name, locale = 'fr' } =
      await req.json() as { user_input: string; service_name?: string; locale?: string }

    if (!user_input || user_input.trim().length < 3) {
      return NextResponse.json({ suggested_notes: null, suggested_date_hint: null, suggested_location_hint: null })
    }

    // Graceful degradation: only 'en' switches to English; anything missing
    // or unknown stays French (current behaviour).
    const isEn = String(locale || '').trim().toLowerCase().startsWith('en')

    const prompt = isEn
      ? `Requested service: ${service_name || 'unspecified'}\nClient description: "${user_input}"\n\nExtract the information and return the JSON.`
      : `Service demandé : ${service_name || 'non précisé'}\nDescription du client : "${user_input}"\n\nExtrais les informations et retourne le JSON.`

    // The system prompt drives the OUTPUT language of the free-text fields the
    // client sees (suggested_notes, suggested_date_hint). It must match the
    // active page language — otherwise an EN client gets French notes.
    const system = isEn
      ? "You are a booking assistant for Shizu in Abidjan. " +
        "The user describes their need in natural language. " +
        "Extract the key information and return ONLY valid JSON with the fields: " +
        "suggested_notes, suggested_date_hint, suggested_location_hint. " +
        "IMPORTANT: write suggested_notes and suggested_date_hint IN ENGLISH. " +
        "suggested_location_hint must contain the mentioned place/neighbourhood as-is. " +
        "No extra text."
      : "Tu es un assistant de réservation pour Shizu à Abidjan. " +
        "L'utilisateur décrit son besoin en langage naturel. " +
        "Extrais les informations clés et retourne UNIQUEMENT un JSON valide " +
        "avec les champs: suggested_notes, suggested_date_hint, suggested_location_hint. " +
        "IMPORTANT : rédige suggested_notes et suggested_date_hint EN FRANÇAIS. " +
        "suggested_location_hint doit contenir le lieu/quartier mentionné tel quel. " +
        "Pas de texte supplémentaire."

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    console.log('[booking-intake] raw Claude response:', raw)

    // Extract the first {...} block — handles leading/trailing text from Claude
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[booking-intake] no JSON object found in response:', raw)
      return NextResponse.json(
        { suggested_notes: null, suggested_date_hint: null, suggested_location_hint: null }
      )
    }

    const result: IntakeResult = JSON.parse(jsonMatch[0])
    console.log('[booking-intake] parsed result:', result)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[booking-intake] error:', err)
    return NextResponse.json(
      { suggested_notes: null, suggested_date_hint: null, suggested_location_hint: null },
      { status: 500 }
    )
  }
}
