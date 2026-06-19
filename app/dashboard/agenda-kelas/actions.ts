'use server'

import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { formatNamaKelas } from '@/lib/utils'
import { todayWIB, currentTimeWIB } from '@/lib/time'
import {
  findTeachingBlockException,
  getEffectiveDatesInRange,
  getKbmExceptionsForDate,
  getKalenderDateStatus,
  enumerateDateStrings,
  getKalenderEventsForRange,
  getKbmExceptionsForRange,
} from '@/lib/kalender-pendidikan'
import type { KalenderEvent, KbmException } from '@/lib/kalender-pendidikan'
import type { FinalAttendanceStatus } from '@/lib/wali-kelas-attendance'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'

const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const KEPALA_MADRASAH = {
  nama: 'H. EKA MULYANA, S.Ag., M.Pd.I.',
  nip: '197601202007011001',
}

export type AgendaKelasOption = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  label: string
  jumlah_siswa: number
}

export type AgendaKelasRow = {
  jam_ke: number
  jam_label: string
  mapel_nama: string
  pokok_bahasan: string
  tugas: string
  guru_nama: string
  paraf: string
  guru_status: string
}

export type AgendaKelasAbsensiRow = {
  no: number
  nama: string
  status: FinalAttendanceStatus | 'HADIR'
  sakit: boolean
  izin: boolean
  alfa: boolean
  ket: string
}

export type AgendaKelasPageData = {
  kelas: {
    id: string
    label: string
    wali_kelas_nama: string
    wali_kelas_nip: string | null
    km_nama: string
  }
  kepala: typeof KEPALA_MADRASAH
  tanggal: string
  hariNama: string
  agendaRows: AgendaKelasRow[]
  absensiRows: AgendaKelasAbsensiRow[]
  rekap: {
    terisi: number
    tugas: number
    kosong: number
  }
  calendarStatus: {
    isEffective: boolean
    reason: string | null
    category: string | null
  }
  hasActiveBlocks: boolean
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tanggal tidak valid.')
}

function hariNum(dateString: string) {
  const day = new Date(dateString + 'T00:00:00').getDay()
  return day === 0 ? 7 : day
}

function getSlots(raw: string | null | undefined, hari: number): SlotJam[] {
  try {
    const list = JSON.parse(raw || '[]') as PolaJam[]
    return list.find(item => item.hari.includes(hari))?.slots || []
  } catch {
    return []
  }
}

function timeToMinutes(value?: string | null): number | null {
  if (!value || value === '-') return null
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function isTeachingBlockEnded(tanggal: string, slotSelesai?: SlotJam): boolean {
  const today = todayWIB()
  if (tanggal < today) return true
  if (tanggal > today) return false
  const selesaiMinutes = timeToMinutes(slotSelesai?.selesai)
  if (selesaiMinutes === null) return true
  const current = currentTimeWIB()
  return current.hours * 60 + current.minutes >= selesaiMinutes
}

// Status kehadiran guru utk kolom cetak: mirror logic monitoring-agenda.
// agenda_guru.status > delegasi (TUGAS, pakai alasan) > ALFA bila blok selesai.
function resolveGuruStatus(opts: {
  agendaStatus?: string | null
  hasDelegasi: boolean
  delegasiAlasan?: string | null
  ended: boolean
}): string {
  const { agendaStatus, hasDelegasi, delegasiAlasan, ended } = opts
  if (agendaStatus) {
    if (agendaStatus === 'SAKIT') return 'SAKIT'
    if (agendaStatus === 'IZIN') return 'IZIN'
    if (agendaStatus === 'ALFA') return 'ALFA'
    // TEPAT_WAKTU, TELAT, HADIR, dll → guru hadir mengajar
    return 'HADIR'
  }
  if (hasDelegasi) {
    if (delegasiAlasan === 'SAKIT') return 'SAKIT'
    if (delegasiAlasan === 'IZIN') return 'IZIN'
    return 'TUGAS'
  }
  return ended ? 'ALFA' : ''
}

function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Bulan tidak valid.')
  const [year, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const endDate = new Date(year, m, 0).getDate()
  return { start, end: `${month}-${String(endDate).padStart(2, '0')}` }
}

function abbreviateStudentName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const normalized = parts.map(part => /^(muhammad|mohammad|mohamad|muhamad|muhamm?ad)$/i.test(part) ? 'M.' : part)
  if (normalized.length <= 2) return normalized.join(' ')
  return [
    normalized[0],
    normalized[1],
    ...normalized.slice(2).map(part => part.endsWith('.') ? part : `${part[0]?.toUpperCase() || ''}.`),
  ].join(' ')
}

function statusKet(status: FinalAttendanceStatus | undefined, source?: string) {
  if (!status || status === 'HADIR') return ''
  if (status === 'SAKIT' || status === 'IZIN' || status === 'ALFA') return ''
  if (status === 'PARSIAL') return 'Bolos'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'Perlu konfirmasi'
  if (status === 'BELUM_ADA_INPUT') return 'Belum input'
  if (status === 'BELUM_ADA_DATA') return 'Belum ada data'
  return source || ''
}

type PrintableAttendanceStatus = 'SAKIT' | 'IZIN' | 'ALFA'

function choosePrintableStatus(statuses: string[]): PrintableAttendanceStatus | null {
  if (statuses.includes('ALFA')) return 'ALFA'
  if (statuses.includes('SAKIT')) return 'SAKIT'
  if (statuses.includes('IZIN')) return 'IZIN'
  return null
}

async function getNonHadirRowsForAgenda(db: D1Database, kelasId: string, tanggal: string): Promise<AgendaKelasAbsensiRow[]> {
  const [siswaRes, waliRes, absensiRes, izinRes, izinKeluarRes] = await Promise.all([
    db.prepare(`
      SELECT id, nama_lengkap
      FROM siswa
      WHERE kelas_id = ? AND status = 'aktif'
      ORDER BY nama_lengkap ASC
    `).bind(kelasId).all<{ id: string; nama_lengkap: string }>(),
    db.prepare(`
      SELECT kawk.siswa_id, kawk.status, kawk.keterangan
      FROM keterangan_absensi_wali_kelas kawk
      JOIN siswa s ON kawk.siswa_id = s.id
      WHERE s.kelas_id = ? AND kawk.tanggal = ?
    `).bind(kelasId, tanggal).all<any>(),
    db.prepare(`
      SELECT ab.siswa_id, ab.status, ab.catatan
      FROM absensi_siswa ab
      JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
      WHERE pm.kelas_id = ? AND ab.tanggal = ? AND ab.status IN ('SAKIT','IZIN','ALFA')
      ORDER BY ab.jam_ke_mulai ASC
    `).bind(kelasId, tanggal).all<any>(),
    db.prepare(`
      SELECT itk.siswa_id, itk.alasan, itk.keterangan
      FROM izin_tidak_masuk_kelas itk
      JOIN siswa s ON itk.siswa_id = s.id
      WHERE s.kelas_id = ? AND itk.tanggal = ?
    `).bind(kelasId, tanggal).all<any>(),
    db.prepare(`
      SELECT ik.siswa_id, ik.keterangan
      FROM izin_keluar_komplek ik
      JOIN siswa s ON ik.siswa_id = s.id
      WHERE s.kelas_id = ?
        AND substr(ik.waktu_keluar, 1, 10) <= ?
        AND (ik.waktu_kembali IS NULL OR substr(ik.waktu_kembali, 1, 10) >= ?)
    `).bind(kelasId, tanggal, tanggal).all<any>(),
  ])

  const waliMap = new Map<string, { status: string; keterangan: string }>()
  for (const row of waliRes.results || []) {
    waliMap.set(row.siswa_id, { status: row.status, keterangan: row.keterangan || '' })
  }

  const statusMap = new Map<string, string[]>()
  const noteMap = new Map<string, string[]>()
  const pushStatus = (siswaId: string, status: string, note?: string) => {
    if (!statusMap.has(siswaId)) statusMap.set(siswaId, [])
    statusMap.get(siswaId)!.push(status)
    if (note) {
      if (!noteMap.has(siswaId)) noteMap.set(siswaId, [])
      noteMap.get(siswaId)!.push(note)
    }
  }

  for (const row of absensiRes.results || []) pushStatus(row.siswa_id, row.status, row.catatan || '')
  for (const row of izinRes.results || []) pushStatus(row.siswa_id, 'IZIN', [row.alasan, row.keterangan].filter(Boolean).join(': '))
  for (const row of izinKeluarRes.results || []) pushStatus(row.siswa_id, 'IZIN', row.keterangan || 'Keluar komplek')

  const rows: AgendaKelasAbsensiRow[] = []
  for (const siswa of siswaRes.results || []) {
    const wali = waliMap.get(siswa.id)
    const status = wali
      ? choosePrintableStatus([wali.status])
      : choosePrintableStatus(statusMap.get(siswa.id) || [])

    if (!status) continue

    const notes = wali?.keterangan
      ? [wali.keterangan]
      : Array.from(new Set(noteMap.get(siswa.id) || [])).filter(Boolean)

    rows.push({
      no: rows.length + 1,
      nama: abbreviateStudentName(siswa.nama_lengkap),
      status,
      sakit: status === 'SAKIT',
      izin: status === 'IZIN',
      alfa: status === 'ALFA',
      ket: notes.slice(0, 2).join('; '),
    })
  }

  return rows
}

async function ensureAccess() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' as const, db: null, user: null }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'agenda-kelas')
  if (!allowed) return { error: 'Anda tidak punya akses ke Agenda Kelas.' as const, db: null, user: null }
  return { error: null, db, user }
}

export async function getAgendaKelasOptions() {
  const access = await ensureAccess()
  if (access.error || !access.db) return { error: access.error, kelas: [] }

  const rows = await access.db.prepare(`
    SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok,
      COUNT(CASE WHEN s.status = 'aktif' THEN 1 END) as jumlah_siswa
    FROM kelas k
    LEFT JOIN siswa s ON s.kelas_id = k.id
    GROUP BY k.id, k.tingkat, k.nomor_kelas, k.kelompok
    ORDER BY CAST(k.tingkat AS INTEGER) ASC, CAST(k.nomor_kelas AS INTEGER) ASC, k.kelompok ASC
  `).all<any>()

  return {
    error: null,
    kelas: (rows.results || []).map(row => ({
      id: row.id,
      tingkat: Number(row.tingkat),
      nomor_kelas: row.nomor_kelas,
      kelompok: row.kelompok,
      label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
      jumlah_siswa: Number(row.jumlah_siswa || 0),
    })),
  }
}

async function buildAgendaKelasHari(
  db: D1Database,
  kelasId: string,
  tanggal = todayWIB()
): Promise<{ error: string | null; data: AgendaKelasPageData | null }> {
  assertDate(tanggal)
  const hari = hariNum(tanggal)
  const hariNama = HARI[hari] || ''

  const [kelas, calendarStatus, ta] = await Promise.all([
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kbm_nonaktif_mulai,
        wali.nama_lengkap as wali_kelas_nama,
        wali.nip as wali_kelas_nip,
        km.nama_lengkap as km_nama
      FROM kelas k
      LEFT JOIN "user" wali ON k.wali_kelas_id = wali.id
      LEFT JOIN siswa km ON k.km_siswa_id = km.id AND km.kelas_id = k.id AND km.status = 'aktif'
      WHERE k.id = ?
    `).bind(kelasId).first<any>(),
    getKalenderDateStatus(db, tanggal),
    db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>(),
  ])
  if (!kelas) return { error: 'Kelas tidak ditemukan.', data: null }

  const baseRows: AgendaKelasRow[] = Array.from({ length: 10 }).map((_, index) => ({
    jam_ke: index + 1,
    jam_label: String(index + 1),
    mapel_nama: '',
    pokok_bahasan: '',
    tugas: '',
    guru_nama: '',
    paraf: '',
    guru_status: '',
  }))

  const classLabel = formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok)
  const baseData = {
    kelas: {
      id: kelas.id,
      label: classLabel,
      wali_kelas_nama: kelas.wali_kelas_nama || '..................................................',
      wali_kelas_nip: kelas.wali_kelas_nip || null,
      km_nama: kelas.km_nama || '..................................................',
    },
    kepala: KEPALA_MADRASAH,
    tanggal,
    hariNama,
    agendaRows: baseRows,
    absensiRows: [] as AgendaKelasAbsensiRow[],
    rekap: { terisi: 0, tugas: 0, kosong: 0 },
    calendarStatus: {
      isEffective: calendarStatus.isEffective,
      reason: calendarStatus.reason,
      category: calendarStatus.category,
    },
    hasActiveBlocks: false,
  }

  if (!calendarStatus.isEffective || hari === 7 || (kelas.kbm_nonaktif_mulai && kelas.kbm_nonaktif_mulai <= tanggal)) {
    return { error: null, data: baseData }
  }

  if (!ta?.id) return { error: 'Tahun ajaran aktif belum diatur.', data: null }

  const slots = getSlots(ta.jam_pelajaran, hari)
  const [exceptions, jadwalRes] = await Promise.all([
    getKbmExceptionsForDate(db, tanggal),
    db.prepare(`
      SELECT jm.penugasan_id, jm.jam_ke,
        pm.guru_id,
        guru.nama_lengkap as guru_nama,
        mp.nama_mapel,
        ag.materi,
        dtk.tugas
      FROM jadwal_mengajar jm
      JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      JOIN "user" guru ON pm.guru_id = guru.id
      LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
      LEFT JOIN delegasi_tugas_kelas dtk ON dtk.penugasan_mengajar_id = jm.penugasan_id
        AND dtk.delegasi_id IN (
          SELECT dt.id FROM delegasi_tugas dt WHERE dt.dari_user_id = pm.guru_id AND dt.tanggal = ?
        )
      WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ? AND jm.hari = ?
      ORDER BY jm.jam_ke ASC
    `).bind(tanggal, tanggal, kelasId, ta.id, hari).all<any>(),
  ])

  const grouped = new Map<string, any[]>()
  for (const row of jadwalRes.results || []) {
    if (!grouped.has(row.penugasan_id)) grouped.set(row.penugasan_id, [])
    grouped.get(row.penugasan_id)!.push(row)
  }

  const occupied = new Set<number>()
  for (const rows of grouped.values()) {
    const jamList = rows.map(row => Number(row.jam_ke)).sort((a, b) => a - b)
    const first = rows[0]
    const exception = findTeachingBlockException(
      exceptions,
      { id: kelas.id, tingkat: Number(kelas.tingkat) },
      jamList[0],
      jamList[jamList.length - 1]
    )
    if (exception) continue

    const slotSelesai = slots.find(s => s.id === jamList[jamList.length - 1])
    const guruStatus = resolveGuruStatus({
      agendaStatus: first.agenda_status,
      hasDelegasi: !!first.delegasi_kelas_id,
      delegasiAlasan: first.delegasi_alasan,
      ended: isTeachingBlockEnded(tanggal, slotSelesai),
    })

    for (const jam of jamList) {
      if (jam < 1 || jam > 10) continue
      occupied.add(jam)
      baseRows[jam - 1] = {
        jam_ke: jam,
        jam_label: String(jam),
        mapel_nama: first.nama_mapel || '',
        pokok_bahasan: first.materi || '',
        tugas: first.tugas || '',
        guru_nama: first.guru_nama || '',
        paraf: '',
        guru_status: guruStatus,
      }
    }
  }

  const terisi = baseRows.filter(row => row.pokok_bahasan.trim()).length
  const tugas = baseRows.filter(row => row.tugas.trim()).length
  const activeJam = occupied.size
  const hasActiveBlocks = activeJam > 0 && slots.length > 0
  const statusRows = hasActiveBlocks ? await getNonHadirRowsForAgenda(db, kelasId, tanggal) : []

  return {
    error: null,
    data: {
      ...baseData,
      agendaRows: baseRows,
      absensiRows: statusRows,
      rekap: {
        terisi,
        tugas,
        kosong: Math.max(0, activeJam - terisi - tugas),
      },
      hasActiveBlocks,
    },
  }
}

export async function getAgendaKelasHari(kelasId: string, tanggal = todayWIB()): Promise<{ error: string | null; data: AgendaKelasPageData | null }> {
  const access = await ensureAccess()
  if (access.error || !access.db) return { error: access.error, data: null }
  return buildAgendaKelasHari(access.db, kelasId, tanggal)
}

export async function getAdjacentAgendaKelasDate(kelasId: string, tanggal: string, direction: 'prev' | 'next') {
  assertDate(tanggal)
  const access = await ensureAccess()
  if (access.error || !access.db) return { error: access.error, tanggal: null }

  const step = direction === 'next' ? 1 : -1
  const cursor = new Date(tanggal + 'T00:00:00')

  for (let i = 0; i < 120; i++) {
    cursor.setDate(cursor.getDate() + step)
    const candidate = cursor.toISOString().split('T')[0]
    const res = await buildAgendaKelasHari(access.db, kelasId, candidate)
    if (res.data?.calendarStatus.isEffective && res.data.hasActiveBlocks) {
      return { error: null, tanggal: candidate }
    }
    if (res.error) return { error: res.error, tanggal: null }
  }

  return { error: 'Tanggal efektif terdekat tidak ditemukan.', tanggal: null }
}

export async function getAgendaKelasCetakBulanan(kelasIds: string[], months: string[]) {
  // Backwards compatibility helper that runs everything in one go but with the new optimized batch runner
  const jobListRes = await getAgendaKelasCetakJobs(kelasIds, months)
  if (jobListRes.error) return { error: jobListRes.error, pages: [] }
  if (jobListRes.jobs.length === 0) return { error: null, pages: [] }
  return getAgendaKelasCetakBatch(jobListRes.jobs)
}

export async function getAgendaKelasCetakJobs(kelasIds: string[], months: string[]) {
  const uniqueKelas = Array.from(new Set(kelasIds.filter(Boolean)))
  const uniqueMonths = Array.from(new Set(months.filter(Boolean)))
  if (uniqueKelas.length === 0) return { error: 'Pilih minimal satu kelas.', jobs: [] }
  if (uniqueMonths.length === 0) return { error: 'Pilih minimal satu bulan.', jobs: [] }

  const access = await ensureAccess()
  if (access.error || !access.db) return { error: access.error, jobs: [] }
  const db = access.db

  // Fetch kelas labels and details in bulk
  const placeholders = uniqueKelas.map(() => '?').join(',')
  const kelasRows = await db.prepare(`
    SELECT id, tingkat, nomor_kelas, kelompok FROM kelas WHERE id IN (${placeholders})
  `).bind(...uniqueKelas).all<any>()
  const kelasMap = new Map(kelasRows.results?.map(r => [r.id, formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok)]) || [])

  const jobs: { kelasId: string; kelasLabel: string; tanggal: string }[] = []

  for (const month of uniqueMonths) {
    const { start, end } = monthRange(month)
    const effectiveDates = await getEffectiveDatesInRange(db, start, end)
    for (const kelasId of uniqueKelas) {
      const label = kelasMap.get(kelasId) || kelasId
      for (const tanggal of effectiveDates) {
        jobs.push({ kelasId, kelasLabel: label, tanggal })
      }
    }
  }

  return { error: null, jobs }
}

export async function getAgendaKelasCetakBatch(jobs: { kelasId: string; tanggal: string }[]) {
  if (jobs.length === 0) return { error: null, pages: [] }

  const access = await ensureAccess()
  if (access.error || !access.db) return { error: access.error, pages: [] }
  const db = access.db

  // 1. Pre-fetch the active Ta
  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta?.id) return { error: 'Tahun ajaran aktif belum diatur.', pages: [] }

  // 2. Pre-fetch all kelas details in the jobs list
  const uniqueKelasIds = Array.from(new Set(jobs.map(j => j.kelasId)))
  const kelasPlaceholders = uniqueKelasIds.map(() => '?').join(',')
  const kelasRows = await db.prepare(`
    SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kbm_nonaktif_mulai,
      wali.nama_lengkap as wali_kelas_nama,
      wali.nip as wali_kelas_nip,
      km.nama_lengkap as km_nama
    FROM kelas k
    LEFT JOIN "user" wali ON k.wali_kelas_id = wali.id
    LEFT JOIN siswa km ON k.km_siswa_id = km.id AND km.kelas_id = k.id AND km.status = 'aktif'
    WHERE k.id IN (${kelasPlaceholders})
  `).bind(...uniqueKelasIds).all<any>()
  const kelasMap = new Map(kelasRows.results?.map(r => [r.id, r]) || [])

  // 3. Pre-fetch all active students in these classes to avoid fetching them per-day
  const siswaRows = await db.prepare(`
    SELECT id, nama_lengkap, kelas_id
    FROM siswa
    WHERE kelas_id IN (${kelasPlaceholders}) AND status = 'aktif'
    ORDER BY nama_lengkap ASC
  `).bind(...uniqueKelasIds).all<any>()
  
  const siswaByKelas = new Map<string, { id: string; nama_lengkap: string }[]>()
  for (const s of siswaRows.results || []) {
    if (!siswaByKelas.has(s.kelas_id)) siswaByKelas.set(s.kelas_id, [])
    siswaByKelas.get(s.kelas_id)!.push(s)
  }

  // 4. Pre-fetch kalender events for the range of dates in jobs
  const dates = jobs.map(j => j.tanggal).sort()
  const minDate = dates[0]
  const maxDate = dates[dates.length - 1]
  
  const events = await getKalenderEventsForRange(db, minDate, maxDate)
  const eventsByDate = new Map<string, KalenderEvent[]>()
  for (const event of events) {
    for (const tanggal of enumerateDateStrings(event.start_date, event.end_date)) {
      if (tanggal < minDate || tanggal > maxDate) continue
      if (!eventsByDate.has(tanggal)) eventsByDate.set(tanggal, [])
      eventsByDate.get(tanggal)!.push(event)
    }
  }

  // 5. Pre-fetch KBM exceptions for the range of dates in jobs
  const exceptions = await getKbmExceptionsForRange(db, minDate, maxDate)
  const exceptionsByDate = new Map<string, KbmException[]>()
  for (const exc of exceptions) {
    if (!exceptionsByDate.has(exc.tanggal)) exceptionsByDate.set(exc.tanggal, [])
    exceptionsByDate.get(exc.tanggal)!.push(exc)
  }

  // 6. Process all jobs in parallel
  const pages: AgendaKelasPageData[] = []
  
  const results = await Promise.all(jobs.map(async (job) => {
    const { kelasId, tanggal } = job
    const kelas = kelasMap.get(kelasId)
    if (!kelas) return { error: `Kelas ${kelasId} tidak ditemukan.`, data: null }

    const hari = hariNum(tanggal)
    const hariNama = HARI[hari] || ''

    // Resolve calendar status from our pre-fetched events
    const dayEvents = eventsByDate.get(tanggal) || []
    const manual = dayEvents.find(e => e.source === 'manual')
    const official = dayEvents.find(e => e.source === 'official')
    const decidingEvent = manual || official || dayEvents[0] || null
    const isSunday = hari === 7

    let isEffective = true
    let reason: string | null = null
    let category: string | null = null
    if (decidingEvent) {
      isEffective = Number(decidingEvent.is_effective) === 1
      reason = decidingEvent.title
      category = decidingEvent.category
    } else if (isSunday) {
      isEffective = false
      reason = 'Minggu'
      category = 'MINGGU'
    }

    const baseRows: AgendaKelasRow[] = Array.from({ length: 10 }).map((_, index) => ({
      jam_ke: index + 1,
      jam_label: String(index + 1),
      mapel_nama: '',
      pokok_bahasan: '',
      tugas: '',
      guru_nama: '',
      paraf: '',
      guru_status: '',
    }))

    const classLabel = formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok)
    const baseData = {
      kelas: {
        id: kelas.id,
        label: classLabel,
        wali_kelas_nama: kelas.wali_kelas_nama || '..................................................',
        wali_kelas_nip: kelas.wali_kelas_nip || null,
        km_nama: kelas.km_nama || '..................................................',
      },
      kepala: KEPALA_MADRASAH,
      tanggal,
      hariNama,
      agendaRows: baseRows,
      absensiRows: [] as AgendaKelasAbsensiRow[],
      rekap: { terisi: 0, tugas: 0, kosong: 0 },
      calendarStatus: {
        isEffective,
        reason,
        category: category as any,
      },
      hasActiveBlocks: false,
    }

    if (!isEffective || hari === 7 || (kelas.kbm_nonaktif_mulai && kelas.kbm_nonaktif_mulai <= tanggal)) {
      return { error: null, data: baseData }
    }

    const slots = getSlots(ta.jam_pelajaran, hari)

    // Resolve exceptions for this date
    const dayExceptions = exceptionsByDate.get(tanggal) || []
    
    // Fetch day-specific teaching schedule
    const [jadwalRes] = await Promise.all([
      db.prepare(`
        SELECT jm.penugasan_id, jm.jam_ke,
          pm.guru_id,
          guru.nama_lengkap as guru_nama,
          mp.nama_mapel,
          ag.materi,
          ag.status as agenda_status,
          dtk.id as delegasi_kelas_id,
          dt.alasan_ketidakhadiran as delegasi_alasan,
          dtk.tugas
        FROM jadwal_mengajar jm
        JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
        JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
        JOIN "user" guru ON pm.guru_id = guru.id
        LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
        LEFT JOIN delegasi_tugas dt ON dt.dari_user_id = pm.guru_id AND dt.tanggal = ?
        LEFT JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id AND dtk.penugasan_mengajar_id = jm.penugasan_id
        WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ? AND jm.hari = ?
        ORDER BY jm.jam_ke ASC
      `).bind(tanggal, tanggal, kelasId, ta.id, hari).all<any>()
    ])

    const grouped = new Map<string, any[]>()
    for (const row of jadwalRes.results || []) {
      if (!grouped.has(row.penugasan_id)) grouped.set(row.penugasan_id, [])
      grouped.get(row.penugasan_id)!.push(row)
    }

    const occupied = new Set<number>()
    for (const rows of grouped.values()) {
      const jamList = rows.map(row => Number(row.jam_ke)).sort((a, b) => a - b)
      const first = rows[0]
      const exception = findTeachingBlockException(
        dayExceptions,
        { id: kelas.id, tingkat: Number(kelas.tingkat) },
        jamList[0],
        jamList[jamList.length - 1]
      )
      if (exception) continue

      const slotSelesai = slots.find(s => s.id === jamList[jamList.length - 1])
      const guruStatus = resolveGuruStatus({
        agendaStatus: first.agenda_status,
        hasDelegasi: !!first.delegasi_kelas_id,
        delegasiAlasan: first.delegasi_alasan,
        ended: isTeachingBlockEnded(tanggal, slotSelesai),
      })

      for (const jam of jamList) {
        if (jam < 1 || jam > 10) continue
        occupied.add(jam)
        baseRows[jam - 1] = {
          jam_ke: jam,
          jam_label: String(jam),
          mapel_nama: first.nama_mapel || '',
          pokok_bahasan: first.materi || '',
          tugas: first.tugas || '',
          guru_nama: first.guru_nama || '',
          paraf: '',
          guru_status: guruStatus,
        }
      }
    }

    const terisi = baseRows.filter(row => row.pokok_bahasan.trim()).length
    const tugas = baseRows.filter(row => row.tugas.trim()).length
    const activeJam = occupied.size
    const hasActiveBlocks = activeJam > 0 && slots.length > 0
    
    let statusRows: AgendaKelasAbsensiRow[] = []
    if (hasActiveBlocks) {
      // Build attendance rows using pre-fetched student list
      const students = siswaByKelas.get(kelasId) || []
      const [waliRes, absensiRes, izinRes, izinKeluarRes] = await Promise.all([
        db.prepare(`
          SELECT kawk.siswa_id, kawk.status, kawk.keterangan
          FROM keterangan_absensi_wali_kelas kawk
          JOIN siswa s ON kawk.siswa_id = s.id
          WHERE s.kelas_id = ? AND kawk.tanggal = ?
        `).bind(kelasId, tanggal).all<any>(),
        db.prepare(`
          SELECT ab.siswa_id, ab.status, ab.catatan
          FROM absensi_siswa ab
          JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
          WHERE pm.kelas_id = ? AND ab.tanggal = ? AND ab.status IN ('SAKIT','IZIN','ALFA')
          ORDER BY ab.jam_ke_mulai ASC
        `).bind(kelasId, tanggal).all<any>(),
        db.prepare(`
          SELECT itk.siswa_id, itk.alasan, itk.keterangan
          FROM izin_tidak_masuk_kelas itk
          JOIN siswa s ON itk.siswa_id = s.id
          WHERE s.kelas_id = ? AND itk.tanggal = ?
        `).bind(kelasId, tanggal).all<any>(),
        db.prepare(`
          SELECT ik.siswa_id, ik.keterangan
          FROM izin_keluar_komplek ik
          JOIN siswa s ON ik.siswa_id = s.id
          WHERE s.kelas_id = ?
            AND substr(ik.waktu_keluar, 1, 10) <= ?
            AND (ik.waktu_kembali IS NULL OR substr(ik.waktu_kembali, 1, 10) >= ?)
        `).bind(kelasId, tanggal, tanggal).all<any>(),
      ])

      const waliMap = new Map<string, { status: string; keterangan: string }>()
      for (const row of waliRes.results || []) {
        waliMap.set(row.siswa_id, { status: row.status, keterangan: row.keterangan || '' })
      }

      const statusMap = new Map<string, string[]>()
      const noteMap = new Map<string, string[]>()
      const pushStatus = (siswaId: string, status: string, note?: string) => {
        if (!statusMap.has(siswaId)) statusMap.set(siswaId, [])
        statusMap.get(siswaId)!.push(status)
        if (note) {
          if (!noteMap.has(siswaId)) noteMap.set(siswaId, [])
          noteMap.get(siswaId)!.push(note)
        }
      }

      for (const row of absensiRes.results || []) pushStatus(row.siswa_id, row.status, row.catatan || '')
      for (const row of izinRes.results || []) pushStatus(row.siswa_id, 'IZIN', [row.alasan, row.keterangan].filter(Boolean).join(': '))
      for (const row of izinKeluarRes.results || []) pushStatus(row.siswa_id, 'IZIN', row.keterangan || 'Keluar komplek')

      for (const siswa of students) {
        const wali = waliMap.get(siswa.id)
        const status = wali
          ? choosePrintableStatus([wali.status])
          : choosePrintableStatus(statusMap.get(siswa.id) || [])

        if (!status) continue

        const notes = wali?.keterangan
          ? [wali.keterangan]
          : Array.from(new Set(noteMap.get(siswa.id) || [])).filter(Boolean)

        statusRows.push({
          no: statusRows.length + 1,
          nama: abbreviateStudentName(siswa.nama_lengkap),
          status,
          sakit: status === 'SAKIT',
          izin: status === 'IZIN',
          alfa: status === 'ALFA',
          ket: notes.slice(0, 2).join('; '),
        })
      }
    }

    return {
      error: null,
      data: {
        ...baseData,
        agendaRows: baseRows,
        absensiRows: statusRows,
        rekap: {
          terisi,
          tugas,
          kosong: Math.max(0, activeJam - terisi - tugas),
        },
        hasActiveBlocks,
      }
    }
  }))

  for (const r of results) {
    if (r.error) return { error: r.error, pages: [] }
    if (r.data?.hasActiveBlocks) pages.push(r.data)
  }

  return { error: null, pages }
}
