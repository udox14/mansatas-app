import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db'
import { getWhatsAppConfig, updateWhatsAppMessageStatus, verifyWhatsAppSignature } from '@/lib/whatsapp'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const config = await getWhatsAppConfig()
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === config.verifyToken) {
    return new NextResponse(challenge || '', { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  const signatureValid = await verifyWhatsAppSignature(rawBody, signature)
  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody)
    const db = await getDB()
    const changes = payload?.entry?.flatMap((entry: any) => entry?.changes || []) || []
    let updated = 0

    for (const change of changes) {
      const statuses = change?.value?.statuses || []
      for (const status of statuses) {
        const messageId = String(status?.id || '')
        if (!messageId) continue
        const statusName = String(status?.status || 'sent')
        const errorMessage = status?.errors?.[0]?.message || status?.errors?.[0]?.title || null
        await updateWhatsAppMessageStatus(db, messageId, statusName, errorMessage)
        updated += 1
      }
    }

    return NextResponse.json({ success: true, updated })
  } catch (error: any) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
