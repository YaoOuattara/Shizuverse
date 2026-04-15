import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  console.log('[smart-rejection] env check:', {
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    keyLength: process.env.ANTHROPIC_API_KEY?.length ?? 0,
  })

  // Instantiate inside handler so missing-key errors are caught below
  const client = new Anthropic()

  try {
    const { provider_name, rejection_reason, language = 'fr' } =
      await req.json() as { provider_name: string; rejection_reason: string; language?: string }

    if (!provider_name || !rejection_reason) {
      return NextResponse.json({ message: null, error: 'missing_fields' }, { status: 400 })
    }

    const prompt =
      language === 'fr'
        ? `Prestataire : ${provider_name}\nRaison du rejet : ${rejection_reason}\n\nRédige le message de rejet.`
        : `Provider: ${provider_name}\nRejection reason: ${rejection_reason}\n\nWrite the rejection message.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system:
        "Tu es un assistant de Shizu, une application de services à domicile " +
        "à Abidjan. Écris un message de rejet simple, chaleureux et encourageant " +
        "en français pour un prestataire dont la candidature n'a pas été retenue. " +
        "Utilise un ton proche et bienveillant — comme si tu parlais à quelqu'un " +
        "que tu connais. Évite le langage administratif et les formules trop " +
        "formelles. Sois direct sur la raison du rejet et dis-lui exactement " +
        "quoi faire pour repostuler. Maximum 3 phrases courtes. Termine avec " +
        "un emoji encourageant.",
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      message.content[0].type === 'text' ? message.content[0].text.trim() : null

    return NextResponse.json({ message: text })
  } catch (err) {
    console.error('[smart-rejection] error:', err)
    return NextResponse.json({ message: null, error: String(err) }, { status: 500 })
  }
}
