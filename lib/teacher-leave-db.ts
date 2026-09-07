import type { TeacherLeaveMetadata, TeacherLeaveReason } from './teacher-leave'

export async function readTeacherLeaveReasons(db: D1Database): Promise<TeacherLeaveReason[]> {
  const rows = await db.prepare('SELECT id, nama, kepentingan_sekolah, aktif FROM alasan_izin_guru ORDER BY nama').all<{
    id: string; nama: string; kepentingan_sekolah: number; aktif: number
  }>()
  return (rows.results || []).map(row => ({ ...row, kepentingan_sekolah: row.kepentingan_sekolah === 1, aktif: row.aktif === 1 }))
}

export async function validateTeacherLeaveReason(db: D1Database, status: string, id?: string | null) {
  if (status !== 'IZIN') return null
  if (!id || !(await db.prepare('SELECT id FROM alasan_izin_guru WHERE id = ? AND aktif = 1').bind(id).first())) {
    throw new Error('Pilih alasan izin guru yang masih aktif.')
  }
  return id
}

// Bulk lookup keeps all consumers on the same agenda > delegation precedence.
// Inactive reasons remain valid for historical reads; only new selections require active reasons.
export async function enrichTeacherLeaveSessions<T extends { penugasan_id: string; tanggal: string; status: string }>(
  db: D1Database, sessions: T[]
): Promise<Array<T & TeacherLeaveMetadata>> {
  if (!sessions.length) return []
  const ids = [...new Set(sessions.filter(row => row.status === 'IZIN').map(row => row.penugasan_id))]
  const dates = sessions.map(row => row.tanggal).sort()
  const reasons = new Map((await readTeacherLeaveReasons(db)).map(row => [row.id, row]))
  const agenda = new Map<string, string | null>()
  const delegation = new Map<string, string | null>()
  for (let offset = 0; offset < ids.length; offset += 80) {
    const chunk = ids.slice(offset, offset + 80)
    const placeholders = chunk.map(() => '?').join(',')
    const [a, d] = await Promise.all([
      db.prepare(`SELECT penugasan_id, tanggal, alasan_izin_guru_id FROM agenda_guru
        WHERE penugasan_id IN (${placeholders}) AND tanggal BETWEEN ? AND ?`)
        .bind(...chunk, dates[0], dates[dates.length - 1]).all<{ penugasan_id: string; tanggal: string; alasan_izin_guru_id: string | null }>(),
      db.prepare(`SELECT dtk.penugasan_mengajar_id AS penugasan_id, dt.tanggal, dt.alasan_izin_guru_id
        FROM delegasi_tugas dt JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
        JOIN penugasan_mengajar pm ON pm.id = dtk.penugasan_mengajar_id AND pm.guru_id = dt.dari_user_id
        WHERE dtk.penugasan_mengajar_id IN (${placeholders}) AND dt.tanggal BETWEEN ? AND ?
        ORDER BY dt.created_at, dt.id`)
        .bind(...chunk, dates[0], dates[dates.length - 1]).all<{ penugasan_id: string; tanggal: string; alasan_izin_guru_id: string | null }>(),
    ])
    for (const row of a.results || []) agenda.set(`${row.penugasan_id}:${row.tanggal}`, row.alasan_izin_guru_id)
    for (const row of d.results || []) delegation.set(`${row.penugasan_id}:${row.tanggal}`, row.alasan_izin_guru_id)
  }
  return sessions.map(row => {
    const key = `${row.penugasan_id}:${row.tanggal}`
    const id = row.status === 'IZIN' ? agenda.get(key) || delegation.get(key) || null : null
    const reason = id ? reasons.get(id) : null
    return { ...row, alasan_izin_guru_id: id, alasan_izin_guru_nama: reason?.nama || null, kepentingan_sekolah: reason?.kepentingan_sekolah === true }
  })
}

export async function enrichTeacherDelegations<T extends { delegasi_id: string }>(db: D1Database, rows: T[]): Promise<Array<T & TeacherLeaveMetadata>> {
  if (!rows.length) return []
  const metadata = new Map<string, TeacherLeaveMetadata>()
  const ids = [...new Set(rows.map(row => row.delegasi_id))]
  for (let offset = 0; offset < ids.length; offset += 80) {
    const chunk = ids.slice(offset, offset + 80)
    const result = await db.prepare(`SELECT dt.id, dt.alasan_ketidakhadiran, r.id AS alasan_izin_guru_id,
      r.nama AS alasan_izin_guru_nama, r.kepentingan_sekolah
      FROM delegasi_tugas dt LEFT JOIN alasan_izin_guru r ON r.id = dt.alasan_izin_guru_id
      WHERE dt.id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all<{
        id: string; alasan_ketidakhadiran: string; alasan_izin_guru_id: string | null; alasan_izin_guru_nama: string | null; kepentingan_sekolah: number | null
      }>()
    for (const row of result.results || []) metadata.set(row.id, {
      alasan_izin_guru_id: row.alasan_izin_guru_id, alasan_izin_guru_nama: row.alasan_izin_guru_nama,
      kepentingan_sekolah: row.alasan_ketidakhadiran === 'IZIN' && row.kepentingan_sekolah === 1,
    })
  }
  return rows.map(row => ({ ...row, ...metadata.get(row.delegasi_id) }))
}
