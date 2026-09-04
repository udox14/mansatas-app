import 'server-only'
import { getKalenderDateStatus, getKbmExceptionsForDate, splitTeachingSlotsByExceptions } from './kalender-pendidikan'
import { enrichTeacherLeaveSessions } from './teacher-leave-db'

export async function getTeacherAgendaObligations(db: D1Database, tanggal: string, taId: string) {
  if (!(await getKalenderDateStatus(db, tanggal)).isEffective) return []
  const weekday = new Date(tanggal + 'T00:00:00').getDay() || 7
  const rows = await db.prepare(`SELECT pm.id AS penugasan_id, pm.guru_id, u.nama_lengkap,
    k.id AS kelas_id, k.tingkat, GROUP_CONCAT(jm.jam_ke) AS jam_list, ag.id AS agenda_id,
    COALESCE(ag.status, dt.alasan_ketidakhadiran, '') AS status
    FROM jadwal_mengajar jm JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
    JOIN kelas k ON k.id = pm.kelas_id JOIN "user" u ON u.id = pm.guru_id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = pm.id AND ag.tanggal = ?
    LEFT JOIN delegasi_tugas dt ON dt.id = (
      SELECT d.id FROM delegasi_tugas d JOIN delegasi_tugas_kelas dk ON dk.delegasi_id = d.id
      WHERE dk.penugasan_mengajar_id = pm.id AND d.dari_user_id = pm.guru_id AND d.tanggal = ?
      ORDER BY d.created_at DESC, d.id DESC LIMIT 1)
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
    GROUP BY pm.id`).bind(tanggal, tanggal, taId, weekday, tanggal).all<{
      penugasan_id: string; guru_id: string; nama_lengkap: string; kelas_id: string; tingkat: number;
      jam_list: string; agenda_id: string | null; status: string
    }>()
  const exceptions = await getKbmExceptionsForDate(db, tanggal)
  const active = (rows.results || []).filter(row => splitTeachingSlotsByExceptions(exceptions,
    { id: row.kelas_id, tingkat: row.tingkat }, row.jam_list.split(',').map(Number)).activeJamKe.length > 0)
  return enrichTeacherLeaveSessions(db, active.map(row => ({ ...row, tanggal })))
}
