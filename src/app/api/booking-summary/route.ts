import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { service_name, zone, appointment_date, locale } = await req.json()

    const dateStr = appointment_date
      ? new Date(appointment_date).toLocaleDateString(
          locale === 'fr' ? 'fr-FR' : 'en-US',
          { weekday: 'long', month: 'long', day: 'numeric' }
        )
      : ''

    const prompt =
      locale === 'fr'
        ? `Tu es l'assistant de Shizu, une plateforme de services à domicile à Abidjan. Un client vient de réserver "${service_name}" pour le ${dateStr} à ${zone}. Écris un message de confirmation chaleureux et rassurant en 2 phrases maximum. Commence directement par le message, sans formule de politesse.`
        : `You are Shizu's assistant, a home services platform in Abidjan. A client just booked "${service_name}" for ${dateStr} in ${zone}. Write a warm, reassuring confirmation in 2 sentences max. Start directly with the message, no greeting.`

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ summary: text })
  } catch (error) {
    console.error('Booking summary error:', error)
    return NextResponse.json({ summary: null }, { status: 500 })
  }
}
