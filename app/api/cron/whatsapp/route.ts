import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db'
import { processWhatsAppOutbox } from '@/lib/whatsapp'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = await getDB()
    const result = await processWhatsAppOutbox(db, 25)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('WhatsApp cron error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
