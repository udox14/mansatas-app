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
    PRIMARY KEY (siswa_id, tanggal)
  )`

export type AttendanceNoticeState = {
  siswa_id: string; tanggal: string
  initial_revision: number; initial_ref: string | null; initial_candidate: string | null
  initial_due_at: string | null; initial_sent_at: string | null
  final_revision: number; final_status: string | null; final_ref: string | null
  final_due_at: string | null; final_sent_status: string | null; final_sent_revision: number
}

export async function attendanceNoticeActivation(db: D1Database) {
  await ensureSchemaOnce('attendance-notice-v2', async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS attendance_notice_policy (id INTEGER PRIMARY KEY CHECK(id = 1), activated_at TEXT NOT NULL)`),
      db.prepare(`INSERT OR IGNORE INTO attendance_notice_policy (id, activated_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
      db.prepare(ATTENDANCE_NOTICE_SCHEMA),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_attendance_notice_date ON attendance_parent_notice_state(tanggal, initial_sent_at)`),
    ])
  })
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
