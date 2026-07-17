'use server'

import { getEffectiveUser } from '@/lib/act-as'
import { formatNamaKelas } from '@/lib/utils'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'

export type TeacherAttendanceStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'

export type TeacherAttendanceAssignment = {
  id: string
  mapel_nama: string
  kelas_id: string
  kelas_label: string
  tahun_ajaran: string
  semester: number
}

export type TeacherAttendanceSession = {
  key: string
  penugasan_id: string
  tanggal: string
  mapel_nama: string
  kelas_label: string
  jam_ke_mulai: number | null
  jam_ke_selesai: number | null
  submitted_at: string
  submitted_by: string
  total_siswa: number
  hadir: number
  sakit: number
  izin: number
  alfa: number
}

export type TeacherAttendanceStudentRow = {
  key: string
  penugasan_id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string
  mapel_nama: string
  kelas_label: string
  total_sesi: number
  hadir: number
  sakit: number
  izin: number
  alfa: number
  kehadiran_persen: number
  sessions: Array<{
    session_key: string
    tanggal: string
    status: TeacherAttendanceStatus
    catatan: string
  }>
}

export type TeacherAttendanceReport = {
  error: string | null
  guru: { id: string; nama_lengkap: string } | null
  start_date: string
  end_date: string
  selected_penugasan_id: string | null
  assignments: TeacherAttendanceAssignment[]
  sessions: TeacherAttendanceSession[]
  rows: TeacherAttendanceStudentRow[]
  summary: {
    total_sesi: number
    total_data: number
    hadir: number
    sakit: number
    izin: number
    alfa: number
  }
}

type AssignmentRow = {
  id: string
  mapel_nama: string
  kelas_id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  tahun_ajaran: string
  semester: number
  is_active: number
}

function emptyReport(startDate: string, endDate: string, error: string | null = null): TeacherAttendanceReport {
  return {
    error,
    guru: null,
    start_date: startDate,
    end_date: endDate,
    selected_penugasan_id: null,
    assignments: [],
    sessions: [],
    rows: [],
    summary: { total_sesi: 0, total_data: 0, hadir: 0, sakit: 0, izin: 0, alfa: 0 },
  }
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function dayNumber(value: string) {
  const day = new Date(`${value}T00:00:00`).getDay()
  return day === 0 ? 7 : day
}

export async function getTeacherAttendanceReport(input: {
  startDate: string
  endDate: string
  penugasanId?: string | null
}): Promise<TeacherAttendanceReport> {
  const startDate = String(input.startDate || '')
  const endDate = String(input.endDate || '')
  const selectedPenugasanId = String(input.penugasanId || '').trim() || null

  const user = await getCurrentUser()
  if (!user) return emptyReport(startDate, endDate, 'Unauthorized')
  if (!validDate(startDate) || !validDate(endDate)) return emptyReport(startDate, endDate, 'Rentang tanggal tidak valid.')

  const startTime = new Date(`${startDate}T00:00:00`).getTime()
  const endTime = new Date(`${endDate}T00:00:00`).getTime()
  const rangeDays = Math.floor((endTime - startTime) / 86_400_000)
  if (rangeDays < 0) return emptyReport(startDate, endDate, 'Tanggal mulai harus sebelum tanggal selesai.')
  if (rangeDays > 366) return emptyReport(startDate, endDate, 'Rentang laporan maksimal 366 hari.')

  const db = await getDB()
  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const [guru, assignmentRes] = await Promise.all([
    db.prepare('SELECT id, nama_lengkap FROM "user" WHERE id = ? LIMIT 1')
      .bind(guruId).first<{ id: string; nama_lengkap: string }>(),
    db.prepare(`
      SELECT DISTINCT pm.id, mp.nama_mapel, k.id AS kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
        ta.nama AS tahun_ajaran, ta.semester, ta.is_active
      FROM penugasan_mengajar pm
      JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
      JOIN kelas k ON k.id = pm.kelas_id
      JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id
      WHERE pm.guru_id = ?
         OR EXISTS (
           SELECT 1
           FROM jadwal_mengajar jm_access
           JOIN guru_ppl_mapping gpm ON gpm.jadwal_mengajar_id = jm_access.id
           WHERE jm_access.penugasan_id = pm.id AND gpm.guru_ppl_id = ?
         )
      ORDER BY ta.is_active DESC, ta.nama DESC, ta.semester DESC, k.tingkat, k.kelompok,
        CAST(k.nomor_kelas AS INTEGER), mp.nama_mapel
    `).bind(guruId, guruId).all<AssignmentRow>(),
  ])

  const assignmentRaw = assignmentRes.results || []
  const assignments: TeacherAttendanceAssignment[] = assignmentRaw.map(row => ({
    id: row.id,
    mapel_nama: row.mapel_nama,
    kelas_id: row.kelas_id,
    kelas_label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
    tahun_ajaran: row.tahun_ajaran,
    semester: Number(row.semester),
  }))

  if (selectedPenugasanId && !assignments.some(item => item.id === selectedPenugasanId)) {
    return { ...emptyReport(startDate, endDate, 'Penugasan tidak ditemukan atau bukan milik guru ini.'), guru: guru || null, assignments }
  }

  const scopedAssignments = selectedPenugasanId
    ? assignmentRaw.filter(item => item.id === selectedPenugasanId)
    : assignmentRaw
  if (scopedAssignments.length === 0) {
    return {
      ...emptyReport(startDate, endDate),
      guru: guru || null,
      selected_penugasan_id: selectedPenugasanId,
      assignments,
    }
  }

  const assignmentIds = scopedAssignments.map(item => item.id)
  const assignmentPlaceholders = assignmentIds.map(() => '?').join(',')
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS absensi_sesi_siswa (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      penugasan_id TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      tanggal TEXT NOT NULL,
      jam_ke_mulai INTEGER NOT NULL,
      jam_ke_selesai INTEGER NOT NULL,
      jumlah_jam INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK(status IN ('HADIR','SAKIT','ALFA','IZIN')),
      catatan TEXT,
      diinput_oleh TEXT NOT NULL REFERENCES "user"(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(penugasan_id, siswa_id, tanggal)
    )
  `).run()
  const [sessionRes, attendanceRes, snapshotRes, scheduleRes] = await Promise.all([
    db.prepare(`
      SELECT asg.penugasan_id, asg.tanggal, asg.submitted_at, COALESCE(u.nama_lengkap, '-') AS submitted_by
      FROM absensi_sesi_guru asg
      LEFT JOIN "user" u ON u.id = asg.diinput_oleh
      WHERE asg.penugasan_id IN (${assignmentPlaceholders})
        AND asg.tanggal BETWEEN ? AND ?
      ORDER BY asg.tanggal ASC, asg.penugasan_id ASC
    `).bind(...assignmentIds, startDate, endDate).all<any>(),
    db.prepare(`
      SELECT ass.penugasan_id, ass.siswa_id, ass.tanggal, ass.status, ass.catatan,
        ass.jam_ke_mulai, ass.jam_ke_selesai, s.nama_lengkap, s.nisn
      FROM absensi_sesi_siswa ass
      JOIN siswa s ON s.id = ass.siswa_id
      WHERE ass.penugasan_id IN (${assignmentPlaceholders})
        AND ass.tanggal BETWEEN ? AND ?
      ORDER BY ass.tanggal, s.nama_lengkap
    `).bind(...assignmentIds, startDate, endDate).all<any>(),
    db.prepare(`
      SELECT ab.penugasan_id, ab.siswa_id, ab.tanggal, ab.status, ab.catatan,
        ab.jam_ke_mulai, ab.jam_ke_selesai, s.nama_lengkap, s.nisn
      FROM absensi_siswa ab
      JOIN siswa s ON s.id = ab.siswa_id
      WHERE ab.penugasan_id IN (${assignmentPlaceholders})
        AND ab.tanggal BETWEEN ? AND ?
      ORDER BY ab.tanggal, s.nama_lengkap
    `).bind(...assignmentIds, startDate, endDate).all<any>(),
    db.prepare(`
      SELECT penugasan_id, hari, MIN(jam_ke) AS jam_ke_mulai, MAX(jam_ke) AS jam_ke_selesai
      FROM jadwal_mengajar
      WHERE penugasan_id IN (${assignmentPlaceholders})
      GROUP BY penugasan_id, hari
    `).bind(...assignmentIds).all<any>(),
  ])

  const rawSessions = sessionRes.results || []
  const validSessionKeys = new Set(rawSessions.map((row: any) => `${row.penugasan_id}__${row.tanggal}`))
  const attendanceRows = (attendanceRes.results || []).filter((row: any) => validSessionKeys.has(`${row.penugasan_id}__${row.tanggal}`))
  const snapshotRows = (snapshotRes.results || []).filter((row: any) => validSessionKeys.has(`${row.penugasan_id}__${row.tanggal}`))
  const classIds = Array.from(new Set(scopedAssignments.map(item => item.kelas_id)))
  const classPlaceholders = classIds.map(() => '?').join(',')
  const rosterRes = classIds.length > 0
    ? await db.prepare(`
        SELECT id, nama_lengkap, nisn, kelas_id
        FROM siswa
        WHERE status = 'aktif' AND kelas_id IN (${classPlaceholders})
        ORDER BY nama_lengkap
      `).bind(...classIds).all<any>()
    : { results: [] as any[] }

  const assignmentMap = new Map(scopedAssignments.map(row => [row.id, {
    ...row,
    kelas_label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
  }]))
  const scheduleMap = new Map<string, { jam_ke_mulai: number; jam_ke_selesai: number }>()
  for (const row of scheduleRes.results || []) {
    scheduleMap.set(`${row.penugasan_id}__${row.hari}`, {
      jam_ke_mulai: Number(row.jam_ke_mulai),
      jam_ke_selesai: Number(row.jam_ke_selesai),
    })
  }

  const studentsByClass = new Map<string, Map<string, { id: string; nama_lengkap: string; nisn: string }>>()
  for (const row of rosterRes.results || []) {
    if (!studentsByClass.has(row.kelas_id)) studentsByClass.set(row.kelas_id, new Map())
    studentsByClass.get(row.kelas_id)!.set(row.id, row)
  }
  for (const row of [...attendanceRows, ...snapshotRows]) {
    const assignment = assignmentMap.get(row.penugasan_id)
    if (!assignment) continue
    if (!studentsByClass.has(assignment.kelas_id)) studentsByClass.set(assignment.kelas_id, new Map())
    studentsByClass.get(assignment.kelas_id)!.set(row.siswa_id, {
      id: row.siswa_id,
      nama_lengkap: row.nama_lengkap,
      nisn: row.nisn,
    })
  }

  const attendanceMap = new Map<string, { status: TeacherAttendanceStatus; catatan: string; jam_ke_mulai: number; jam_ke_selesai: number }>()
  // Data sparse lama menjadi fallback. Snapshot lengkap sesi baru menimpanya bila tersedia.
  for (const row of [...attendanceRows, ...snapshotRows]) {
    attendanceMap.set(`${row.penugasan_id}__${row.tanggal}__${row.siswa_id}`, {
      status: row.status,
      catatan: row.catatan || '',
      jam_ke_mulai: Number(row.jam_ke_mulai),
      jam_ke_selesai: Number(row.jam_ke_selesai),
    })
  }

  const snapshotStudentsBySession = new Map<string, Set<string>>()
  for (const row of snapshotRows) {
    const key = `${row.penugasan_id}__${row.tanggal}`
    if (!snapshotStudentsBySession.has(key)) snapshotStudentsBySession.set(key, new Set())
    snapshotStudentsBySession.get(key)!.add(row.siswa_id)
  }

  const sessions: TeacherAttendanceSession[] = []
  const sessionStudentIds = new Map<string, Set<string>>()
  for (const raw of rawSessions) {
    const assignment = assignmentMap.get(raw.penugasan_id)
    if (!assignment) continue
    const sessionKey = `${raw.penugasan_id}__${raw.tanggal}`
    const classRoster = Array.from(studentsByClass.get(assignment.kelas_id)?.values() || [])
    const snapshotIds = snapshotStudentsBySession.get(sessionKey)
    const roster = snapshotIds
      ? classRoster.filter(siswa => snapshotIds.has(siswa.id))
      : classRoster
    sessionStudentIds.set(sessionKey, new Set(roster.map(siswa => siswa.id)))
    const schedule = scheduleMap.get(`${raw.penugasan_id}__${dayNumber(raw.tanggal)}`)
    const counts = { hadir: 0, sakit: 0, izin: 0, alfa: 0 }
    let jamMulai = schedule?.jam_ke_mulai ?? null
    let jamSelesai = schedule?.jam_ke_selesai ?? null

    for (const siswa of roster) {
      const attendance = attendanceMap.get(`${sessionKey}__${siswa.id}`)
      const status = attendance?.status || 'HADIR'
      if (attendance) {
        jamMulai = attendance.jam_ke_mulai
        jamSelesai = attendance.jam_ke_selesai
      }
      if (status === 'SAKIT') counts.sakit++
      else if (status === 'IZIN') counts.izin++
      else if (status === 'ALFA') counts.alfa++
      else counts.hadir++
    }

    sessions.push({
      key: sessionKey,
      penugasan_id: raw.penugasan_id,
      tanggal: raw.tanggal,
      mapel_nama: assignment.mapel_nama,
      kelas_label: assignment.kelas_label,
      jam_ke_mulai: jamMulai,
      jam_ke_selesai: jamSelesai,
      submitted_at: raw.submitted_at,
      submitted_by: raw.submitted_by,
      total_siswa: roster.length,
      ...counts,
    })
  }

  const sessionsByAssignment = new Map<string, TeacherAttendanceSession[]>()
  for (const session of sessions) {
    if (!sessionsByAssignment.has(session.penugasan_id)) sessionsByAssignment.set(session.penugasan_id, [])
    sessionsByAssignment.get(session.penugasan_id)!.push(session)
  }

  const rows: TeacherAttendanceStudentRow[] = []
  for (const assignment of scopedAssignments) {
    const assignmentSessions = sessionsByAssignment.get(assignment.id) || []
    if (assignmentSessions.length === 0) continue
    const roster = Array.from(studentsByClass.get(assignment.kelas_id)?.values() || [])
      .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
    for (const siswa of roster) {
      const counts = { hadir: 0, sakit: 0, izin: 0, alfa: 0 }
      const eligibleSessions = assignmentSessions.filter(session => sessionStudentIds.get(session.key)?.has(siswa.id))
      if (eligibleSessions.length === 0) continue
      const studentSessions = eligibleSessions.map(session => {
        const attendance = attendanceMap.get(`${session.key}__${siswa.id}`)
        const status: TeacherAttendanceStatus = attendance?.status || 'HADIR'
        if (status === 'SAKIT') counts.sakit++
        else if (status === 'IZIN') counts.izin++
        else if (status === 'ALFA') counts.alfa++
        else counts.hadir++
        return {
          session_key: session.key,
          tanggal: session.tanggal,
          status,
          catatan: attendance?.catatan || '',
        }
      })
      rows.push({
        key: `${assignment.id}__${siswa.id}`,
        penugasan_id: assignment.id,
        siswa_id: siswa.id,
        nama_lengkap: siswa.nama_lengkap,
        nisn: siswa.nisn,
        mapel_nama: assignment.mapel_nama,
        kelas_label: formatNamaKelas(assignment.tingkat, assignment.nomor_kelas, assignment.kelompok),
        total_sesi: eligibleSessions.length,
        ...counts,
        kehadiran_persen: Math.round((counts.hadir / eligibleSessions.length) * 1000) / 10,
        sessions: studentSessions,
      })
    }
  }

  const summary = rows.reduce((acc, row) => {
    acc.hadir += row.hadir
    acc.sakit += row.sakit
    acc.izin += row.izin
    acc.alfa += row.alfa
    return acc
  }, {
    total_sesi: sessions.length,
    total_data: rows.reduce((total, row) => total + row.total_sesi, 0),
    hadir: 0,
    sakit: 0,
    izin: 0,
    alfa: 0,
  })

  return {
    error: null,
    guru: guru || null,
    start_date: startDate,
    end_date: endDate,
    selected_penugasan_id: selectedPenugasanId,
    assignments,
    sessions,
    rows,
    summary,
  }
}
