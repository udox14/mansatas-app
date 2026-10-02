import { ATTENDANCE_PERMISSION_TRIGGERS } from './attendance-permission-triggers'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import type { FinalAttendanceDetail } from '@/lib/wali-kelas-attendance'

export const ATTENDANCE_NOTICE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS attendance_parent_notice_state (
    siswa_id TEXT NOT NULL REFERENCES siswa(id), tanggal TEXT NOT NULL,
    initial_revision INTEGER NOT NULL DEFAULT 0,
    initial_ref TEXT, initial_candidate TEXT, initial_due_at TEXT, initial_sent_at TEXT,
    final_revision INTEGER NOT NULL DEFAULT 0,
    final_status TEXT, final_ref TEXT, final_due_at TEXT,
    final_sent_status TEXT, final_sent_revision INTEGER NOT NULL DEFAULT 0,
    needs_recheck INTEGER NOT NULL DEFAULT 1, next_check_at TEXT,
    PRIMARY KEY (siswa_id, tanggal)
  )`

export type AttendanceNoticeState = {
  siswa_id: string; tanggal: string
  initial_revision: number; initial_ref: string | null; initial_candidate: string | null
  initial_due_at: string | null; initial_sent_at: string | null
  final_revision: number; final_status: string | null; final_ref: string | null
  final_due_at: string | null; final_sent_status: string | null; final_sent_revision: number
}

const noticeSchemaPromises = new WeakMap<object, Promise<void>>()

export async function attendanceNoticeActivation(db: D1Database) {
  let promise = noticeSchemaPromises.get(db as object)
  if (!promise) {
    promise = ensureSchemaOnce('attendance-notice-v3', async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS attendance_notice_policy (id INTEGER PRIMARY KEY CHECK(id = 1), activated_at TEXT NOT NULL)`),
      db.prepare(`INSERT OR IGNORE INTO attendance_notice_policy (id, activated_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
      db.prepare(ATTENDANCE_NOTICE_SCHEMA),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_attendance_notice_date ON attendance_parent_notice_state(tanggal, initial_sent_at)`),
    ])
    const columns = await db.prepare('PRAGMA table_info(attendance_parent_notice_state)').all<{ name: string }>()
    const names = new Set((columns.results || []).map(c => c.name))
    if (!names.has('needs_recheck')) await db.prepare('ALTER TABLE attendance_parent_notice_state ADD COLUMN needs_recheck INTEGER NOT NULL DEFAULT 1').run()
    if (!names.has('next_check_at')) await db.prepare('ALTER TABLE attendance_parent_notice_state ADD COLUMN next_check_at TEXT').run()
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_attendance_notice_due ON attendance_parent_notice_state(needs_recheck, next_check_at)').run()
    await db.batch(ATTENDANCE_PERMISSION_TRIGGERS.map(sql => db.prepare(sql)))
    }).catch(error => { noticeSchemaPromises.delete(db as object); throw error })
    noticeSchemaPromises.set(db as object, promise)
  }
  await promise
  const row = await db.prepare('SELECT activated_at FROM attendance_notice_policy WHERE id = 1').first<{ activated_at: string }>()
  if (!row) throw new Error('Batas aktivasi notifikasi absensi belum tersedia.')
  return row.activated_at
}

export function attendanceDateEligible(tanggal: string, activation: string, now = new Date()) {
  const dateWib = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
  return tanggal >= dateWib(new Date(activation)) && tanggal <= dateWib(now)
}

export function utcSourceTimestamp(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`
}

/** Official permission masks a teacher's session record, even when both say SAKIT. */
export function teacherNoticeStillValid(day: FinalAttendanceDetail | undefined, assignment: string, status: string) {
  if (!day || (day.wali_status && day.wali_status !== status)) return false
  const block = day.block_statuses.find(item => item.penugasan_id === assignment)
  if (!block?.submitted || block.status !== status) return false
  return !day.detail_guru.some(item => item.sumber === 'perizinan_siswa' &&
    item.jam_ke_mulai <= block.jam_ke_selesai && item.jam_ke_selesai >= block.jam_ke_mulai)
}

export function initialAttendanceContext(status: string) {
  return status === 'ALFA' ? 'belum hadir pada sesi ini' : status === 'SAKIT' ? 'sakit' : 'izin'
}

export async function readAttendanceNoticeState(db: D1Database, siswaId: string, tanggal: string) {
  return db.prepare('SELECT * FROM attendance_parent_notice_state WHERE siswa_id = ? AND tanggal = ?')
    .bind(siswaId, tanggal).first<AttendanceNoticeState>()
}

/** Wali correction is a daily override, usable before the final daily recap. */
export function effectiveInitialAttendanceStatus(day: FinalAttendanceDetail | undefined, assignment: string, teacherStatus: string) {
  if (!day) return null
  // Official school full-day present priority always wins.
  if (day.sumber_status === 'perizinan_sekolah') return null
  const uncorrected = { ...day, wali_status: null }
  if (!teacherNoticeStillValid(uncorrected, assignment, teacherStatus)) return null
  const status = day.wali_status || teacherStatus
  return ['ALFA', 'SAKIT', 'IZIN'].includes(status) ? status : null
}
