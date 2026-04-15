import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  const keyPresent = !!process.env.ANTHROPIC_API_KEY
  const keyLength = process.env.ANTHROPIC_API_KEY?.length ?? 0

  console.log('[test-ai] env check:', { hasKey: keyPresent, keyLength })

  if (!keyPresent) {
    return NextResponse.json({
      success: false,
      error: 'ANTHROPIC_API_KEY is not set in this environment',
      env: { hasKey: false, keyLength: 0 },
    }, { status: 500 })
  }

  try {
    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 30,
      messages: [{ role: 'user', content: 'Say hello in French. One word only.' }],
    })

    const response = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[test-ai] Claude response:', response)

    return NextResponse.json({
      success: true,
      response,
      env: { hasKey: true, keyLength },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[test-ai] Claude call failed:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      env: { hasKey: keyPresent, keyLength },
    }, { status: 500 })
  }
}
