import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db-server'
import { constantTimeSecretEqual } from '@/lib/constant-time'
import { internalErrorJson } from '@/lib/request-security'
import { dispatchConfiguredReminders, dispatchDueParentAnnouncements, dispatchAttendanceDailyNotices } from '@/lib/notification-engine'
import { autoReturnIzinKeluar } from '@/lib/izin-keluar-auto-return'

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

    // Run before attendance finalization; independent of notification settings.
    const izinReturnResult = await autoReturnIzinKeluar(db)

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

    let attendanceResult = { processed: 0 }
    try {
      attendanceResult = await dispatchAttendanceDailyNotices(db)
    } catch (error) {
      console.error('[notification] rekap kehadiran cron gagal:', error)
    }

    return NextResponse.json({
      success: true,
      izinAutoReturned: izinReturnResult.processed,
      announcementsProcessed: announcementResult.processed,
      automaticRemindersProcessed: automaticReminderResult.processed,
      attendanceNoticesProcessed: attendanceResult.processed,
      checkedAt: automaticReminderResult.checkedAt,
    })

  } catch (error: unknown) {
    return internalErrorJson('cron.reminder_jadwal', error)
  }
}
