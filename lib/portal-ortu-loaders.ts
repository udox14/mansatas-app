import { summarizeParentAttendanceDays } from '@/lib/parent-attendance-presentation'
import { findSlotException, getKalenderDateStatus, getKalenderEventsForRange, getKbmExceptionsForDate, kalenderDateStatusFromEvents, enumerateDateStrings } from '@/lib/kalender-pendidikan'
import { ensureParentSuggestionTable } from '@/lib/parent-suggestions'
import { getKomitePaymentSettings, selectKomitePaymentSettings } from '@/lib/komite-payment-settings'
import { getDocumentationArticles } from '@/lib/documentation'
import { getFinalAttendanceForStudent } from '@/lib/wali-kelas-attendance'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { sanitizeParentAgenda, parentSessionAttendance } from '@/lib/parent-schedule'
import { getParentDisciplineData, getParentDisciplineSettings } from '@/lib/parent-discipline'

type SlotJam = { id: number; mulai: string; selesai: string }
type PolaJam = { hari: number[]; slots: SlotJam[] }
type TodayAbsensiRow = {
  penugasan_id: string
  jam_ke_mulai: number | null
  jam_ke_selesai: number | null
  status: string
  catatan: string | null
}
type TodayIzinRow = {
  jam_pelajaran: string | number | null
  alasan: string
  keterangan: string | null
}
type GuruTidakHadir = {
  status: 'SAKIT' | 'IZIN'
  keterangan: string | null
}

export function isDsptZeroUninput(
  tahunMasuk: number | string | null | undefined,
  nominal: number | null | undefined,
  totalDibayar: number | null | undefined,
  totalDiskon: number | null | undefined,
) {
  return Number(tahunMasuk || 0) >= 2026
    && Number(nominal || 0) === 0
    && Number(totalDibayar || 0) === 0
    && Number(totalDiskon || 0) === 0
}

export function getDsptStatus(
  tahunMasuk: number | string | null | undefined,
  dspt: any,
): 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada' {
  if (!dspt) return 'tidak_ada'
  const target = Number(dspt.nominal_target || 0)
  const bayar = Number(dspt.total_dibayar || 0)
  const diskon = Number(dspt.total_diskon || 0)
  if (isDsptZeroUninput(tahunMasuk, target, bayar, diskon)) return 'tidak_ada'
  if (target - bayar - diskon <= 0) return 'lunas'
  if (bayar > 0) return 'nyicil'
  return 'belum_bayar'
}

export function computeFinanceSummaryFields(tahunMasuk: number | string | null | undefined, dspt: any, sppSaldoAwal: any) {
  const dsptTarget = Number(dspt?.nominal_target || 0)
  const dsptBayar = Number(dspt?.total_dibayar || 0)
  const dsptDiskon = Number(dspt?.total_diskon || 0)
  const dsptSisa = Math.max(0, dsptTarget - dsptBayar - dsptDiskon)
  const dsptStatus = getDsptStatus(tahunMasuk, dspt)
  const dsptIsInput = dsptStatus !== 'tidak_ada'
  const dsptIsLunas = dsptStatus === 'lunas'
  const dsptNeedsInput = dsptStatus === 'tidak_ada'
  const sppNominal = Number(sppSaldoAwal?.jumlah || 0)
  const sppBayar = Number(sppSaldoAwal?.total_dibayar || 0)
  const sppSisa = Math.max(0, sppNominal - sppBayar)
  return {
    dsptTarget,
    dsptBayar,
    dsptDiskon,
    dsptSisa,
    dsptStatus,
    dsptIsInput,
    dsptIsLunas,
    dsptNeedsInput,
    sppNominal,
    sppBayar,
    sppSisa,
  }
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function getTodayWeekContextWIB() {
  const todayRaw = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const todayDayMap = new Date(`${todayRaw}T12:00:00Z`).getUTCDay()
  const todayDay = todayDayMap === 0 ? 7 : todayDayMap
  const weekStart = shiftDate(todayRaw, 1 - todayDay)
  const weekEnd = shiftDate(weekStart, 5)
  return { todayRaw, todayDay, weekStart, weekEnd }
}

export function academicYearRange(nama: string, semester: number) {
  const years = String(nama || '').match(/(\d{4})\D+(\d{4})/)
  if (!years) return null
  const firstYear = Number(years[1])
  const secondYear = Number(years[2])
  return Number(semester) === 1
    ? { startDate: `${firstYear}-07-01`, endDate: `${firstYear}-12-31` }
    : { startDate: `${secondYear}-01-01`, endDate: `${secondYear}-06-30` }
}

function parseIzinJam(raw: TodayIzinRow['jam_pelajaran']) {
  if (raw === null || raw === undefined || raw === '') return []
  try {
    const parsed = JSON.parse(String(raw))
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map(Number)
      .filter(value => Number.isInteger(value) && value > 0)
  } catch {
    const value = Number(raw)
    return Number.isInteger(value) && value > 0 ? [value] : []
  }
}

function parseJamPelajaran(raw: string | null | undefined): Map<number, Map<number, SlotJam>> {
  const byDay = new Map<number, Map<number, SlotJam>>()
  if (!raw) return byDay
  try {
    const patterns = JSON.parse(raw) as PolaJam[]
    for (const p of patterns || []) {
      for (const d of p.hari || []) {
        if (!byDay.has(d)) byDay.set(d, new Map<number, SlotJam>())
        const dayMap = byDay.get(d)!
        for (const s of p.slots || []) dayMap.set(Number(s.id), s)
      }
    }
  } catch {}
  return byDay
}

export async function ensureParentCommunicationTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source_ref TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, type, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_summons (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      source_ref TEXT,
      reason TEXT NOT NULL,
      event_date TEXT,
      event_time TEXT,
      location TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'terkirim',
      parent_response TEXT,
      parent_response_note TEXT,
      parent_responded_at TEXT,
      created_by TEXT REFERENCES "user"(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_thread_notes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      note_type TEXT NOT NULL DEFAULT 'tindak_lanjut',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

export async function ensurePaymentSubmissionTable(db: D1Database) {
  await ensureSchemaOnce('fin-payment-submissions', async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS fin_payment_submissions (
        id TEXT PRIMARY KEY,
        siswa_id TEXT NOT NULL REFERENCES siswa(id),
        dspt_id TEXT NOT NULL REFERENCES fin_dspt(id),
        kategori TEXT NOT NULL DEFAULT 'dspt',
        metode_bayar TEXT NOT NULL DEFAULT 'transfer',
        jumlah INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'belum_upload',
        bank_tujuan TEXT,
        bukti_url TEXT,
        bukti_uploaded_at TEXT,
        confirmed_by TEXT REFERENCES "user"(id),
        confirmed_at TEXT,
        rejected_by TEXT REFERENCES "user"(id),
        rejected_at TEXT,
        reject_reason TEXT,
        transaksi_id TEXT REFERENCES fin_transaksi(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
  })
}

export async function loadParentAttendanceYears(db: D1Database) {
  const rows = await db.prepare(`
    SELECT id, nama, semester, is_active
    FROM tahun_ajaran
    ORDER BY nama DESC, semester DESC
  `).all<any>()
  return rows.results || []
}

export async function loadParentAttendanceForYear(db: D1Database, siswaId: string, tahunAjaranId: string) {
  const ta = await db.prepare(`
    SELECT id, nama, semester, is_active
    FROM tahun_ajaran
    WHERE id = ?
    LIMIT 1
  `).bind(tahunAjaranId).first<any>()
  if (!ta) return { error: 'Tahun ajaran tidak ditemukan.' }

  const range = academicYearRange(ta.nama, Number(ta.semester))
  if (!range) return { error: 'Rentang tahun ajaran belum dapat ditentukan.' }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const endDate = range.endDate > today ? today : range.endDate
  const [result, events, siswaKelas] = await Promise.all([
    endDate >= range.startDate
      ? getFinalAttendanceForStudent(db, siswaId, range.startDate, endDate, { tahunAjaranId: ta.id })
      : Promise.resolve(null),
    endDate >= range.startDate
      ? getKalenderEventsForRange(db, range.startDate, endDate)
      : Promise.resolve([] as any[]),
    db.prepare(`
      SELECT k.id AS kelas_id, k.tingkat
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
    `).bind(siswaId).first<{ kelas_id: string | null; tingkat: number | null }>(),
  ])

  const statuses = result?.statuses || []
  const aggregates = summarizeParentAttendanceDays(statuses)
  const calendarScope = siswaKelas?.kelas_id
    ? { kelasId: siswaKelas.kelas_id, tingkat: Number(siswaKelas.tingkat) }
    : null
  const calendarExceptions = endDate >= range.startDate ? enumerateDateStrings(range.startDate, endDate)
    .map(tanggal => kalenderDateStatusFromEvents(tanggal, events, calendarScope))
    .filter(day => !day.isEffective)
    .map(day => ({ tanggal: day.tanggal, label: 'Hari libur', reason: day.reason })) : []

  return {
    tahunAjaran: { id: ta.id, nama: ta.nama, semester: Number(ta.semester), isActive: Number(ta.is_active) === 1 },
    range: { startDate: range.startDate, endDate },
    ...aggregates,
    calendarDays: statuses,
    calendarExceptions,
  }
}

export async function loadParentKehadiranTabData(db: D1Database, siswaId: string) {
  const attendanceYears = await loadParentAttendanceYears(db)
  const activeAttendanceYear = attendanceYears.find((item: any) => Number(item.is_active) === 1) || attendanceYears[0]
  if (!activeAttendanceYear) {
    return { attendanceYears, attendanceInitial: null }
  }
  const initial = await loadParentAttendanceForYear(db, siswaId, activeAttendanceYear.id)
  return {
    attendanceYears,
    attendanceInitial: 'error' in initial ? null : initial,
  }
}

export async function loadParentKedisiplinanTabData(db: D1Database, siswaId: string, activeTahunAjaranId?: string | null) {
  const settings = await getParentDisciplineSettings()
  if (!settings.enabled) {
    return { error: 'Fitur kedisiplinan sedang dinonaktifkan.', attendanceYears: [], disciplineInitial: null }
  }
  const attendanceYears = await loadParentAttendanceYears(db)
  const targetTaId = activeTahunAjaranId
    || attendanceYears.find((item: any) => Number(item.is_active) === 1)?.id
    || attendanceYears[0]?.id
  const disciplineInitial = targetTaId ? await getParentDisciplineData(db, siswaId, targetTaId) : null
  return { attendanceYears, disciplineInitial }
}

export async function loadParentJadwalTabData(
  db: D1Database,
  siswaId: string,
  context?: {
    kelasId?: string | null
    tingkat?: number | null
    tahunAjaranId?: string | null
    jamPelajaran?: string | null
    todayAttendance?: any
  },
) {
  const { todayRaw, todayDay, weekStart, weekEnd } = getTodayWeekContextWIB()

  let kelasId = context?.kelasId ?? null
  let tingkat = context?.tingkat ?? null
  let tahunAjaranId = context?.tahunAjaranId ?? null
  let jamPelajaran = context?.jamPelajaran ?? null

  if (kelasId === null && context?.kelasId === undefined) {
    const [studentRow, taRow] = await Promise.all([
      db.prepare(`
        SELECT s.kelas_id, k.tingkat
        FROM siswa s
        LEFT JOIN kelas k ON k.id = s.kelas_id
        WHERE s.id = ?
        LIMIT 1
      `).bind(siswaId).first<{ kelas_id: string | null; tingkat: number | null }>(),
      db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
        .first<{ id: string; jam_pelajaran: string | null }>(),
    ])
    kelasId = studentRow?.kelas_id ?? null
    tingkat = studentRow?.tingkat ?? null
    tahunAjaranId = taRow?.id ?? null
    jamPelajaran = taRow?.jam_pelajaran ?? null
  } else if (tahunAjaranId === null && context?.tahunAjaranId === undefined) {
    const taRow = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
      .first<{ id: string; jam_pelajaran: string | null }>()
    tahunAjaranId = taRow?.id ?? null
    jamPelajaran = taRow?.jam_pelajaran ?? null
  }

  const jamMap = parseJamPelajaran(jamPelajaran)

  const [
    calendarStatus,
    kbmExceptions,
    jadwalRows,
    todayAbsensiRows,
    todayIzinRows,
    agendaRows,
    delegasiRows,
    computedTodayAttendance,
  ] = await Promise.all([
    getKalenderDateStatus(db, todayRaw, kelasId ? { kelasId, tingkat: Number(tingkat) } : null),
    kelasId ? getKbmExceptionsForDate(db, todayRaw) : Promise.resolve([] as any[]),
    kelasId
      ? db.prepare(`
          SELECT jm.hari, jm.jam_ke, mp.nama_mapel, u.nama_lengkap AS guru_nama, pm.id AS penugasan_id
          FROM jadwal_mengajar jm
          JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
          JOIN kelas k ON pm.kelas_id = k.id
          JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
          LEFT JOIN "user" u ON u.id = pm.guru_id
          WHERE pm.kelas_id = ? AND pm.tahun_ajaran_id = ?
            AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
          ORDER BY jm.hari ASC, jm.jam_ke ASC
        `).bind(kelasId, tahunAjaranId || '', todayRaw).all<any>()
      : Promise.resolve({ results: [] as any[] }),
    db.prepare(`
      SELECT penugasan_id, jam_ke_mulai, jam_ke_selesai, status, catatan
      FROM absensi_siswa
      WHERE siswa_id = ? AND tanggal = ?
    `).bind(siswaId, todayRaw).all<TodayAbsensiRow>(),
    db.prepare(`
      SELECT jam_pelajaran, alasan, keterangan
      FROM izin_tidak_masuk_kelas
      WHERE siswa_id = ? AND tanggal = ?
      ORDER BY created_at ASC
    `).bind(siswaId, todayRaw).all<TodayIzinRow>(),
    kelasId
      ? db.prepare(`
          SELECT ag.penugasan_id, ag.tanggal, ag.materi, ag.foto_url, ag.status, ag.catatan_admin
          FROM agenda_guru ag
          JOIN penugasan_mengajar pm ON pm.id = ag.penugasan_id
          WHERE pm.kelas_id = ? AND ag.tanggal BETWEEN ? AND ?
        `).bind(kelasId, weekStart, weekEnd).all<any>()
      : Promise.resolve({ results: [] as any[] }),
    kelasId
      ? db.prepare(`
          SELECT dtk.penugasan_mengajar_id AS penugasan_id, dt.tanggal,
            dt.alasan_ketidakhadiran, dt.deskripsi_ketidakhadiran
          FROM delegasi_tugas dt
          JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
          JOIN penugasan_mengajar pm ON pm.id = dtk.penugasan_mengajar_id
          WHERE pm.kelas_id = ?
            AND dt.dari_user_id = pm.guru_id
            AND dt.tanggal BETWEEN ? AND ?
          ORDER BY dt.created_at DESC
        `).bind(kelasId, weekStart, weekEnd).all<any>()
      : Promise.resolve({ results: [] as any[] }),
    context?.todayAttendance !== undefined
      ? Promise.resolve(context.todayAttendance)
      : tahunAjaranId
        ? getFinalAttendanceForStudent(db, siswaId, todayRaw, todayRaw, { tahunAjaranId })
            .then(res => res?.statuses.find(day => day.tanggal === todayRaw) || null)
        : Promise.resolve(null),
  ])

  const todayAttendance = computedTodayAttendance
  const todayPenugasanIds = Array.from(
    new Set(
      (jadwalRows.results || [])
        .filter((row: any) => Number(row.hari) === todayDay)
        .map((row: any) => row.penugasan_id)
        .filter(Boolean),
    ),
  )

  const todaySubmittedSet = new Set<string>()
  if (todayPenugasanIds.length > 0) {
    const placeholders = todayPenugasanIds.map(() => '?').join(',')
    const sesiRows = await db.prepare(`
      SELECT penugasan_id
      FROM absensi_sesi_guru
      WHERE tanggal = ? AND penugasan_id IN (${placeholders})
    `).bind(todayRaw, ...todayPenugasanIds).all<{ penugasan_id: string }>()
    for (const row of sesiRows.results || []) {
      todaySubmittedSet.add(row.penugasan_id)
    }
  }

  const todayAbsensiMap = new Map<string, { status: string; catatan: string | null }>()
  for (const row of todayAbsensiRows.results || []) {
    const start = Number(row.jam_ke_mulai || 0)
    const end = Number(row.jam_ke_selesai || start)
    if (start > 0 && end >= start) {
      for (let jam = start; jam <= end; jam++) {
        todayAbsensiMap.set(`${row.penugasan_id}__${jam}`, { status: row.status, catatan: row.catatan })
      }
    } else {
      todayAbsensiMap.set(`${row.penugasan_id}__all`, { status: row.status, catatan: row.catatan })
    }
  }

  const todayIzinMap = new Map<number | 'all', Array<{ alasan: string; note: string }>>()
  for (const row of todayIzinRows.results || []) {
    const note = [row.alasan || 'Izin', row.keterangan].filter(Boolean).join(': ')
    const jamList = parseIzinJam(row.jam_pelajaran)
    const keys: Array<number | 'all'> = jamList.length > 0 ? jamList : ['all']
    for (const key of keys) {
      if (!todayIzinMap.has(key)) todayIzinMap.set(key, [])
      todayIzinMap.get(key)!.push({ alasan: row.alasan, note })
    }
  }

  const agendaMap = new Map<string, any>()
  for (const agenda of agendaRows.results || []) {
    agendaMap.set(`${agenda.penugasan_id}__${agenda.tanggal}`, agenda)
  }

  const guruTidakHadirMap = new Map<string, GuruTidakHadir>()
  for (const agenda of agendaRows.results || []) {
    if (agenda.status === 'SAKIT' || agenda.status === 'IZIN') {
      guruTidakHadirMap.set(`${agenda.penugasan_id}__${agenda.tanggal}`, {
        status: agenda.status,
        keterangan: agenda.status === 'IZIN' ? agenda.catatan_admin || null : null,
      })
    }
  }

  for (const delegasi of delegasiRows.results || []) {
    const key = `${delegasi.penugasan_id}__${delegasi.tanggal}`
    if (agendaMap.has(key)) continue
    if (delegasi.alasan_ketidakhadiran === 'SAKIT' || delegasi.alasan_ketidakhadiran === 'IZIN') {
      guruTidakHadirMap.set(key, {
        status: delegasi.alasan_ketidakhadiran,
        keterangan: delegasi.alasan_ketidakhadiran === 'IZIN'
          ? delegasi.deskripsi_ketidakhadiran || null
          : null,
      })
    }
  }

  const jadwalByDay = new Map<number, any[]>()
  for (const row of (jadwalRows.results || [])) {
    const hari = Number(row.hari)
    if (!jadwalByDay.has(hari)) jadwalByDay.set(hari, [])
    const jamKe = Number(row.jam_ke)
    const slot = jamMap.get(hari)?.get(jamKe)
    let absensi: ReturnType<typeof parentSessionAttendance> | null = null
    if (hari === todayDay) {
      const exception = kelasId
        ? findSlotException(kbmExceptions, { id: kelasId, tingkat: Number(tingkat) }, jamKe)
        : null
      const absRecord = todayAbsensiMap.get(`${row.penugasan_id}__${jamKe}`) || todayAbsensiMap.get(`${row.penugasan_id}__all`)
      const izinNotes = [
        ...(todayIzinMap.get('all') || []),
        ...(todayIzinMap.get(jamKe) || []),
      ]
      if (!calendarStatus.isEffective) {
        absensi = { status: 'LIBUR', catatan: calendarStatus.reason || 'Hari libur', official: false }
      } else if (exception) {
        absensi = { status: 'KBM_EXCEPTION', catatan: exception.description || exception.judul, official: false }
      } else {
        absensi = parentSessionAttendance({
          day: todayAttendance,
          assignment: row.penugasan_id,
          jam: jamKe,
          raw: absRecord,
          submitted: todaySubmittedSet.has(row.penugasan_id),
          permissions: izinNotes,
        })
      }
    }

    const dayBlocks = jadwalByDay.get(hari)!
    const previous = dayBlocks[dayBlocks.length - 1]
    const canMerge = previous
      && previous.penugasan_id === row.penugasan_id
      && Number(previous.jam_ke_selesai) + 1 === jamKe
      && JSON.stringify(previous.absensiRows.at(-1)) === JSON.stringify(absensi)
    if (canMerge) {
      previous.jam_ke_selesai = jamKe
      previous.waktu_selesai = slot?.selesai || previous.waktu_selesai
      previous.absensiRows.push(absensi)
    } else {
      const agendaDate = shiftDate(weekStart, hari - 1)
      const agendaForDate = agendaMap.get(`${row.penugasan_id}__${agendaDate}`) || null
      const safeAgenda = sanitizeParentAgenda(agendaForDate, agendaDate, todayRaw)
      dayBlocks.push({
        penugasan_id: row.penugasan_id,
        jam_ke_mulai: jamKe,
        jam_ke_selesai: jamKe,
        waktu_mulai: slot?.mulai || null,
        waktu_selesai: slot?.selesai || null,
        mapel: row.nama_mapel,
        guru: row.guru_nama || '-',
        absensiRows: [absensi],
        agenda: safeAgenda,
        guruTidakHadir: guruTidakHadirMap.get(`${row.penugasan_id}__${agendaDate}`) || null,
        agendaDate,
        isToday: hari === todayDay,
      })
    }
  }

  const attendancePriority: Record<string, number> = {
    ALFA: 7,
    SAKIT: 6,
    IZIN: 5,
    KBM_EXCEPTION: 4,
    LIBUR: 3,
    BELUM_ADA_DATA: 2,
    HADIR: 1,
  }
  for (const blocks of jadwalByDay.values()) {
    for (const block of blocks) {
      block.absensi = block.absensiRows
        .filter(Boolean)
        .sort((a: any, b: any) => (attendancePriority[b.status] || 0) - (attendancePriority[a.status] || 0))[0] || null
      delete block.absensiRows
      block.waktu = block.waktu_mulai && block.waktu_selesai
        ? `${block.waktu_mulai} - ${block.waktu_selesai}`
        : '-'
    }
  }

  return {
    jadwalObject: Object.fromEntries(Array.from(jadwalByDay.entries())),
    todayAttendance,
  }
}

export async function loadParentNilaiTabData(db: D1Database, siswaId: string) {
  const nilaiRekap = await db.prepare(`
    SELECT nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_smt6
    FROM rekap_nilai_akademik
    WHERE siswa_id = ?
    LIMIT 1
  `).bind(siswaId).first<any>()

  const avgSemester = (raw: string | null | undefined) => {
    if (!raw) return null
    try {
      const obj = JSON.parse(raw)
      const nums = Object.values(obj || {}).map((x: any) => Number(x)).filter((x: number) => !Number.isNaN(x))
      if (!nums.length) return null
      return (nums.reduce((a: number, b: number) => a + b, 0) / nums.length).toFixed(2)
    } catch {
      return null
    }
  }

  const semesters = [
    { label: 'Semester 1', value: avgSemester(nilaiRekap?.nilai_smt1) },
    { label: 'Semester 2', value: avgSemester(nilaiRekap?.nilai_smt2) },
    { label: 'Semester 3', value: avgSemester(nilaiRekap?.nilai_smt3) },
    { label: 'Semester 4', value: avgSemester(nilaiRekap?.nilai_smt4) },
    { label: 'Semester 5', value: avgSemester(nilaiRekap?.nilai_smt5) },
    { label: 'Semester 6', value: avgSemester(nilaiRekap?.nilai_smt6) },
  ]
  const semesterNumeric = semesters.map(s => s.value).filter(v => v !== null && v !== undefined && v !== '').map(Number).filter(v => !Number.isNaN(v))
  const semesterAvg = semesterNumeric.length ? Number((semesterNumeric.reduce((a, b) => a + b, 0) / semesterNumeric.length).toFixed(1)) : null
  return { semesters, semesterAvg }
}

export async function loadParentPsikotesTabData(db: D1Database, siswaId: string) {
  const psikotesData = await db.prepare(`
    SELECT
      id, siswa_id, iq_score, iq_klasifikasi,
      bakat_ver, bakat_num, bakat_skl, bakat_abs, bakat_mek, bakat_rr, bakat_kkk,
      minat_ps, minat_nat, minat_mek, minat_bis, minat_art, minat_si,
      minat_v, minat_m, minat_k,
      riasec, mapel_pilihan, rekom_raw, rekom_jurusan,
      mbti, gaya_belajar, usia_thn, usia_bln, updated_at
    FROM siswa_psikotes
    WHERE siswa_id = ?
    LIMIT 1
  `).bind(siswaId).first<any>().catch(() => null)
  return { psikotesData }
}

export async function loadParentKeuanganTabData(db: D1Database, siswaId: string, context?: { tingkat?: number | null; tahunMasuk?: number | string | null }) {
  await ensurePaymentSubmissionTable(db)
  const [studentRow, dspt, sppSaldoAwal, transaksiTerbaru, paymentSubmissions, komiteSettings] = await Promise.all([
    context?.tingkat !== undefined && context?.tahunMasuk !== undefined
      ? Promise.resolve({ tingkat: context.tingkat, tahun_masuk: context.tahunMasuk })
      : db.prepare(`
          SELECT s.tahun_masuk, k.tingkat
          FROM siswa s
          LEFT JOIN kelas k ON k.id = s.kelas_id
          WHERE s.id = ?
          LIMIT 1
        `).bind(siswaId).first<{ tahun_masuk: number | string | null; tingkat: number | null }>(),
    db.prepare(`
      SELECT nominal_target, total_dibayar, total_diskon, status
      FROM fin_dspt
      WHERE siswa_id = ?
      LIMIT 1
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT jumlah, total_dibayar, status
      FROM fin_spp_saldo_awal
      WHERE siswa_id = ?
      LIMIT 1
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT t.id, t.nomor_kuitansi, t.kategori, t.metode_bayar, t.jumlah_total, t.created_at,
             u.nama_lengkap AS nama_input
      FROM fin_transaksi t
      LEFT JOIN "user" u ON u.id = t.input_oleh
      WHERE t.siswa_id = ? AND t.is_void = 0
      ORDER BY t.created_at DESC
      LIMIT 6
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT id, siswa_id, dspt_id, kategori, metode_bayar, jumlah, status,
             bukti_url, bukti_uploaded_at, reject_reason, transaksi_id, created_at, updated_at
      FROM fin_payment_submissions
      WHERE siswa_id = ? AND kategori = 'dspt'
      ORDER BY datetime(created_at) DESC
      LIMIT 20
    `).bind(siswaId).all<any>(),
    getKomitePaymentSettings(db),
  ])

  const financeFields = computeFinanceSummaryFields(studentRow?.tahun_masuk, dspt, sppSaldoAwal)
  const pendingConfirmationTotal = (paymentSubmissions?.results || [])
    .filter((s: any) => s.status === 'menunggu_konfirmasi')
    .reduce((sum: number, s: any) => sum + Number(s.jumlah || 0), 0)

  return {
    ...financeFields,
    pendingConfirmationTotal,
    paymentSubmissions,
    transaksiTerbaru,
    komitePaymentSettings: selectKomitePaymentSettings(komiteSettings, studentRow?.tingkat),
  }
}

export async function loadParentSaranTabData(db: D1Database, siswaId: string) {
  await ensureParentSuggestionTable(db)
  const parentSuggestions = await db.prepare(`
    SELECT id, category, title, message, is_anonymous, status, read_at, handled_at, created_at, updated_at
    FROM parent_suggestions
    WHERE siswa_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 20
  `).bind(siswaId).all<any>()
  return { parentSuggestions }
}

export async function loadParentDokumentasiTabData(db: D1Database) {
  const documentationArticles = await getDocumentationArticles(db, { audience: 'parent' })
  return { documentationArticles }
}
