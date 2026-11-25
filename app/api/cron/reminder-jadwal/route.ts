import { NextRequest, NextResponse } from 'next/server'
import { constantTimeSecretEqual } from '@/lib/constant-time'
import { internalErrorJson } from '@/lib/request-security'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { runScheduledReminders, type CronRuntimeEnv } from '@/lib/cron-dispatcher'

/**
 * Endpoint manual / fallback untuk dispatcher notifikasi otomatis.
 * Cron produksi berjalan langsung via worker-entry.ts scheduled() tanpa HTTP hop.
 *
 * GET /api/cron/reminder-jadwal
 * Auth: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !(await constantTimeSecretEqual(authHeader, `Bearer ${cronSecret}`))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { env } = await getCloudflareContext({ async: true })
    const result = await runScheduledReminders(env as unknown as CronRuntimeEnv)
    return NextResponse.json(result)
  } catch (error: unknown) {
    return internalErrorJson('cron.reminder_jadwal', error)
  }
}
