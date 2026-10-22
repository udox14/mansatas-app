import { formatNamaKelas } from '@/lib/utils'
import {
  getEffectiveDatesInRange,
  getKbmExceptionsForRange,
  splitTeachingSlotsByExceptions,
} from '@/lib/kalender-pendidikan'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { getMemCache, setMemCache } from '@/utils/mem-cache'
import {
  deriveDailyTeacherStatus,
  dailyAttendanceClock,
  normalizeDailyTeacherBlockStatus,
  resolveFinalAttendanceStatus,
  studentPermissionStatusFromReason,
  type FinalAttendanceSource,
  type FinalAttendanceStatus,
  type StudentPermissionStatus,
  type SubmittedBlockStatus,
} from '@/lib/attendance-status'

export type { FinalAttendanceSource, FinalAttendanceStatus } from '@/lib/attendance-status'

export type FinalAttendanceDetail = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  tanggal: string
  is_daily_final: boolean
  kbm_end_at: string | null
  total_blok: number
  submitted_blok: number
  pending_blok: number
  guru_status: FinalAttendanceStatus
  guru_status_reason: string
  wali_status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA' | null
  status_akhir: FinalAttendanceStatus
  sumber_status: FinalAttendanceSource
  status_reason: string
  requires_wali_decision: boolean
  keterangan_wali_kelas: string | null
  block_statuses: Array<{
    penugasan_id: string
    status: SubmittedBlockStatus | 'BELUM_ADA_INPUT'
    submitted: boolean
    jam_ke_mulai: number
    jam_ke_selesai: number
  }>
  detail_guru: Array<{
    status: string
    nama_mapel: string
    guru_nama: string | null
    sumber: 'guru' | 'perizinan_siswa'
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan: string
  }>
}

type StudentRow = {
  id: string
  nama_lengkap: string
  nisn: string
  nis_lokal?: string | null
  jenis_kelamin?: 'L' | 'P' | string | null
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

export type FinalAttendanceClassData = {
  kelas: ClassRow & { label: string }
  dates: string[]
  siswa: StudentRow[]
  statusByStudent: Map<string, FinalAttendanceDetail[]>
}

export type SchoolAttendanceEstimate = {
  total_siswa: number
  tidak_masuk: number
  hadir_estimasi: number
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
  endDate: string,
  options?: { tahunAjaranId?: string; siswaId?: string; siswaIds?: string[]; fresh?: boolean; historicalStudentId?: string }
): Promise<FinalAttendanceClassData | null> {
  // Include the clock minute: cached temporary results must expire at the KBM boundary.
  // Official history reports supply a class/semester context independently of
  // the student's current class or active status. Live callers keep their roster.
  const historicalStudentId = options?.historicalStudentId
  if (historicalStudentId && !options?.tahunAjaranId) throw new Error('Historical attendance requires a semester')
  const selectedIds = historicalStudentId ? [historicalStudentId] : options?.siswaId ? [options.siswaId] : options?.siswaIds
  const currentClassSql = historicalStudentId ? '1 = 1' : 's.kelas_id = ?'
  const currentClassBinds = historicalStudentId ? [] : [kelasId]
  if (selectedIds?.length === 0) return null
  const studentSql = (column: string) => selectedIds ? ` AND ${column} IN (${selectedIds.map(() => '?').join(',')})` : ''
  const now = new Date()
  const cacheKey = `final-att:v4:${Math.floor(now.getTime() / 60_000)}:${kelasId}:${startDate}:${endDate}:${options?.tahunAjaranId ?? ''}:${selectedIds?.join(',') ?? ''}:${historicalStudentId ? 'history' : 'live'}`
  const cached = getMemCache<FinalAttendanceClassData>(cacheKey)
  if (cached && !options?.fresh) return cached

  await ensureSchemaOnce('absensi-sesi-guru', () => db.prepare(`
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
  `).run())

  const [kelas, siswaRes, ta] = await Promise.all([
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, k.kbm_nonaktif_mulai,
        u.nama_lengkap as wali_kelas_nama
      FROM kelas k
      LEFT JOIN "user" u ON k.wali_kelas_id = u.id
      WHERE k.id = ?
    `).bind(kelasId).first<ClassRow>(),
    db.prepare(`SELECT id, nama_lengkap, nisn, nis_lokal, jenis_kelamin, foto_url
      FROM siswa WHERE ${historicalStudentId ? '1 = 1' : "kelas_id = ? AND status = 'aktif'"} ${studentSql('id')}
      ORDER BY nama_lengkap`).bind(...currentClassBinds, ...(selectedIds || [])).all<StudentRow>(),
    options?.tahunAjaranId
      ? db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE id = ? LIMIT 1').bind(options.tahunAjaranId).first<{ id: string; jam_pelajaran: string | null }>()
      : db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string; jam_pelajaran: string | null }>(),
  ])

  if (!kelas) {
    return null
  }

  const siswaList = siswaRes.results || []
  const dates = (await getEffectiveDatesInRange(db, startDate, endDate, {
    kelasId: kelas.id,
    tingkat: Number(kelas.tingkat),
  }))
    .filter(tanggal => !kelas.kbm_nonaktif_mulai || kelas.kbm_nonaktif_mulai > tanggal)

  const [jadwalRes, absensiRes, waliRes, izinRes, izinKeluarRes, sesiRes] = await Promise.all([
    ta?.id
      ? db.prepare(`
          SELECT jm.hari, jm.jam_ke, jm.penugasan_id,
            COALESCE(mp.nama_mapel, 'Mata pelajaran') as nama_mapel,
            assignment_user.nama_lengkap as assignment_guru_nama
          FROM penugasan_mengajar pm
          CROSS JOIN jadwal_mengajar jm ON jm.penugasan_id = pm.id
          LEFT JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
          LEFT JOIN "user" assignment_user ON pm.guru_id = assignment_user.id
          WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ?
        `).bind(kelasId, ta.id).all<{
          hari: number
          jam_ke: number
          penugasan_id: string
          nama_mapel: string
          assignment_guru_nama: string | null
        }>()
      : Promise.resolve({ results: [] as Array<{
        hari: number
        jam_ke: number
        penugasan_id: string
        nama_mapel: string
        assignment_guru_nama: string | null
      }> }),
    db.prepare(`
      SELECT ab.tanggal, ab.siswa_id, ab.penugasan_id, ab.status, ab.catatan, ab.jam_ke_mulai, ab.jam_ke_selesai,
        mp.nama_mapel, input_user.nama_lengkap as guru_nama
      FROM penugasan_mengajar pm
      CROSS JOIN absensi_siswa ab ON ab.penugasan_id = pm.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      LEFT JOIN "user" input_user ON ab.diinput_oleh = input_user.id
      WHERE pm.kelas_id = ? AND ab.tanggal BETWEEN ? AND ? ${studentSql('ab.siswa_id')}
      ORDER BY ab.tanggal, ab.siswa_id, ab.jam_ke_mulai
    `).bind(kelasId, startDate, endDate, ...(selectedIds || [])).all<any>(),
    db.prepare(`
      SELECT kawk.tanggal, kawk.siswa_id, kawk.status, kawk.keterangan
      FROM siswa s
      CROSS JOIN keterangan_absensi_wali_kelas kawk ON kawk.siswa_id = s.id
      WHERE ${currentClassSql} AND kawk.tanggal BETWEEN ? AND ? ${studentSql('kawk.siswa_id')}
    `).bind(...currentClassBinds, startDate, endDate, ...(selectedIds || [])).all<any>(),
    db.prepare(`
      SELECT itk.tanggal, itk.siswa_id, itk.alasan, itk.keterangan, itk.jam_pelajaran,
        COALESCE(aik.hitung_sebagai_hadir, 0) as hitung_sebagai_hadir,
        u.nama_lengkap as pelapor_nama
      FROM siswa s
      CROSS JOIN izin_tidak_masuk_kelas itk ON itk.siswa_id = s.id
      LEFT JOIN alasan_izin_kelas aik ON aik.alasan = itk.alasan
      LEFT JOIN "user" u ON itk.diinput_oleh = u.id
      WHERE ${currentClassSql} AND itk.tanggal BETWEEN ? AND ? ${studentSql('itk.siswa_id')}
      ORDER BY itk.created_at ASC
    `).bind(...currentClassBinds, startDate, endDate, ...(selectedIds || [])).all<any>(),
    db.prepare(`
      SELECT ik.siswa_id, ik.keterangan, ik.waktu_keluar, ik.waktu_kembali,
        u.nama_lengkap as pelapor_nama
      FROM izin_keluar_komplek ik
      JOIN siswa s ON ik.siswa_id = s.id
      LEFT JOIN "user" u ON ik.diinput_oleh = u.id
      WHERE ${currentClassSql}
        AND substr(ik.waktu_keluar, 1, 10) <= ?
        AND (ik.waktu_kembali IS NULL OR substr(ik.waktu_kembali, 1, 10) >= ?)
        ${studentSql('ik.siswa_id')}
    `).bind(...currentClassBinds, startDate, endDate, ...(selectedIds || [])).all<any>(),
    db.prepare(`
      SELECT asg.tanggal, asg.penugasan_id, asg.diinput_oleh, input_user.nama_lengkap as guru_nama
      FROM penugasan_mengajar pm
      CROSS JOIN absensi_sesi_guru asg ON asg.penugasan_id = pm.id
      LEFT JOIN "user" input_user ON asg.diinput_oleh = input_user.id
      WHERE pm.kelas_id = ? AND asg.tanggal BETWEEN ? AND ?
    `).bind(kelasId, startDate, endDate).all<any>(),
  ])

  const exceptionsByDate = new Map<string, Awaited<ReturnType<typeof getKbmExceptionsForRange>>>()
  for (const exception of await getKbmExceptionsForRange(db, startDate, endDate)) {
    if (!exceptionsByDate.has(exception.tanggal)) exceptionsByDate.set(exception.tanggal, [])
    exceptionsByDate.get(exception.tanggal)!.push(exception)
  }

  const jadwalByHari = new Map<number, Map<string, Set<number>>>()
  const assignmentMetaById = new Map<string, { nama_mapel: string; guru_nama: string | null }>()
  for (const row of jadwalRes.results || []) {
    assignmentMetaById.set(row.penugasan_id, {
      nama_mapel: row.nama_mapel,
      guru_nama: row.assignment_guru_nama || null,
    })
    if (!jadwalByHari.has(row.hari)) jadwalByHari.set(row.hari, new Map())
    const penMap = jadwalByHari.get(row.hari)!
    if (!penMap.has(row.penugasan_id)) penMap.set(row.penugasan_id, new Set())
    penMap.get(row.penugasan_id)!.add(Number(row.jam_ke))
  }

  // Hoisting: blok mengajar efektif per tanggal hanya fungsi dari TANGGAL
  // (jadwal + pengecualian KBM), bukan dari siswa. Dulu dihitung ulang per
  // siswa per hari (O(siswa×tanggal) kali splitTeachingSlotsByExceptions +
  // sort). Sekarang dihitung sekali per tanggal dan dipakai bersama.
  type ClassDayBlocks = {
    totalBlok: number
    clock: ReturnType<typeof dailyAttendanceClock>
    blocks: Array<{
      penugasan_id: string
      jam_ke: number[]
      jam_ke_mulai: number
      jam_ke_selesai: number
      block_start: number | null
      block_end: number | null
      nama_mapel: string
      assignment_guru_nama: string | null
    }>
  }
  const blocksByDate = new Map<string, ClassDayBlocks>()
  for (const tanggal of dates) {
    const hari = hariNum(new Date(tanggal + 'T00:00:00'))
    const slots = getSlotsHari(ta?.jam_pelajaran, hari)
    const exceptions = exceptionsByDate.get(tanggal) || []
    const rawBlocks = Array.from(jadwalByHari.get(hari)?.entries() || [])
      .map(([penugasanId, jamSet]) => {
        const jamList = Array.from(jamSet).sort((a, b) => a - b)
        const slotState = splitTeachingSlotsByExceptions(
          exceptions,
          { id: kelas.id, tingkat: kelas.tingkat },
          jamList
        )
        const jamKeMulai = slotState.activeJamKe[0]
        const jamKeSelesai = slotState.activeJamKe[slotState.activeJamKe.length - 1]
        const startSlot = slots.find(slot => Number(slot.id) === jamKeMulai)
        const endSlot = slots.find(slot => Number(slot.id) === jamKeSelesai)
        const assignmentMeta = assignmentMetaById.get(penugasanId)
        return {
          penugasan_id: penugasanId,
          jam_ke: slotState.activeJamKe,
          jam_ke_mulai: jamKeMulai,
          jam_ke_selesai: jamKeSelesai,
          block_start: parseTimeMinutes(startSlot?.mulai),
          block_end: parseTimeMinutes(endSlot?.selesai),
          nama_mapel: assignmentMeta?.nama_mapel || 'Mata pelajaran',
          assignment_guru_nama: assignmentMeta?.guru_nama || null,
        }
      })
      .filter(block => block.jam_ke.length > 0)
    const lastBlock = [...rawBlocks].sort((a, b) => b.jam_ke_selesai - a.jam_ke_selesai)[0]
    const endMinutes = lastBlock?.block_end
    const endTime = endMinutes === null || endMinutes === undefined ? null
      : `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    blocksByDate.set(tanggal, {
      totalBlok: rawBlocks.length, blocks: rawBlocks,
      clock: dailyAttendanceClock(tanggal, endTime, now),
    })
  }
  const classDates = dates.filter(tanggal => (blocksByDate.get(tanggal)!.totalBlok) > 0)

  const guruMap = new Map<string, Array<{
    penugasan_id: string
    status: string
    nama_mapel: string
    guru_nama: string | null
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan: string
  }>>()
  for (const row of absensiRes.results || []) {
    const key = `${row.siswa_id}__${row.tanggal}`
    if (!guruMap.has(key)) guruMap.set(key, [])
    guruMap.get(key)!.push({
      penugasan_id: row.penugasan_id,
      status: row.status,
      nama_mapel: row.nama_mapel,
      guru_nama: row.guru_nama || null,
      jam_ke_mulai: row.jam_ke_mulai,
      jam_ke_selesai: row.jam_ke_selesai,
      catatan: row.catatan || '',
    })
  }

  const sesiMap = new Map<string, { guru_nama: string | null }>()
  for (const row of sesiRes.results || []) {
    sesiMap.set(`${row.tanggal}__${row.penugasan_id}`, {
      guru_nama: row.guru_nama || null,
    })
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
      const dayBlocks = blocksByDate.get(tanggal)!
      const totalBlok = dayBlocks.totalBlok
      const baseGuruRecords = guruMap.get(`${siswa.id}__${tanggal}`) || []
      const waliRecord = waliMap.get(`${siswa.id}__${tanggal}`)
      const izinKelasRows = izinKelasMap.get(`${siswa.id}__${tanggal}`) || []
      const izinKeluarRows = izinKeluarMap.get(siswa.id) || []
      const activeBlocks = dayBlocks.blocks
      const hasAnyPermissionSource = izinKelasRows.length > 0 || izinKeluarRows.some(row =>
        activeBlocks.some(block => izinKeluarOverlapsBlock(row, tanggal, block.block_start, block.block_end))
      )
      const hasAnyNonHadirTeacherRecord = baseGuruRecords.some(record => record.status !== 'HADIR')
      const showSubmittedHadirTeacherDetails = hasAnyPermissionSource || hasAnyNonHadirTeacherRecord
      const detailGuru: FinalAttendanceDetail['detail_guru'] = []
      const permissionBlockIds = new Set<string>()
      const permissionBlockStatusById = new Map<string, StudentPermissionStatus>()
      const blockStatuses: FinalAttendanceDetail['block_statuses'] = activeBlocks.map(block => {
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
            row.keterangan ? `: ${row.keterangan}` : '',
          ].filter(Boolean).join(' ')),
        ]
        const permissionNames = Array.from(new Set([
          ...izinKelasForBlock.map(row => row.pelapor_nama),
          ...izinKeluarForBlock.map(row => row.pelapor_nama),
        ].map(name => String(name || '').trim()).filter(Boolean)))
        const permissionStatus: StudentPermissionStatus = izinKelasForBlock.some(row =>
          studentPermissionStatusFromReason(row.alasan) === 'SAKIT'
        )
          ? 'SAKIT'
          : 'IZIN'
        const permissionDetail = notes.length > 0 ? {
          status: permissionStatus,
          nama_mapel: 'Perizinan',
          guru_nama: permissionNames.length > 0 ? permissionNames.join(', ') : null,
          sumber: 'perizinan_siswa' as const,
          jam_ke_mulai: block.jam_ke_mulai,
          jam_ke_selesai: block.jam_ke_selesai,
          catatan: notes.join('; '),
        } : null
        if (permissionDetail) {
          permissionBlockIds.add(block.penugasan_id)
          permissionBlockStatusById.set(block.penugasan_id, permissionStatus)
        }
        const rawRecord = baseGuruRecords.find(record =>
          record.penugasan_id === block.penugasan_id &&
          record.jam_ke_mulai <= block.jam_ke_selesai &&
          record.jam_ke_selesai >= block.jam_ke_mulai
        )
        const sessionInfo = sesiMap.get(`${tanggal}__${block.penugasan_id}`)
        const submitted = Boolean(permissionDetail || rawRecord || sessionInfo)
        const teacherStatus: SubmittedBlockStatus | 'BELUM_ADA_INPUT' = rawRecord && ['HADIR', 'SAKIT', 'IZIN', 'ALFA'].includes(rawRecord.status)
          ? rawRecord.status as SubmittedBlockStatus
          : sessionInfo
            ? 'HADIR'
            : 'BELUM_ADA_INPUT'
        const teacherDetail = (rawRecord || (sessionInfo && showSubmittedHadirTeacherDetails)) ? {
          status: teacherStatus,
          nama_mapel: rawRecord?.nama_mapel || block.nama_mapel,
          guru_nama: rawRecord?.guru_nama || sessionInfo?.guru_nama || block.assignment_guru_nama || null,
          sumber: 'guru' as const,
          jam_ke_mulai: rawRecord?.jam_ke_mulai ?? block.jam_ke_mulai,
          jam_ke_selesai: rawRecord?.jam_ke_selesai ?? block.jam_ke_selesai,
          catatan: rawRecord?.catatan || '',
        } : null
        if (permissionDetail) detailGuru.push(permissionDetail)
        if (teacherDetail) detailGuru.push(teacherDetail)

        const status = permissionDetail
          ? permissionStatus
          : teacherStatus

        return {
          penugasan_id: block.penugasan_id,
          status,
          submitted,
          jam_ke_mulai: block.jam_ke_mulai,
          jam_ke_selesai: block.jam_ke_selesai,
        }
      })
      const guruRecords = detailGuru.sort((a, b) => (
        a.jam_ke_mulai - b.jam_ke_mulai ||
        (a.sumber === 'perizinan_siswa' ? -1 : 1)
      ))
      const hasStudentPermission = permissionBlockIds.size > 0
      const fullDayStudentPermission = activeBlocks.length > 0 && activeBlocks.every(block =>
        permissionBlockIds.has(block.penugasan_id)
      )
      const permissionStatuses = Array.from(permissionBlockStatusById.values())
      const fullDayStudentPermissionStatus = fullDayStudentPermission && permissionStatuses.length > 0 &&
        permissionStatuses.every(status => status === permissionStatuses[0])
        ? permissionStatuses[0]
        : undefined
      const submittedStatuses = blockStatuses
        .filter(block => block.submitted)
        .map(block => {
          const permissionStatus = permissionBlockStatusById.get(block.penugasan_id)
          const dailyPermissionStatus = permissionStatus === 'SAKIT'
            ? 'SAKIT'
            : 'HADIR'
          return normalizeDailyTeacherBlockStatus(
            block.status as SubmittedBlockStatus,
            permissionBlockIds.has(block.penugasan_id),
            dailyPermissionStatus,
          )
        })
      const clock = dayBlocks.clock
      const guruState = deriveDailyTeacherStatus({
        totalBlocks: totalBlok,
        submittedStatuses,
        dayEnded: clock.ended,
        missingEndTime: clock.missingEndTime,
      })
      const guruStatus = guruState.status
      const activeJam = Array.from(new Set(activeBlocks.flatMap(block => block.jam_ke)))
      const izinSekolahRows = izinKelasRows.filter(row =>
        Number(row.hitung_sebagai_hadir) === 1 && studentPermissionStatusFromReason(row.alasan) !== 'SAKIT'
      )
      const izinSekolahSehariPenuh = activeJam.length > 0 && activeJam.every(jamKe =>
        izinSekolahRows.some(row => {
          const jamIzin = parseIzinJamPelajaran(row.jam_pelajaran)
          return jamIzin.length === 0 || jamIzin.includes(jamKe)
        })
      )
      const resolvedFinal = !clock.ended ? resolveFinalAttendanceStatus({ teacherStatus: guruStatus }) : resolveFinalAttendanceStatus({
        teacherStatus: guruStatus,
        waliStatus: waliRecord?.status ?? null,
        fullDaySchoolPermission: izinSekolahSehariPenuh,
        fullDayStudentPermissionStatus,
      })
      let statusReason = guruState.reason
      if (!clock.ended) {
        statusReason = guruState.reason
      } else if (izinSekolahSehariPenuh) {
        statusReason = 'Izin kepentingan sekolah mencakup seluruh blok KBM dan dihitung hadir.'
      } else if (waliRecord?.status) {
        statusReason = `Status ditetapkan wali kelas menjadi ${waliRecord.status}.`
      } else if (fullDayStudentPermissionStatus === 'SAKIT') {
        statusReason = 'Perizinan Siswa mencakup seluruh blok KBM dengan alasan sakit.'
      } else if (fullDayStudentPermissionStatus === 'IZIN') {
        statusReason = 'Izin dari modul Perizinan Siswa mencakup seluruh blok KBM dan dihitung Hadir.'
      } else if (hasStudentPermission) {
        statusReason = `${fullDayStudentPermission ? 'Perizinan Siswa mencakup seluruh blok KBM dengan alasan berbeda.' : 'Perizinan Siswa hanya mencakup sebagian blok KBM.'} ${guruState.reason}`
      }

      const submittedBlok = blockStatuses.filter(block => block.submitted).length
      if (clock.ended && submittedBlok < totalBlok && !statusReason.includes('blok belum diinput')) {
        statusReason += ` ${totalBlok - submittedBlok} blok belum diinput; rekap memakai data yang tersedia.`
      }
      if (clock.ended && ['HADIR', 'SAKIT', 'IZIN', 'ALFA'].includes(resolvedFinal.status)) {
        statusReason = `Rekap setelah KBM. ${statusReason}`
      }

      perDay.push({
        siswa_id: siswa.id,
        nama_lengkap: siswa.nama_lengkap,
        nisn: siswa.nisn,
        tanggal,
        is_daily_final: clock.ended && ['HADIR', 'SAKIT', 'IZIN', 'ALFA'].includes(resolvedFinal.status),
        kbm_end_at: clock.kbmEndAt,
        total_blok: totalBlok,
        submitted_blok: submittedBlok,
        pending_blok: Math.max(0, totalBlok - submittedBlok),
        guru_status: guruStatus,
        guru_status_reason: guruState.reason,
        wali_status: waliRecord?.status ?? null,
        status_akhir: resolvedFinal.status,
        sumber_status: resolvedFinal.source,
        status_reason: statusReason,
        requires_wali_decision: !izinSekolahSehariPenuh && !fullDayStudentPermissionStatus && !waliRecord && guruState.requiresWaliDecision,
        keterangan_wali_kelas: waliRecord?.keterangan ?? null,
        block_statuses: blockStatuses,
        detail_guru: guruRecords,
      })
    }
    statusByStudent.set(siswa.id, perDay)
  }

  const result: FinalAttendanceClassData = {
    kelas: {
      ...kelas,
      label: formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok),
    },
    dates: classDates,
    siswa: siswaList,
    statusByStudent,
  }
  if (!options?.fresh) setMemCache(cacheKey, result, 60_000)
  return result
}

export async function getFinalAttendanceForStudent(
  db: D1Database,
  siswaId: string,
  startDate: string,
  endDate: string,
  options?: { tahunAjaranId?: string }
) {
  const siswa = await db.prepare(`
    SELECT s.id, s.nama_lengkap, s.nisn, s.nis_lokal, s.kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()

  if (!siswa?.kelas_id) {
    return null
  }

  const classData = await getFinalAttendanceForClass(db, siswa.kelas_id, startDate, endDate, {
    tahunAjaranId: options?.tahunAjaranId,
    siswaId,
  })
  if (!classData) {
    return null
  }

  return {
    siswa,
    kelas_label: formatNamaKelas(siswa.tingkat, siswa.nomor_kelas, siswa.kelompok),
    statuses: classData.statusByStudent.get(siswaId) || [],
  }
}

export async function getSchoolAttendanceEstimateForDate(db: D1Database, tanggal: string): Promise<SchoolAttendanceEstimate> {
  const cacheKey = `school-estimate:${tanggal}`
  const cached = getMemCache<SchoolAttendanceEstimate>(cacheKey)
  if (cached) return cached

  const hari = hariNum(new Date(`${tanggal}T00:00:00`))
  const [ta, totalRow, izinRes, exceptions] = await Promise.all([
    db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>(),
    db.prepare(`SELECT COUNT(*) as total FROM siswa WHERE status = 'aktif'`).first<{ total: number }>(),
    db.prepare(`
      SELECT itk.siswa_id, itk.jam_pelajaran, itk.alasan, s.kelas_id,
        COALESCE(aik.hitung_sebagai_hadir, 0) as hitung_sebagai_hadir
      FROM izin_tidak_masuk_kelas itk
      JOIN siswa s ON s.id = itk.siswa_id AND s.status = 'aktif'
      LEFT JOIN alasan_izin_kelas aik ON aik.alasan = itk.alasan
      WHERE itk.tanggal = ?
    `).bind(tanggal).all<any>(),
    getKbmExceptionsForRange(db, tanggal, tanggal),
  ])

  const jadwalRes = ta?.id
    ? await db.prepare(`
        SELECT k.id as kelas_id, k.tingkat, jm.penugasan_id, jm.jam_ke
        FROM jadwal_mengajar jm
        JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
        JOIN kelas k ON k.id = pm.kelas_id
        WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
          AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
      `).bind(ta.id, hari, tanggal).all<any>()
    : { results: [] as any[] }

  const blocksByClass = new Map<string, Map<string, { tingkat: number; jam: number[] }>>()
  for (const row of jadwalRes.results || []) {
    if (!blocksByClass.has(row.kelas_id)) blocksByClass.set(row.kelas_id, new Map())
    const classBlocks = blocksByClass.get(row.kelas_id)!
    if (!classBlocks.has(row.penugasan_id)) {
      classBlocks.set(row.penugasan_id, { tingkat: Number(row.tingkat), jam: [] })
    }
    classBlocks.get(row.penugasan_id)!.jam.push(Number(row.jam_ke))
  }

  const activeJamByClass = new Map<string, Set<number>>()
  for (const [kelasId, blocks] of blocksByClass) {
    const activeJam = new Set<number>()
    for (const block of blocks.values()) {
      const jam = Array.from(new Set(block.jam)).sort((a, b) => a - b)
      const activeSlots = splitTeachingSlotsByExceptions(
        exceptions,
        { id: kelasId, tingkat: block.tingkat },
        jam
      ).activeJamKe
      for (const jamKe of activeSlots) activeJam.add(jamKe)
    }
    activeJamByClass.set(kelasId, activeJam)
  }

  const allIzinStudents = new Set<string>()
  const schoolRowsByStudent = new Map<string, Array<{ kelas_id: string; jam_pelajaran: unknown; alasan: string | null }>>()
  for (const row of izinRes.results || []) {
    allIzinStudents.add(row.siswa_id)
    if (studentPermissionStatusFromReason(row.alasan) === 'SAKIT') continue
    if (Number(row.hitung_sebagai_hadir) !== 1) continue
    if (!schoolRowsByStudent.has(row.siswa_id)) schoolRowsByStudent.set(row.siswa_id, [])
    schoolRowsByStudent.get(row.siswa_id)!.push({
      kelas_id: row.kelas_id,
      jam_pelajaran: row.jam_pelajaran,
      alasan: row.alasan || null,
    })
  }

  const schoolPresentStudents = new Set<string>()
  for (const [siswaId, rows] of schoolRowsByStudent) {
    const activeJam = Array.from(activeJamByClass.get(rows[0]?.kelas_id) || [])
    if (activeJam.length > 0 && activeJam.every(jamKe => rows.some(row => {
      const jamIzin = parseIzinJamPelajaran(row.jam_pelajaran)
      return jamIzin.length === 0 || jamIzin.includes(jamKe)
    }))) {
      schoolPresentStudents.add(siswaId)
    }
  }

  const izinTidakMasuk = Array.from(allIzinStudents).filter(id => !schoolPresentStudents.has(id)).length
  const totalSiswa = Number(totalRow?.total || 0)
  const estimate: SchoolAttendanceEstimate = {
    total_siswa: totalSiswa,
    tidak_masuk: izinTidakMasuk,
    hadir_estimasi: Math.max(0, totalSiswa - izinTidakMasuk),
  }
  setMemCache(cacheKey, estimate, 60_000)
  return estimate
}
