import { formatNamaKelas } from '@/lib/utils'
import {
  findTeachingBlockException,
  getEffectiveDatesInRange,
  getKbmExceptionsForRange,
} from '@/lib/kalender-pendidikan'
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'

export type FinalAttendanceStatus =
  | 'HADIR'
  | 'SAKIT'
  | 'IZIN'
  | 'ALFA'
  | 'PARSIAL'
  | 'PERLU_KONFIRMASI_WALI'
  | 'BELUM_ADA_INPUT'
  | 'BELUM_ADA_DATA'

export type FinalAttendanceSource =
  | 'guru'
  | 'wali_kelas'
  | 'koreksi_wali_kelas'
  | 'perlu_konfirmasi_wali'
  | 'belum_ada_input'
  | 'belum_ada_data'

export type FinalAttendanceDetail = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  tanggal: string
  total_blok: number
  guru_status: FinalAttendanceStatus
  wali_status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA' | null
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
  kbm_nonaktif_mulai?: string | null
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

function deriveGuruStatus(
  totalBlok: number,
  submittedBlok: number,
  records: Array<{ status: string }>,
  skipIncompleteForDailyStatus: boolean
): FinalAttendanceStatus {
  if (totalBlok <= 0) {
    return records.length > 0 ? 'PERLU_KONFIRMASI_WALI' : 'BELUM_ADA_DATA'
  }

  if (submittedBlok < totalBlok && !skipIncompleteForDailyStatus) {
    return 'BELUM_ADA_DATA'
  }

  const effectiveBlok = skipIncompleteForDailyStatus ? Math.min(totalBlok, submittedBlok) : totalBlok
  if (effectiveBlok <= 0) return skipIncompleteForDailyStatus ? 'BELUM_ADA_INPUT' : 'BELUM_ADA_DATA'

  const uniqueStatuses = Array.from(new Set(records.map(record => record.status)))

  if (records.length === 0) {
    return 'HADIR'
  }

  if (records.length < effectiveBlok) {
    if (!uniqueStatuses.includes('ALFA')) return 'HADIR'
    return uniqueStatuses.length === 1 ? 'PARSIAL' : 'PERLU_KONFIRMASI_WALI'
  }

  if (uniqueStatuses.length === 1) {
    const [status] = uniqueStatuses
    if (status === 'SAKIT' || status === 'IZIN' || status === 'ALFA') {
      return status
    }
  }

  return 'PERLU_KONFIRMASI_WALI'
}

function deriveGuruStatusWithSession(
  totalBlok: number,
  records: Array<{ status: string }>,
  submittedBlok: number,
  skipIncompleteForDailyStatus: boolean
): FinalAttendanceStatus {
  if (totalBlok <= 0) return records.length > 0 ? 'PERLU_KONFIRMASI_WALI' : 'BELUM_ADA_DATA'
  return deriveGuruStatus(totalBlok, submittedBlok, records, skipIncompleteForDailyStatus)
}

function buildFinalStatus(guruStatus: FinalAttendanceStatus, waliStatus: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA' | null) {
  if (!waliStatus) {
    return {
      status_akhir: guruStatus,
      sumber_status: guruStatus === 'BELUM_ADA_INPUT'
        ? 'belum_ada_input' as const
        : guruStatus === 'BELUM_ADA_DATA'
          ? 'belum_ada_data' as const
          : guruStatus === 'PERLU_KONFIRMASI_WALI'
          ? 'perlu_konfirmasi_wali' as const
          : 'guru' as const,
    }
  }

  return {
    status_akhir: waliStatus,
    sumber_status: guruStatus === 'HADIR' || guruStatus === 'BELUM_ADA_DATA' || guruStatus === 'BELUM_ADA_INPUT'
      ? 'wali_kelas' as const
      : 'koreksi_wali_kelas' as const,
  }
}

function parseIzinJamPelajaran(raw: unknown): number[] {
  if (raw === null || raw === undefined || raw === '') return []
  if (typeof raw === 'number') return Number.isFinite(raw) ? [raw] : []
  const text = String(raw).trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    const n = Number(parsed)
    return Number.isFinite(n) ? [n] : []
  } catch {
    const n = Number(text)
    return Number.isFinite(n) ? [n] : []
  }
}

function parseTimeMinutes(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/^(?:\d{4}-\d{2}-\d{2}[T\s])?(\d{2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function parseDatePart(value: string | null | undefined) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null
}

function izinKeluarOverlapsBlock(row: { waktu_keluar: string; waktu_kembali?: string | null }, tanggal: string, blockStart: number | null, blockEnd: number | null) {
  if (blockStart === null || blockEnd === null) return false

  const keluarDate = parseDatePart(row.waktu_keluar)
  const kembaliDate = parseDatePart(row.waktu_kembali) || tanggal
  if (!keluarDate || keluarDate > tanggal || kembaliDate < tanggal) return false

  const keluarTime = keluarDate === tanggal ? parseTimeMinutes(row.waktu_keluar) ?? 0 : 0
  const kembaliTime = row.waktu_kembali && kembaliDate === tanggal ? parseTimeMinutes(row.waktu_kembali) ?? (24 * 60) : (24 * 60)

  return keluarTime < blockEnd && kembaliTime > blockStart
}

function formatIzinKeterangan(row: { alasan?: string | null; keterangan?: string | null; pelapor_nama?: string | null; jam_pelajaran?: unknown }) {
  const parts = ['Perizinan']
  if (row.pelapor_nama) parts.push(`oleh ${row.pelapor_nama}`)
  if (row.alasan) parts.push(`- ${row.alasan}`)
  const jam = parseIzinJamPelajaran(row.jam_pelajaran)
  if (jam.length > 0) parts.push(`(Jam ${jam.join(', ')})`)
  if (row.keterangan) parts.push(`: ${row.keterangan}`)
  return parts.join(' ')
}

function getSlotsHari(raw: string | null | undefined, hari: number): Array<{ id: number; mulai?: string; selesai?: string }> {
  try {
    const list = JSON.parse(raw || '[]')
    return list.find((p: any) => Array.isArray(p.hari) && p.hari.includes(hari))?.slots || []
  } catch {
    return []
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
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, k.kbm_nonaktif_mulai,
        u.nama_lengkap as wali_kelas_nama
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
    db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string; jam_pelajaran: string | null }>(),
  ])

  if (!kelas) {
    return null
  }

  const siswaList = siswaRes.results || []
  const dates = (await getEffectiveDatesInRange(db, startDate, endDate))
    .filter(tanggal => !kelas.kbm_nonaktif_mulai || kelas.kbm_nonaktif_mulai > tanggal)
  const skipIncompleteForDailyStatus = await getSystemSettingBoolean(
    SYSTEM_SETTING_KEYS.attendanceSkipIncompleteForDailyStatus,
    false
  )

  const [jadwalRes, absensiRes, waliRes, izinRes, izinKeluarRes, sesiRes] = await Promise.all([
    ta?.id
      ? db.prepare(`
          SELECT jm.hari, jm.jam_ke, jm.penugasan_id
          FROM jadwal_mengajar jm
          JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
          WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ?
        `).bind(kelasId, ta.id).all<{ hari: number; jam_ke: number; penugasan_id: string }>()
      : Promise.resolve({ results: [] as Array<{ hari: number; jam_ke: number; penugasan_id: string }> }),
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
      SELECT itk.tanggal, itk.siswa_id, itk.alasan, itk.keterangan, itk.jam_pelajaran,
        u.nama_lengkap as pelapor_nama
      FROM izin_tidak_masuk_kelas itk
      JOIN siswa s ON itk.siswa_id = s.id
      LEFT JOIN "user" u ON itk.diinput_oleh = u.id
      WHERE s.kelas_id = ? AND itk.tanggal BETWEEN ? AND ?
      ORDER BY itk.created_at ASC
    `).bind(kelasId, startDate, endDate).all<any>(),
    db.prepare(`
      SELECT ik.siswa_id, ik.keterangan, ik.waktu_keluar, ik.waktu_kembali,
        u.nama_lengkap as pelapor_nama
      FROM izin_keluar_komplek ik
      JOIN siswa s ON ik.siswa_id = s.id
      LEFT JOIN "user" u ON ik.diinput_oleh = u.id
      WHERE s.kelas_id = ?
        AND substr(ik.waktu_keluar, 1, 10) <= ?
        AND (ik.waktu_kembali IS NULL OR substr(ik.waktu_kembali, 1, 10) >= ?)
    `).bind(kelasId, startDate, endDate).all<any>(),
    db.prepare(`
      SELECT asg.tanggal, asg.penugasan_id
      FROM absensi_sesi_guru asg
      JOIN penugasan_mengajar pm ON asg.penugasan_id = pm.id
      WHERE pm.kelas_id = ? AND asg.tanggal BETWEEN ? AND ?
    `).bind(kelasId, startDate, endDate).all<any>(),
  ])

  const exceptionsByDate = new Map<string, Awaited<ReturnType<typeof getKbmExceptionsForRange>>>()
  for (const exception of await getKbmExceptionsForRange(db, startDate, endDate)) {
    if (!exceptionsByDate.has(exception.tanggal)) exceptionsByDate.set(exception.tanggal, [])
    exceptionsByDate.get(exception.tanggal)!.push(exception)
  }

  const jadwalByHari = new Map<number, Map<string, Set<number>>>()
  for (const row of jadwalRes.results || []) {
    if (!jadwalByHari.has(row.hari)) jadwalByHari.set(row.hari, new Map())
    const penMap = jadwalByHari.get(row.hari)!
    if (!penMap.has(row.penugasan_id)) penMap.set(row.penugasan_id, new Set())
    penMap.get(row.penugasan_id)!.add(Number(row.jam_ke))
  }

  const activeBlockCountForDate = (tanggal: string) => {
    const hari = hariNum(new Date(tanggal + 'T00:00:00'))
    return Array.from(jadwalByHari.get(hari)?.values() || []).filter(jamSet => {
      const jamList = Array.from(jamSet).sort((a, b) => a - b)
      return !findTeachingBlockException(
        exceptionsByDate.get(tanggal) || [],
        { id: kelas.id, tingkat: kelas.tingkat },
        jamList[0],
        jamList[jamList.length - 1]
      )
    }).length
  }
  const activeBlocksForDate = (tanggal: string) => {
    const hari = hariNum(new Date(tanggal + 'T00:00:00'))
    const slots = getSlotsHari(ta?.jam_pelajaran, hari)
    return Array.from(jadwalByHari.get(hari)?.entries() || [])
      .map(([penugasanId, jamSet]) => {
        const jamList = Array.from(jamSet).sort((a, b) => a - b)
        const jamKeMulai = jamList[0]
        const jamKeSelesai = jamList[jamList.length - 1]
        const startSlot = slots.find(slot => Number(slot.id) === jamKeMulai)
        const endSlot = slots.find(slot => Number(slot.id) === jamKeSelesai)
        return {
          penugasan_id: penugasanId,
          jam_ke_mulai: jamKeMulai,
          jam_ke_selesai: jamKeSelesai,
          block_start: parseTimeMinutes(startSlot?.mulai),
          block_end: parseTimeMinutes(endSlot?.selesai),
          is_exception: !!findTeachingBlockException(
            exceptionsByDate.get(tanggal) || [],
            { id: kelas.id, tingkat: kelas.tingkat },
            jamKeMulai,
            jamKeSelesai
          ),
        }
      })
      .filter(block => !block.is_exception)
  }
  const classDates = dates.filter(tanggal => activeBlockCountForDate(tanggal) > 0)

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

  const waliMap = new Map<string, { status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'; keterangan: string | null }>()
  for (const row of waliRes.results || []) {
    waliMap.set(`${row.siswa_id}__${row.tanggal}`, {
      status: row.status,
      keterangan: row.keterangan || null,
    })
  }

  const izinKelasMap = new Map<string, any[]>()
  for (const row of izinRes.results || []) {
    const key = `${row.siswa_id}__${row.tanggal}`
    if (!izinKelasMap.has(key)) izinKelasMap.set(key, [])
    izinKelasMap.get(key)!.push(row)
  }
  const izinKeluarMap = new Map<string, any[]>()
  for (const row of izinKeluarRes.results || []) {
    if (!izinKeluarMap.has(row.siswa_id)) izinKeluarMap.set(row.siswa_id, [])
    izinKeluarMap.get(row.siswa_id)!.push(row)
  }

  const statusByStudent = new Map<string, FinalAttendanceDetail[]>()
  for (const siswa of siswaList) {
    const perDay: FinalAttendanceDetail[] = []
    for (const tanggal of classDates) {
      const totalBlok = activeBlockCountForDate(tanggal)
      const baseGuruRecords = guruMap.get(`${siswa.id}__${tanggal}`) || []
      const waliRecord = waliMap.get(`${siswa.id}__${tanggal}`)
      const izinKelasRows = izinKelasMap.get(`${siswa.id}__${tanggal}`) || []
      const izinKeluarRows = izinKeluarMap.get(siswa.id) || []
      const izinBlocks = activeBlocksForDate(tanggal).flatMap(block => {
        const izinKelasForBlock = izinKelasRows.filter(row => {
          const jam = parseIzinJamPelajaran(row.jam_pelajaran)
          return jam.length === 0 || jam.some(j => j >= block.jam_ke_mulai && j <= block.jam_ke_selesai)
        })
        const izinKeluarForBlock = izinKeluarRows.filter(row =>
          izinKeluarOverlapsBlock(row, tanggal, block.block_start, block.block_end)
        )
        const notes = [
          ...izinKelasForBlock.map(row => formatIzinKeterangan(row)),
          ...izinKeluarForBlock.map(row => [
            'Perizinan keluar komplek',
            row.pelapor_nama ? `oleh ${row.pelapor_nama}` : '',
            row.keterangan ? `: ${row.keterangan}` : '',
          ].filter(Boolean).join(' ')),
        ]
        if (notes.length === 0) return []
        return [{
          status: 'IZIN',
          nama_mapel: 'Perizinan',
          jam_ke_mulai: block.jam_ke_mulai,
          jam_ke_selesai: block.jam_ke_selesai,
          catatan: notes.join('; '),
        }]
      })
      const guruRecords = [
        ...baseGuruRecords.filter(record => !izinBlocks.some(izin =>
          record.jam_ke_mulai <= izin.jam_ke_selesai && record.jam_ke_selesai >= izin.jam_ke_mulai
        )),
        ...izinBlocks,
      ].sort((a, b) => a.jam_ke_mulai - b.jam_ke_mulai)
      const submittedPenugasanCount = sesiMap.get(tanggal)?.size || 0
      const effectiveSubmittedCount = Math.max(submittedPenugasanCount, guruRecords.length)
      if (totalBlok <= 0 && guruRecords.length === 0 && !waliRecord) continue
      const guruStatus = deriveGuruStatusWithSession(
        totalBlok,
        guruRecords,
        effectiveSubmittedCount,
        skipIncompleteForDailyStatus
      )
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
    dates: classDates,
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
