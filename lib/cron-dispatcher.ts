import {
  dispatchAttendanceDailyNotices,
  dispatchConfiguredReminders,
  dispatchDueParentAnnouncements,
  type NotificationQueueMessage,
} from '@/lib/notification-engine'
import type { FcmRuntimeEnv } from '@/lib/fcm'
import { autoReturnIzinKeluar } from '@/lib/izin-keluar-auto-return'
import { cleanupExpiredModulePhotos, type ModulePhotoCleanupResult } from '@/lib/module-photo-retention'

const PHOTO_RETENTION_KV_KEY = 'cron:module-photo-retention:last-run'
const PHOTO_RETENTION_INTERVAL_SECONDS = 24 * 60 * 60
const PHOTO_RETENTION_INTERVAL_MS = PHOTO_RETENTION_INTERVAL_SECONDS * 1000

let lastPhotoCleanupInMemoryMs = 0

export type CronRuntimeEnv = FcmRuntimeEnv & {
  DB: D1Database
  R2?: Pick<R2Bucket, 'list' | 'delete'>
  NEXT_INC_CACHE_KV?: KVNamespace
  NOTIFICATION_QUEUE?: {
    send: (body: NotificationQueueMessage, options?: { contentType?: 'json'; delaySeconds?: number }) => Promise<void>
  }
}

async function shouldRunDailyPhotoCleanup(kv?: KVNamespace, nowMs = Date.now()): Promise<boolean> {
  if (lastPhotoCleanupInMemoryMs > 0 && nowMs - lastPhotoCleanupInMemoryMs < PHOTO_RETENTION_INTERVAL_MS) {
    return false
  }
  if (kv) {
    try {
      const lastRun = await kv.get(PHOTO_RETENTION_KV_KEY)
      if (lastRun) {
        lastPhotoCleanupInMemoryMs = nowMs
        return false
      }
    } catch {
      // Fall through to run cleanup if KV read fails.
    }
  }
  return true
}

async function markDailyPhotoCleanupDone(kv?: KVNamespace, nowMs = Date.now()): Promise<void> {
  lastPhotoCleanupInMemoryMs = nowMs
  if (!kv) return
  try {
    await kv.put(PHOTO_RETENTION_KV_KEY, new Date(nowMs).toISOString(), {
      expirationTtl: PHOTO_RETENTION_INTERVAL_SECONDS,
    })
  } catch {
    // Non-fatal; in-memory guard still protects the warm isolate.
  }
}

export async function runScheduledReminders(env: CronRuntimeEnv) {
  const db = env.DB

  let photoCleanupResult: ModulePhotoCleanupResult & { skipped?: boolean } = {
    scanned: 0,
    deleted: 0,
    failed: 0,
    errors: [],
    skipped: true,
  }

  if (env.R2 && (await shouldRunDailyPhotoCleanup(env.NEXT_INC_CACHE_KV))) {
    try {
      photoCleanupResult = await cleanupExpiredModulePhotos(env.R2)
      await markDailyPhotoCleanupDone(env.NEXT_INC_CACHE_KV)
      console.info(JSON.stringify({ event: 'module_photo_retention_completed', ...photoCleanupResult }))
      for (const error of photoCleanupResult.errors) {
        console.error(JSON.stringify({ event: 'module_photo_retention_error', error }))
      }
    } catch (error) {
      photoCleanupResult = {
        scanned: 0,
        deleted: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      }
      console.error(JSON.stringify({ event: 'module_photo_retention_failed', error: photoCleanupResult.errors[0] }))
    }
  }

  // Run before attendance finalization; independent of notification settings.
  const izinReturnResult = await autoReturnIzinKeluar(db)

  let announcementResult = { processed: 0 }
  try {
    announcementResult = await dispatchDueParentAnnouncements(db, env)
  } catch (error) {
    console.error('[notification] parent announcement cron gagal:', error)
  }

  let automaticReminderResult: { processed: number; checkedAt?: string } = { processed: 0 }
  try {
    automaticReminderResult = await dispatchConfiguredReminders(db, env)
  } catch (error) {
    console.error('[notification] automatic reminder cron gagal:', error)
  }

  let attendanceResult = { processed: 0 }
  try {
    attendanceResult = await dispatchAttendanceDailyNotices(db, env)
  } catch (error) {
    console.error('[notification] rekap kehadiran cron gagal:', error)
  }

  return {
    success: true,
    modulePhotoCleanup: photoCleanupResult,
    izinAutoReturned: izinReturnResult.processed,
    announcementsProcessed: announcementResult.processed,
    automaticRemindersProcessed: automaticReminderResult.processed,
    attendanceNoticesProcessed: attendanceResult.processed,
    checkedAt: automaticReminderResult.checkedAt,
  }
}
