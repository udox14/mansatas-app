import { formatNamaKelas } from '@/lib/utils'
import { getEffectiveDatesInRange } from '@/lib/kalender-pendidikan'

export type FinalAttendanceStatus =
  | 'HADIR'
  | 'SAKIT'
  | 'IZIN'
  | 'ALFA'
  | 'PARSIAL'
  | 'BELUM_ADA_DATA'

export type FinalAttendanceSource =
  | 'guru'
  | 'wali_kelas'
  | 'koreksi_wali_kelas'
  | 'belum_ada_data'

export type FinalAttendanceDetail = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  tanggal: string
  total_blok: number
  guru_status: FinalAttendanceStatus
  wali_status: 'SAKIT' | 'IZIN' | null
  status_akhir: FinalAttendanceStatus
  sumber_status: FinalAttendanceSource
  keterangan_wali_kelas: string | null
  detail_guru: Array<{
    status: string
    nama_mapel: string
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan: string
  }>
}

type StudentRow = {
  id: string
  nama_lengkap: string
  nisn: string
  foto_url: string | null
}

type ClassRow = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  wali_kelas_id?: string | null
  wali_kelas_nama?: string | null
}

function hariNum(date: Date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0]
}

function enumerateDates(startDate: string, endDate: string) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const dates: string[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    dates.push(toDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function deriveGuruStatus(totalBlok: number, records: Array<{ status: string }>): FinalAttendanceStatus {
  if (totalBlok <= 0) {
    return records.length > 0 ? 'PARSIAL' : 'BELUM_ADA_DATA'
  }

  if (records.length === 0) {
    return 'BELUM_ADA_DATA'
  }

  if (records.length < totalBlok) {
    return 'PARSIAL'
  }

  const uniqueStatuses = Array.from(new Set(records.map(record => record.status)))
  if (uniqueStatuses.length === 1) {
    const [status] = uniqueStatuses
    if (status === 'SAKIT' || status === 'IZIN' || status === 'ALFA') {
      return status
    }
  }

  return 'PARSIAL'
}

function deriveGuruStatusWithSession(
  totalBlok: number,
  records: Array<{ status: string }>,
  isSubmitted: boolean
): FinalAttendanceStatus {
  if (totalBlok <= 0) return records.length > 0 ? 'PARSIAL' : 'BELUM_ADA_DATA'
  if (records.length === 0) return isSubmitted ? 'HADIR' : 'BELUM_ADA_DATA'
  return deriveGuruStatus(totalBlok, records)
}

function buildFinalStatus(guruStatus: FinalAttendanceStatus, waliStatus: 'SAKIT' | 'IZIN' | null) {
  if (!waliStatus) {
    return {
      status_akhir: guruStatus,
      sumber_status: guruStatus === 'BELUM_ADA_DATA' ? 'belum_ada_data' as const : 'guru' as const,
    }
  }

  return {
    status_akhir: waliStatus,
    sumber_status: guruStatus === 'HADIR' || guruStatus === 'BELUM_ADA_DATA'
      ? 'wali_kelas' as const
      : 'koreksi_wali_kelas' as const,
  }
}

export async function getAccessibleWaliKelasClasses(db: D1Database, userId: string, roles: string[]) {
  const isAdmin = roles.some(role => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))
  const rows = isAdmin
    ? await db.prepare(`
        SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, u.nama_lengkap as wali_kelas_nama
        FROM kelas k
        LEFT JOIN "user" u ON k.wali_kelas_id = u.id
        ORDER BY k.tingkat, k.kelompok, CAST(k.nomor_kelas AS INTEGER)
      `).all<ClassRow>()
    : await db.prepare(`
        SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, u.nama_lengkap as wali_kelas_nama
        FROM kelas k
        LEFT JOIN "user" u ON k.wali_kelas_id = u.id
        WHERE k.wali_kelas_id = ?
        ORDER BY k.tingkat, k.kelompok, CAST(k.nomor_kelas AS INTEGER)
      `).bind(userId).all<ClassRow>()

  return (rows.results || []).map(row => ({
    ...row,
    label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
  }))
}

export async function getFinalAttendanceForClass(
  db: D1Database,
  kelasId: string,
  startDate: string,
  endDate: string
) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS absensi_sesi_guru (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      penugasan_id TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
      tanggal      TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      diinput_oleh TEXT NOT NULL REFERENCES "user"(id),
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(penugasan_id, tanggal)
    )
  `).run()

  const [kelas, siswaRes, ta] = await Promise.all([
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, u.nama_lengkap as wali_kelas_nama
      FROM kelas k
      LEFT JOIN "user" u ON k.wali_kelas_id = u.id
      WHERE k.id = ?
    `).bind(kelasId).first<ClassRow>(),
    db.prepare(`
      SELECT id, nama_lengkap, nisn, foto_url
      FROM siswa
      WHERE kelas_id = ? AND status = 'aktif'
      ORDER BY nama_lengkap
    `).bind(kelasId).all<StudentRow>(),
    db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>(),
  ])

  if (!kelas) {
    return null
  }

  const siswaList = siswaRes.results || []
  const dates = await getEffectiveDatesInRange(db, startDate, endDate)

  const [jadwalRes, absensiRes, waliRes, sesiRes] = await Promise.all([
    ta?.id
      ? db.prepare(`
          SELECT jm.hari, jm.penugasan_id
          FROM jadwal_mengajar jm
          JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
          WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ?
        `).bind(kelasId, ta.id).all<{ hari: number; penugasan_id: string }>()
      : Promise.resolve({ results: [] as Array<{ hari: number; penugasan_id: string }> }),
    db.prepare(`
      SELECT ab.tanggal, ab.siswa_id, ab.status, ab.catatan, ab.jam_ke_mulai, ab.jam_ke_selesai,
        mp.nama_mapel
      FROM absensi_siswa ab
      JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      WHERE pm.kelas_id = ? AND ab.tanggal BETWEEN ? AND ?
      ORDER BY ab.tanggal, ab.siswa_id, ab.jam_ke_mulai
    `).bind(kelasId, startDate, endDate).all<any>(),
    db.prepare(`
      SELECT kawk.tanggal, kawk.siswa_id, kawk.status, kawk.keterangan
      FROM keterangan_absensi_wali_kelas kawk
      JOIN siswa s ON kawk.siswa_id = s.id
      WHERE s.kelas_id = ? AND kawk.tanggal BETWEEN ? AND ?
    `).bind(kelasId, startDate, endDate).all<any>(),
    db.prepare(`
      SELECT asg.tanggal, asg.penugasan_id
      FROM absensi_sesi_guru asg
      JOIN penugasan_mengajar pm ON asg.penugasan_id = pm.id
      WHERE pm.kelas_id = ? AND asg.tanggal BETWEEN ? AND ?
    `).bind(kelasId, startDate, endDate).all<any>(),
  ])

  const totalBlokByHari = new Map<number, number>()
  const jadwalByHari = new Map<number, Set<string>>()
  for (const row of jadwalRes.results || []) {
    if (!jadwalByHari.has(row.hari)) jadwalByHari.set(row.hari, new Set())
    jadwalByHari.get(row.hari)!.add(row.penugasan_id)
  }
  for (const [hari, penugasanSet] of jadwalByHari.entries()) {
    totalBlokByHari.set(hari, penugasanSet.size)
  }

  const guruMap = new Map<string, Array<{
    status: string
    nama_mapel: string
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan: string
  }>>()
  for (const row of absensiRes.results || []) {
    const key = `${row.siswa_id}__${row.tanggal}`
    if (!guruMap.has(key)) guruMap.set(key, [])
    guruMap.get(key)!.push({
      status: row.status,
      nama_mapel: row.nama_mapel,
      jam_ke_mulai: row.jam_ke_mulai,
      jam_ke_selesai: row.jam_ke_selesai,
      catatan: row.catatan || '',
    })
  }

  const sesiMap = new Map<string, Set<string>>()
  for (const row of sesiRes.results || []) {
    if (!sesiMap.has(row.tanggal)) sesiMap.set(row.tanggal, new Set())
    sesiMap.get(row.tanggal)!.add(row.penugasan_id)
  }

  const waliMap = new Map<string, { status: 'SAKIT' | 'IZIN'; keterangan: string | null }>()
  for (const row of waliRes.results || []) {
    waliMap.set(`${row.siswa_id}__${row.tanggal}`, {
      status: row.status,
      keterangan: row.keterangan || null,
    })
  }

  const statusByStudent = new Map<string, FinalAttendanceDetail[]>()
  for (const siswa of siswaList) {
    const perDay: FinalAttendanceDetail[] = []
    for (const tanggal of dates) {
      const dateObj = new Date(tanggal + 'T00:00:00')
      const totalBlok = totalBlokByHari.get(hariNum(dateObj)) || 0
      const guruRecords = guruMap.get(`${siswa.id}__${tanggal}`) || []
      const waliRecord = waliMap.get(`${siswa.id}__${tanggal}`)
      const submittedPenugasanCount = sesiMap.get(tanggal)?.size || 0
      const isSubmitted = totalBlok > 0 && submittedPenugasanCount >= totalBlok
      const guruStatus = deriveGuruStatusWithSession(totalBlok, guruRecords, isSubmitted)
      const finalState = buildFinalStatus(guruStatus, waliRecord?.status ?? null)

      perDay.push({
        siswa_id: siswa.id,
        nama_lengkap: siswa.nama_lengkap,
        nisn: siswa.nisn,
        tanggal,
        total_blok: totalBlok,
        guru_status: guruStatus,
        wali_status: waliRecord?.status ?? null,
        status_akhir: finalState.status_akhir,
        sumber_status: finalState.sumber_status,
        keterangan_wali_kelas: waliRecord?.keterangan ?? null,
        detail_guru: guruRecords,
      })
    }
    statusByStudent.set(siswa.id, perDay)
  }

  return {
    kelas: {
      ...kelas,
      label: formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok),
    },
    dates,
    siswa: siswaList,
    statusByStudent,
  }
}

export async function getFinalAttendanceForStudent(
  db: D1Database,
  siswaId: string,
  startDate: string,
  endDate: string
) {
  const siswa = await db.prepare(`
    SELECT s.id, s.nama_lengkap, s.nisn, s.kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()

  if (!siswa?.kelas_id) {
    return null
  }

  const classData = await getFinalAttendanceForClass(db, siswa.kelas_id, startDate, endDate)
  if (!classData) {
    return null
  }

  return {
    siswa,
    kelas_label: formatNamaKelas(siswa.tingkat, siswa.nomor_kelas, siswa.kelompok),
    statuses: classData.statusByStudent.get(siswaId) || [],
  }
}
