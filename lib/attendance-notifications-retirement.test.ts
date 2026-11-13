import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

const state = vi.hoisted(() => ({
  db: null as unknown as D1Database,
  attendanceNotification: vi.fn(),
  dailyNotification: vi.fn(),
  invalidate: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.db }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'teacher' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/action-security', () => ({ requireActionAccess: async () => ({ id: 'teacher' }) }))
vi.mock('@/lib/act-as', () => ({ getEffectiveUser: async () => null, getActAsDate: async () => null }))
vi.mock('@/lib/guru-ppl-access', () => ({ resolveTeachingAssignmentAccess: async () => ({ kelasId: 'class' }) }))
vi.mock('@/lib/schema-guard', () => ({ ensureSchemaOnce: async (_key: string, ensure: () => Promise<void>) => ensure() }))
vi.mock('@/lib/system-settings', () => ({ SYSTEM_SETTING_KEYS: { attendanceTimeRestriction: 'attendance_time_restriction_enabled' }, getSystemSettingBoolean: async () => false }))
vi.mock('@/lib/kalender-pendidikan', () => ({
  getKalenderDateStatus: async () => ({ isEffective: true }),
  getKbmExceptionsForDate: async () => [],
  splitTeachingSlotsByExceptions: (_exceptions: unknown, _class: unknown, slots: number[]) => ({ activeJamKe: slots, exceptionSegments: [] }),
}))
vi.mock('@/lib/attendance-cache', () => ({ invalidateAttendanceCache: state.invalidate }))
vi.mock('@/lib/notification-engine', () => ({
  prepareAttendanceNotificationWork: state.attendanceNotification,
  flushAttendanceNotificationOutbox: state.dailyNotification,
  emitConfiguredNotification: vi.fn(),
}))

import { simpanAbsensi } from '@/app/dashboard/kehadiran/actions'
import { simpanAbsensiDelegasi } from '@/app/dashboard/penugasan/actions'

let db: DatabaseSync
beforeEach(() => {
  vi.clearAllMocks()
  state.attendanceNotification.mockResolvedValue([])
  state.dailyNotification.mockResolvedValue(undefined)
  db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY);
    CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, kbm_nonaktif_mulai TEXT);
    CREATE TABLE siswa (id TEXT PRIMARY KEY, kelas_id TEXT, status TEXT);
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY);
    CREATE TABLE tahun_ajaran (id TEXT PRIMARY KEY, is_active INTEGER, jam_pelajaran TEXT);
    CREATE TABLE jadwal_mengajar (penugasan_id TEXT, tahun_ajaran_id TEXT, hari INTEGER, jam_ke INTEGER);
    CREATE TABLE absensi_siswa (penugasan_id TEXT, siswa_id TEXT, tanggal TEXT, jam_ke_mulai INTEGER, jam_ke_selesai INTEGER, jumlah_jam INTEGER, status TEXT, catatan TEXT, diinput_oleh TEXT);
    CREATE TABLE delegasi_tugas (id TEXT PRIMARY KEY, kepada_user_id TEXT, tanggal TEXT, status TEXT, updated_at TEXT, dari_user_id TEXT);
    CREATE TABLE delegasi_tugas_kelas (id TEXT PRIMARY KEY, delegasi_id TEXT, absen_selesai INTEGER, pelaksana_user_id TEXT, selesai_at TEXT, penugasan_mengajar_id TEXT);
    INSERT INTO "user" VALUES ('teacher');
    INSERT INTO kelas VALUES ('class',10,NULL);
    INSERT INTO siswa VALUES ('s','class','aktif');
    INSERT INTO penugasan_mengajar VALUES ('assignment');
    INSERT INTO tahun_ajaran VALUES ('year',1,'[]');
    INSERT INTO jadwal_mengajar VALUES ('assignment','year',4,1),('assignment','year',4,2);
    INSERT INTO delegasi_tugas VALUES ('delegation','teacher','2026-10-01','PENDING',NULL,'guru-utama');
    INSERT INTO delegasi_tugas_kelas VALUES ('delegation-class','delegation',0,NULL,NULL,'assignment');
  `)
  function prepared(sql: string, args: SQLInputValue[] = []) {
    // No WA tables exist: any accidental enqueue/schema recreation is a regression.
    if (/\bwa_(outbox|campaigns|daily_locks|campaign_recipients)\b/i.test(sql)) throw new Error('WA query after retirement')
    return {
      bind: (...values: SQLInputValue[]) => prepared(sql, values),
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      first: async () => db.prepare(sql).get(...args) || null,
      run: async () => ({ success: true, meta: db.prepare(sql).run(...args) }),
    }
  }
  state.db = { prepare: prepared, batch: async (statements: ReturnType<typeof prepared>[]) => {
    db.exec('BEGIN')
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      db.exec('COMMIT')
      return results
    } catch (error) { db.exec('ROLLBACK'); throw error }
  } } as unknown as D1Database
})
afterEach(() => db.close())

describe('attendance without WhatsApp', () => {
  it.each(['regular', 'delegated'])('saves ALFA and invokes non-WA notifications for %s attendance', async kind => {
    const attendance = [{ siswa_id: 's', status: 'ALFA', catatan: 'Tidak hadir' }]
    const result = kind === 'regular'
      ? await simpanAbsensi('assignment', '2026-10-01', '07:00', '08:00', 1, 2, 2, attendance)
      : await simpanAbsensiDelegasi('delegation-class', 'assignment', '2026-10-01', 1, 2, attendance)
    expect(result.error).toBeUndefined()
    expect(result.success).toBeTruthy()
    expect(db.prepare('SELECT status, diinput_oleh FROM absensi_siswa').get()).toMatchObject({ status: 'ALFA', diinput_oleh: 'teacher' })
    expect(db.prepare('SELECT diinput_oleh FROM absensi_sesi_guru').get()).toMatchObject({ diinput_oleh: 'teacher' })
    expect(state.attendanceNotification).toHaveBeenCalledWith(state.db, expect.objectContaining({ penugasanId: 'assignment', tanggal: '2026-10-01' }))
    expect(state.dailyNotification).toHaveBeenCalledWith(state.db)
    expect(state.invalidate).toHaveBeenCalled()
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'wa_%'").all()).toEqual([])
    if (kind === 'regular') expect(db.prepare('SELECT status FROM absensi_sesi_siswa').get()?.status).toBe('ALFA')
    else expect(db.prepare('SELECT status FROM delegasi_tugas').get()?.status).toBe('SELESAI')
  })

  it('preserves the daily notification when all students are present', async () => {
    const result = await simpanAbsensi('assignment', '2026-10-01', '07:00', '08:00', 1, 2, 2, [{ siswa_id: 's', status: 'HADIR', catatan: '' }])
    expect(result.success).toBeTruthy()
    expect(db.prepare('SELECT status FROM absensi_sesi_siswa').get()?.status).toBe('HADIR')
    expect(state.dailyNotification).toHaveBeenCalledOnce()
    expect(state.attendanceNotification).toHaveBeenCalledWith(state.db, expect.objectContaining({ notifyIds: [], siswaIds: ['s'] }))
  })
})
