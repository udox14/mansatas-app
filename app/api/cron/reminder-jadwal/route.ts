import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db-server'
import { constantTimeSecretEqual } from '@/lib/constant-time'
import { internalErrorJson } from '@/lib/request-security'
import { dispatchConfiguredReminders, dispatchDueParentAnnouncements } from '@/lib/notification-engine'

/**
 * Dispatcher notifikasi otomatis — dipanggil setiap 5 menit oleh Cloudflare Cron Trigger.
 * Setiap event mengikuti status dan konfigurasi reminder masing-masing.
 * 
 * GET /api/cron/reminder-jadwal
 * Auth: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !(await constantTimeSecretEqual(authHeader, `Bearer ${cronSecret}`))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = await getDB()

    let announcementResult = { processed: 0 }
    try {
      announcementResult = await dispatchDueParentAnnouncements(db)
    } catch (error) {
      console.error('[notification] parent announcement cron gagal:', error)
    }
    let automaticReminderResult: { processed: number; checkedAt?: string } = { processed: 0 }
    try {
      automaticReminderResult = await dispatchConfiguredReminders(db)
    } catch (error) {
      console.error('[notification] automatic reminder cron gagal:', error)
    }

    return NextResponse.json({
      success: true,
      announcementsProcessed: announcementResult.processed,
      automaticRemindersProcessed: automaticReminderResult.processed,
      checkedAt: automaticReminderResult.checkedAt,
    })

  } catch (error: unknown) {
    return internalErrorJson('cron.reminder_jadwal', error)
  }
}
