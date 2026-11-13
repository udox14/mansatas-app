import { todayWIB } from './time'

export type TeacherLeavePeriod = {
  id: string
  guru_id: string
  mulai: string
  selesai: string
  catatan: string | null
  dibatalkan: number
  versi: number
}

async function readLeaveRows<T>(query: D1PreparedStatement): Promise<T[]> {
  try {
    return (await query.all<T>()).results || []
  } catch (error) {
    // Allows a rolling deployment where older databases have no leave data yet.
    if (/no such table: (?:\w+\.)?cuti_guru(?:\b|_)/i.test(String(error))) return []
    throw error
  }
}

export async function readTeacherPeriods(db: D1Database, mulai: string, selesai = mulai, guruId?: string) {
  return readLeaveRows<TeacherLeavePeriod & { pengganti_id: string | null; pengganti_nama: string | null }>(
    db.prepare(`SELECT c.*, u.id AS pengganti_id, u.nama_lengkap AS pengganti_nama
      FROM cuti_guru c LEFT JOIN cuti_guru_pengganti p ON p.cuti_id = c.id AND p.mulai <= ? AND p.selesai >= ?
      LEFT JOIN "user" u ON u.id = p.user_id AND COALESCE(u.banned, 0) = 0
      WHERE c.dibatalkan = 0 AND c.mulai <= ? AND c.selesai >= ? AND (? IS NULL OR c.guru_id = ?)`)
      .bind(mulai, mulai, selesai, mulai, guruId ?? null, guruId ?? null)
  )
}

export async function readAgendaReplacementActors(db: D1Database, start: string, end = start) {
  try {
    const result = await db.prepare(`SELECT a.id, u.nama_lengkap FROM agenda_guru a
      JOIN "user" u ON u.id = a.pengganti_cuti_user_id WHERE a.tanggal BETWEEN ? AND ?`)
      .bind(start, end).all<{ id: string; nama_lengkap: string }>()
    return new Map((result.results || []).map(row => [row.id, row.nama_lengkap]))
  } catch (error) {
    if (String(error).includes('no such column: a.pengganti_cuti_user_id')) return new Map<string, string>()
    throw error
  }
}

export async function readReplacementScopes(db: D1Database, actorId: string, date = todayWIB(), today = todayWIB()) {
  return readLeaveRows<{ guru_id: string; mulai: string; selesai: string }>(db.prepare(`
    SELECT c.guru_id, MAX(c.mulai, p.mulai) AS mulai, MIN(c.selesai, p.selesai) AS selesai
    FROM cuti_guru_pengganti p
    JOIN cuti_guru c ON c.id = p.cuti_id AND c.dibatalkan = 0
    JOIN "user" u ON u.id = p.user_id AND COALESCE(u.banned, 0) = 0
    WHERE p.user_id = ? AND ? BETWEEN MAX(c.mulai, p.mulai) AND MIN(c.selesai, p.selesai)
      AND ? BETWEEN MAX(c.mulai, p.mulai) AND MIN(c.selesai, p.selesai)
  `).bind(actorId, date, today))
}

export async function getReplacementSessionEnd(db: D1Database, actorId: string, date = todayWIB()) {
  const scopes = await readReplacementScopes(db, actorId, date, date)
  if (!scopes.length) return null
  const last = scopes.map(row => row.selesai).sort().at(-1)!
  return new Date(new Date(`${last}T00:00:00+07:00`).getTime() + 86_400_000).toISOString()
}

export async function canCoverWaliClass(db: D1Database, actorId: string, kelasId: string, date = todayWIB()) {
  const scopes = await readReplacementScopes(db, actorId, date)
  if (!scopes.length) return false
  const row = await db.prepare('SELECT wali_kelas_id FROM kelas WHERE id = ?')
    .bind(kelasId).first<{ wali_kelas_id: string | null }>()
  return scopes.some(scope => scope.guru_id === row?.wali_kelas_id)
}

export async function getActingWaliId(db: D1Database, waliId: string, date = todayWIB()) {
  const [period] = await readTeacherPeriods(db, date, date, waliId)
  return period?.pengganti_id || waliId
}
