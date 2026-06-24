import { getDB } from '@/utils/db'

export const SYSTEM_SETTING_KEYS = {
  agendaTimeRestriction: 'agenda_time_restriction_enabled',
  agendaLateEnabled: 'agenda_late_enabled',
  agendaLateThresholdMinutes: 'agenda_late_threshold_minutes',
  agendaLateThresholdByJam: 'agenda_late_threshold_by_jam',
  attendanceTimeRestriction: 'attendance_time_restriction_enabled',
  attendanceSkipIncompleteForDailyStatus: 'attendance_skip_incomplete_for_daily_status',
  heroBackgroundImageUrl: 'hero_background_image_url',
  heroRunningText: 'hero_running_text',
  heroTextColor: 'hero_text_color',
  heroRunningTextBg: 'hero_running_text_bg',
  heroRunningTextColor: 'hero_running_text_color',
} as const

async function ensureSystemSettingsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

export async function getSystemSetting(key: string, fallback = ''): Promise<string> {
  const db = await getDB()
  await ensureSystemSettingsTable(db)
  const row = await db.prepare(
    'SELECT value FROM system_settings WHERE key = ?'
  ).bind(key).first<{ value: string }>()
  return row?.value ?? fallback
}

export async function getSystemSettingBoolean(key: string, fallback = false): Promise<boolean> {
  const raw = await getSystemSetting(key, fallback ? '1' : '0')
  return raw === '1' || raw.toLowerCase() === 'true'
}

export async function getSystemSettingNumber(key: string, fallback: number): Promise<number> {
  const raw = await getSystemSetting(key, String(fallback))
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  const db = await getDB()
  await ensureSystemSettingsTable(db)
  await db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(key, value).run()
}
