import { getDB } from '@/utils/db-server'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { getMemCache, setMemCache, deleteMemCache } from '@/utils/mem-cache'
export { PARENT_LOGIN_TINGKAT_OPTIONS } from '@/lib/system-setting-constants'
import { PARENT_LOGIN_TINGKAT_OPTIONS } from '@/lib/system-setting-constants'

export const SYSTEM_SETTING_KEYS = {
  agendaTimeRestriction: 'agenda_time_restriction_enabled',
  agendaLateEnabled: 'agenda_late_enabled',
  agendaLateThresholdMinutes: 'agenda_late_threshold_minutes',
  agendaLateThresholdByJam: 'agenda_late_threshold_by_jam',
  agendaForgottenMonthlyLimit: 'agenda_forgotten_monthly_limit',
  attendanceTimeRestriction: 'attendance_time_restriction_enabled',
  attendanceSkipIncompleteForDailyStatus: 'attendance_skip_incomplete_for_daily_status',
  heroBackgroundImageUrl: 'hero_background_image_url',
  heroRunningText: 'hero_running_text',
  heroTextColor: 'hero_text_color',
  heroRunningTextBg: 'hero_running_text_bg',
  heroRunningTextColor: 'hero_running_text_color',
  parentLoginHelpEnabled: 'parent_login_help_enabled',
  parentLoginHelpWhatsapp: 'parent_login_help_whatsapp',
  parentLoginHelpInfo: 'parent_login_help_info',
  parentLoginBlockEnabled: 'parent_login_block_enabled',
  parentLoginBlockTingkat: 'parent_login_block_tingkat',
  parentLoginBlockMessage: 'parent_login_block_message',
  parentPortalDisciplineEnabled: 'parent_portal_discipline_enabled',
  parentPortalDisciplinePublishMode: 'parent_portal_discipline_publish_mode',
  parentPortalDisciplineClarificationMode: 'parent_portal_discipline_clarification_mode',
  androidPlayStoreRequired: 'android_play_store_required',
  ckhKepalaSignatureUrl: 'ckh_kepala_signature_url',
} as const

// Tingkat kelas yang bisa dibatasi loginnya (MA: 10, 11, 12)
// Pesan bawaan saat login tingkat tertentu diblokir
export const DEFAULT_PARENT_LOGIN_BLOCK_MESSAGE =
  'Login portal orang tua untuk tingkat kelas Anda sedang dinonaktifkan sementara oleh sekolah. Silakan hubungi admin sekolah untuk informasi lebih lanjut.'

// Parse daftar tingkat yang diblokir dari nilai tersimpan (JSON array angka)
export function parseBlockedTingkat(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && PARENT_LOGIN_TINGKAT_OPTIONS.includes(v as any))
  } catch {
    return []
  }
}

// Nomor WA bantuan akun portal ortu bawaan (dipakai bila admin belum set)
export const DEFAULT_PARENT_LOGIN_HELP_WHATSAPP = '6282218943383'

// Teks info bawaan yang tampil di modal saat tombol WA bantuan dinonaktifkan
export const DEFAULT_PARENT_LOGIN_HELP_INFO =
  'Untuk bantuan akun (lupa password atau username), silakan hubungi admin sekolah atau datang langsung ke bagian Tata Usaha MAN 1 Tasikmalaya pada jam kerja.'

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
  const cacheKey = `sys-setting:${key}`
  const cached = getMemCache<string>(cacheKey)
  if (cached !== undefined) return cached

  const db = await getDB()
  await ensureSchemaOnce('system-settings', () => ensureSystemSettingsTable(db))
  const row = await db.prepare(
    'SELECT value FROM system_settings WHERE key = ?'
  ).bind(key).first<{ value: string }>()
  const value = row?.value ?? fallback
  setMemCache(cacheKey, value, 60_000)
  return value
}

export async function getSystemSettings<const T extends string>(
  fallbacks: Record<T, string>,
): Promise<Record<T, string>> {
  const entries = Object.entries(fallbacks) as Array<[T, string]>
  const values = {} as Record<T, string>
  const missing: Array<[T, string]> = []

  for (const [key, fallback] of entries) {
    const cached = getMemCache<string>(`sys-setting:${key}`)
    if (cached === undefined) missing.push([key, fallback])
    else values[key] = cached
  }

  if (missing.length > 0) {
    const db = await getDB()
    await ensureSchemaOnce('system-settings', () => ensureSystemSettingsTable(db))
    const placeholders = missing.map(() => '?').join(',')
    const rows = await db.prepare(
      `SELECT key, value FROM system_settings WHERE key IN (${placeholders})`,
    ).bind(...missing.map(([key]) => key)).all<{ key: T; value: string }>()
    const stored = new Map((rows.results ?? []).map(row => [row.key, row.value]))

    for (const [key, fallback] of missing) {
      const value = stored.get(key) ?? fallback
      values[key] = value
      setMemCache(`sys-setting:${key}`, value, 60_000)
    }
  }

  return values
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
  await ensureSchemaOnce('system-settings', () => ensureSystemSettingsTable(db))
  await db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(key, value).run()
  deleteMemCache(`sys-setting:${key}`)
}

export async function setSystemSettings(values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values)
  if (entries.length === 0) return

  const db = await getDB()
  await ensureSchemaOnce('system-settings', () => ensureSystemSettingsTable(db))
  await db.batch(entries.map(([key, value]) => db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(key, value)))

  for (const [key] of entries) deleteMemCache(`sys-setting:${key}`)
}
