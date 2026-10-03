import type { PolaJam } from '@/app/dashboard/settings/types'
import { invalidateAttendanceCache } from '@/lib/attendance-cache'

const BATCH_SIZE = 100
const AUTO_NOTE = '[Otomatis: izin harian ditutup setelah pembelajaran berakhir; bukan konfirmasi kepulangan fisik.]'

// Reject incomplete/invalid patterns rather than closing today's permits too early.
function endTimes(raw: string | null): Array<string | null> {
  let patterns: PolaJam[] = []
  try {
    const parsed: unknown = JSON.parse(raw || '[]')
    if (Array.isArray(parsed)) patterns = parsed
  } catch { /* No valid timetable: only recover permits from previous days. */ }
  return Array.from({ length: 7 }, (_, weekday) => {
    const slots = patterns.find(p => Array.isArray(p?.hari) && p.hari.includes(weekday || 7))?.slots
    if (!Array.isArray(slots) || slots.length === 0 ||
      slots.some(s => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s?.selesai || ''))) return null
    return slots.reduce((end, slot) => slot.selesai > end ? slot.selesai : end, '')
  })
}

/** Existing five-minute cron; bounded, atomic and idempotent. No student/history scan. */
export async function autoReturnIzinKeluar(db: D1Database, now = new Date()) {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const today = local.toISOString().slice(0, 10)
  const tomorrow = new Date(local.getTime() + 86400000).toISOString().slice(0, 10)
  const pending = await db.prepare(`SELECT id FROM izin_keluar_komplek
    WHERE status = 'BELUM KEMBALI' AND waktu_keluar < ?
    ORDER BY waktu_keluar LIMIT 1`).bind(tomorrow).first()
  if (!pending) return { processed: 0 }

  const year = await db.prepare('SELECT jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ jam_pelajaran: string | null }>()
  const ends = endTimes(year?.jam_pelajaran ?? null)
  const todayEnd = ends[local.getUTCDay()]
  const cutoff = todayEnd && local.toISOString().slice(11, 16) >= todayEnd ? tomorrow : today
  const checkedAt = `${local.toISOString().slice(0, 23)}+07:00`

  // Date prefix matches existing permit/attendance readers, including legacy WIB timestamps.
  // Previous-day recovery uses that day's weekday pattern (23:59 if unavailable),
  // never today's date: an unclosed permit must not contaminate tomorrow's attendance.
  const result = await db.prepare(`WITH ends(weekday, end_time) AS (
      VALUES (0, ?), (1, ?), (2, ?), (3, ?), (4, ?), (5, ?), (6, ?)
    ), pending AS (
      SELECT id, waktu_keluar, COALESCE((SELECT end_time FROM ends
        WHERE weekday = CAST(strftime('%w', substr(waktu_keluar, 1, 10)) AS INTEGER)), '23:59') AS end_time
      FROM izin_keluar_komplek
      WHERE status = 'BELUM KEMBALI' AND waktu_keluar < ?
      ORDER BY waktu_keluar LIMIT ${BATCH_SIZE}
    )
    UPDATE izin_keluar_komplek SET status = 'SUDAH KEMBALI',
      waktu_kembali = COALESCE(waktu_kembali, (SELECT CASE
        WHEN substr(p.waktu_keluar, 12, 8) > p.end_time || ':00' THEN p.waktu_keluar
        ELSE substr(p.waktu_keluar, 1, 10) || 'T' || p.end_time || ':00.000+07:00' END
        FROM pending p WHERE p.id = izin_keluar_komplek.id)),
      updated_at = ?,
      keterangan = CASE WHEN COALESCE(keterangan, '') = '' THEN ? ELSE keterangan || char(10) || ? END
    WHERE status = 'BELUM KEMBALI' AND id IN (SELECT id FROM pending)`)
    .bind(...ends, cutoff, checkedAt, AUTO_NOTE, AUTO_NOTE).run()
  const processed = Number(result.meta.changes ?? 0)
  if (processed > 0) invalidateAttendanceCache()
  return { processed }
}
