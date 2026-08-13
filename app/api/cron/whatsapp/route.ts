import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db-server'
import { processWhatsAppOutbox } from '@/lib/whatsapp'
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = await getDB()

    const enabled = await getSystemSettingBoolean(SYSTEM_SETTING_KEYS.cronWhatsappEnabled, true)
    if (!enabled) {
      return NextResponse.json({
        success: true,
        disabled: true,
        message: 'Pemrosesan outbox WhatsApp dinonaktifkan di pengaturan.',
      })
    }

    const result = await processWhatsAppOutbox(db, 25)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('WhatsApp cron error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
