import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { service_name, zone, appointment_date, appointment_time, client_name } = await req.json()
    const prompt = `Tu es l'assistant Shizu. Un prestataire de services à domicile à Abidjan
vient de recevoir une demande. Service=${service_name}, zone=${zone}, date=${appointment_date},
heure=${appointment_time}, client=${client_name}.
Écris un message TRÈS SIMPLE en français facile (niveau primaire), 3 phrases max.
Salutation + confirmation disponibilité + promesse de contact. Pas de mots compliqués.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ draft: text })
  } catch (error) {
    console.error('Provider response error:', error)
    return NextResponse.json({ draft: null }, { status: 500 })
  }
}
