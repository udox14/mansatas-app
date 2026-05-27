'use server'

import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { formatNamaKelas } from '@/lib/utils'
import { todayWIB } from '@/lib/time'
import {
  findTeachingBlockException,
  getEffectiveDatesInRange,
  getKbmExceptionsForDate,
  getKalenderDateStatus,
} from '@/lib/kalender-pendidikan'
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
  const uniqueKelas = Array.from(new Set(kelasIds.filter(Boolean)))
  const uniqueMonths = Array.from(new Set(months.filter(Boolean)))
  if (uniqueKelas.length === 0) return { error: 'Pilih minimal satu kelas.', pages: [] }
  if (uniqueMonths.length === 0) return { error: 'Pilih minimal satu bulan.', pages: [] }

  const access = await ensureAccess()
  if (access.error || !access.db) return { error: access.error, pages: [] }
  const db = access.db

  const pages: AgendaKelasPageData[] = []
  for (const kelasId of uniqueKelas) {
    for (const month of uniqueMonths) {
      const { start, end } = monthRange(month)
      const effectiveDates = await getEffectiveDatesInRange(db, start, end)
      for (let i = 0; i < effectiveDates.length; i += 6) {
        const chunk = effectiveDates.slice(i, i + 6)
        const results = await Promise.all(chunk.map(tanggal => buildAgendaKelasHari(db, kelasId, tanggal)))
        for (const res of results) {
          if (res.error) return { error: res.error, pages: [] }
          if (res.data?.hasActiveBlocks) pages.push(res.data)
        }
      }
    }
  }

  return { error: null, pages }
}
