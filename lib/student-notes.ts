import { getUserRoles } from '@/lib/features'
import { formatNamaKelas } from '@/lib/utils'
import { currentTimeWIB, nowWIB, todayWIB } from '@/lib/time'
import { getKalenderDateStatus } from '@/lib/kalender-pendidikan'
import type { PolaJam } from '@/app/dashboard/settings/types'
import {
  studentNoteCollator,
  type StudentNote,
  type StudentNoteAssignment,
  type StudentNoteClass,
  type StudentNoteStudent,
} from '@/lib/student-note-shared'
export type { StudentNote, StudentNoteAssignment, StudentNoteClass, StudentNoteStudent } from '@/lib/student-note-shared'

const GLOBAL_READER_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad']

export async function getStudentNoteContext(db: D1Database, userId: string) {
  const [roles, activeTa] = await Promise.all([
    getUserRoles(db, userId),
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
      .first<{ id: string; nama: string; semester: number }>(),
  ])
  return { roles, activeTa, isGlobalReader: roles.some(role => GLOBAL_READER_ROLES.includes(role)) }
}

export async function getStudentNoteAssignments(db: D1Database, userId: string): Promise<StudentNoteAssignment[]> {
  const rows = await db.prepare(`
    SELECT DISTINCT pm.id, pm.kelas_id, mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok
    FROM penugasan_mengajar pm
    JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id AND ta.is_active = 1
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    JOIN kelas k ON k.id = pm.kelas_id
    WHERE pm.guru_id = ?
       OR pm.id IN (
         SELECT DISTINCT jm.penugasan_id
         FROM jadwal_mengajar jm
         JOIN guru_ppl_mapping gpm ON gpm.jadwal_mengajar_id = jm.id
         WHERE gpm.guru_ppl_id = ?
       )
  `).bind(userId, userId).all<any>()

  return (rows.results || []).map(row => {
    const kelasLabel = formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok)
    return {
      id: row.id,
      kelas_id: row.kelas_id,
      kelas_label: kelasLabel,
      mapel_nama: row.nama_mapel,
      label: `${kelasLabel} · ${row.nama_mapel}`,
    }
  }).sort((a, b) =>
    studentNoteCollator.compare(a.kelas_label, b.kelas_label) ||
    studentNoteCollator.compare(a.mapel_nama, b.mapel_nama)
  )
}

export async function getCurrentStudentNoteAssignmentId(
  db: D1Database,
  userId: string,
  assignments: StudentNoteAssignment[],
): Promise<string | null> {
  if (assignments.length === 0) return null
  const now = nowWIB()
  const rawDay = now.getUTCDay()
  const hari = rawDay === 0 ? 7 : rawDay
  if (hari === 7) return null

  const calendarStatus = await getKalenderDateStatus(db, todayWIB())
  if (!calendarStatus.isEffective) return null

  const ta = await db.prepare(`
    SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1
  `).first<{ id: string; jam_pelajaran: string | null }>()
  if (!ta) return null

  let patterns: PolaJam[] = []
  try { patterns = JSON.parse(ta.jam_pelajaran || '[]') } catch { return null }
  const slots = patterns.find(pattern => pattern.hari.includes(hari))?.slots || []
  const currentTime = currentTimeWIB().hhmm
  const activeSlotIds = slots
    .filter(slot => currentTime >= slot.mulai && currentTime < slot.selesai)
    .map(slot => slot.id)
  if (activeSlotIds.length === 0) return null

  const assignmentIds = new Set(assignments.map(item => item.id))
  const slotPlaceholders = activeSlotIds.map(() => '?').join(',')
  const rows = await db.prepare(`
    SELECT DISTINCT jm.penugasan_id, jm.jam_ke
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
    JOIN kelas k ON k.id = pm.kelas_id
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND jm.jam_ke IN (${slotPlaceholders})
      AND (pm.guru_id = ? OR jm.id IN (
        SELECT jadwal_mengajar_id FROM guru_ppl_mapping WHERE guru_ppl_id = ?
      ))
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
    ORDER BY jm.jam_ke ASC
  `).bind(ta.id, hari, ...activeSlotIds, userId, userId, todayWIB()).all<{ penugasan_id: string; jam_ke: number }>()

  return (rows.results || []).find(row => assignmentIds.has(row.penugasan_id))?.penugasan_id || null
}

export async function getAccessibleStudentNoteClasses(
  db: D1Database,
  userId: string,
  roles?: string[],
): Promise<StudentNoteClass[]> {
  const resolvedRoles = roles ?? await getUserRoles(db, userId)
  const isGlobal = resolvedRoles.some(role => GLOBAL_READER_ROLES.includes(role))
  const sourceById = new Map<string, StudentNoteClass['source']>()

  if (isGlobal) {
    const all = await db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas').all<any>()
    return (all.results || []).map(row => ({
      id: row.id,
      label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
      source: 'global' as const,
    })).sort((a, b) => studentNoteCollator.compare(a.label, b.label))
  }

  const [teaching, wali, bk] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT pm.kelas_id AS id
      FROM penugasan_mengajar pm
      JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id AND ta.is_active = 1
      WHERE pm.guru_id = ? OR pm.id IN (
        SELECT DISTINCT jm.penugasan_id FROM jadwal_mengajar jm
        JOIN guru_ppl_mapping gpm ON gpm.jadwal_mengajar_id = jm.id
        WHERE gpm.guru_ppl_id = ?
      )
    `).bind(userId, userId).all<{ id: string }>(),
    db.prepare('SELECT id FROM kelas WHERE wali_kelas_id = ?').bind(userId).all<{ id: string }>(),
    db.prepare(`
      SELECT DISTINCT kb.kelas_id AS id FROM kelas_binaan_bk kb
      JOIN tahun_ajaran ta ON ta.id = kb.tahun_ajaran_id AND ta.is_active = 1
      WHERE kb.guru_bk_id = ?
    `).bind(userId).all<{ id: string }>(),
  ])
  for (const row of teaching.results || []) sourceById.set(row.id, 'mengajar')
  for (const row of wali.results || []) sourceById.set(row.id, 'wali')
  for (const row of bk.results || []) if (!sourceById.has(row.id)) sourceById.set(row.id, 'bk')
  if (sourceById.size === 0) return []

  const ids = Array.from(sourceById.keys())
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db.prepare(`
    SELECT id, tingkat, nomor_kelas, kelompok FROM kelas WHERE id IN (${placeholders})
  `).bind(...ids).all<any>()
  return (rows.results || []).map(row => ({
    id: row.id,
    label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
    source: sourceById.get(row.id) || 'mengajar',
  })).sort((a, b) => studentNoteCollator.compare(a.label, b.label))
}

export async function getStudentNoteStudents(db: D1Database, kelasId: string): Promise<StudentNoteStudent[]> {
  const rows = await db.prepare(`
    SELECT id, nama_lengkap, nisn, foto_url, kelas_id
    FROM siswa WHERE kelas_id = ? AND status = 'aktif'
  `).bind(kelasId).all<StudentNoteStudent>()
  return (rows.results || []).sort((a, b) => studentNoteCollator.compare(a.nama_lengkap, b.nama_lengkap))
}

export async function canReadStudentNotes(
  db: D1Database,
  userId: string,
  siswaId: string,
  roles?: string[],
): Promise<boolean> {
  const resolvedRoles = roles ?? await getUserRoles(db, userId)
  if (resolvedRoles.some(role => GLOBAL_READER_ROLES.includes(role))) return true

  const access = await db.prepare(`
    SELECT 1 AS allowed
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ? AND (
      EXISTS (SELECT 1 FROM catatan_siswa cs WHERE cs.siswa_id = s.id AND cs.pencatat_id = ?)
      OR k.wali_kelas_id = ?
      OR EXISTS (
        SELECT 1 FROM penugasan_mengajar pm
        JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id AND ta.is_active = 1
        WHERE pm.kelas_id = s.kelas_id AND (
          pm.guru_id = ? OR pm.id IN (
            SELECT DISTINCT jm.penugasan_id FROM jadwal_mengajar jm
            JOIN guru_ppl_mapping gpm ON gpm.jadwal_mengajar_id = jm.id
            WHERE gpm.guru_ppl_id = ?
          )
        )
      )
      OR EXISTS (
        SELECT 1 FROM kelas_binaan_bk kb
        JOIN tahun_ajaran ta_bk ON ta_bk.id = kb.tahun_ajaran_id AND ta_bk.is_active = 1
        WHERE kb.kelas_id = s.kelas_id AND kb.guru_bk_id = ?
      )
    ) LIMIT 1
  `).bind(siswaId, userId, userId, userId, userId, userId).first<{ allowed: number }>()
  return !!access
}

export async function getStudentNotes(
  db: D1Database,
  userId: string,
  siswaId: string,
  roles?: string[],
): Promise<StudentNote[]> {
  if (!(await canReadStudentNotes(db, userId, siswaId, roles))) return []
  const rows = await db.prepare(`
    SELECT cs.*, s.nama_lengkap AS siswa_nama, s.foto_url AS siswa_foto_url
    FROM catatan_siswa cs
    JOIN siswa s ON s.id = cs.siswa_id
    WHERE cs.siswa_id = ?
    ORDER BY cs.created_at DESC, cs.id DESC
  `).bind(siswaId).all<any>()
  return (rows.results || []).map(row => mapStudentNote(row, userId))
}

export async function getMyStudentNotes(db: D1Database, userId: string): Promise<StudentNote[]> {
  const rows = await db.prepare(`
    SELECT cs.*, s.nama_lengkap AS siswa_nama, s.foto_url AS siswa_foto_url
    FROM catatan_siswa cs
    JOIN siswa s ON s.id = cs.siswa_id
    WHERE cs.pencatat_id = ?
    ORDER BY cs.created_at DESC, cs.id DESC
    LIMIT 200
  `).bind(userId).all<any>()
  return (rows.results || []).map(row => mapStudentNote(row, userId))
}

function mapStudentNote(row: any, userId: string): StudentNote {
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    siswa_nama: row.siswa_nama,
    siswa_foto_url: row.siswa_foto_url || null,
    pencatat_id: row.pencatat_id || null,
    pencatat_nama: row.pencatat_nama_snapshot,
    penugasan_id: row.penugasan_id || null,
    kelas_nama: row.kelas_nama_snapshot,
    mapel_nama: row.mapel_nama_snapshot,
    tahun_ajaran_nama: row.tahun_ajaran_snapshot,
    isi: row.isi,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_owner: row.pencatat_id === userId,
  }
}

export async function getUnreadStudentNoteCountForWali(db: D1Database, userId: string, kelasId?: string) {
  const kelasFilter = kelasId ? 'AND k.id = ?' : ''
  const row = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM catatan_siswa cs
    JOIN siswa s ON s.id = cs.siswa_id AND s.status = 'aktif'
    JOIN kelas k ON k.id = s.kelas_id AND k.wali_kelas_id = ?
    LEFT JOIN catatan_siswa_read_state rs ON rs.user_id = ? AND rs.kelas_id = k.id
    WHERE cs.pencatat_id IS NOT ?
      AND cs.created_at > COALESCE(rs.last_read_at, '1970-01-01 00:00:00')
      ${kelasFilter}
  `).bind(userId, userId, userId, ...(kelasId ? [kelasId] : [])).first<{ total: number }>()
  return Number(row?.total || 0)
}
