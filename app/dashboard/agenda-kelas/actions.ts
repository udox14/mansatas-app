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
import { getFinalAttendanceForClass, type FinalAttendanceStatus } from '@/lib/wali-kelas-attendance'
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
    ORDER BY k.tingkat ASC, k.kelompok ASC, CAST(k.nomor_kelas AS INTEGER) ASC
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

export async function getAgendaKelasHari(kelasId: string, tanggal = todayWIB()): Promise<{ error: string | null; data: AgendaKelasPageData | null }> {
  assertDate(tanggal)
  const access = await ensureAccess()
  if (access.error || !access.db) return { error: access.error, data: null }
  const db = access.db
  const hari = hariNum(tanggal)
  const hariNama = HARI[hari] || ''

  const kelas = await db.prepare(`
    SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kbm_nonaktif_mulai,
      wali.nama_lengkap as wali_kelas_nama,
      wali.nip as wali_kelas_nip,
      km.nama_lengkap as km_nama
    FROM kelas k
    LEFT JOIN "user" wali ON k.wali_kelas_id = wali.id
    LEFT JOIN siswa km ON k.km_siswa_id = km.id AND km.kelas_id = k.id AND km.status = 'aktif'
    WHERE k.id = ?
  `).bind(kelasId).first<any>()
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
  const calendarStatus = await getKalenderDateStatus(db, tanggal)
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

  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta?.id) return { error: 'Tahun ajaran aktif belum diatur.', data: null }

  const slots = getSlots(ta.jam_pelajaran, hari)
  const exceptions = await getKbmExceptionsForDate(db, tanggal)
  const jadwalRes = await db.prepare(`
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
  `).bind(tanggal, tanggal, kelasId, ta.id, hari).all<any>()

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

  const attendance = await getFinalAttendanceForClass(db, kelasId, tanggal, tanggal)
  const statusRows: AgendaKelasAbsensiRow[] = []
  for (const [index, siswa] of (attendance?.siswa || []).entries()) {
    const dayStatus = attendance?.statusByStudent.get(siswa.id)?.find(item => item.tanggal === tanggal)
    const status = dayStatus?.status_akhir || 'HADIR'
    statusRows.push({
      no: index + 1,
      nama: abbreviateStudentName(siswa.nama_lengkap),
      status,
      sakit: status === 'SAKIT',
      izin: status === 'IZIN',
      alfa: status === 'ALFA',
      ket: statusKet(status, dayStatus?.sumber_status),
    })
  }

  const terisi = baseRows.filter(row => row.pokok_bahasan.trim()).length
  const tugas = baseRows.filter(row => row.tugas.trim()).length
  const activeJam = occupied.size

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
      hasActiveBlocks: activeJam > 0 && slots.length > 0,
    },
  }
}

export async function getAdjacentAgendaKelasDate(kelasId: string, tanggal: string, direction: 'prev' | 'next') {
  assertDate(tanggal)
  const step = direction === 'next' ? 1 : -1
  const cursor = new Date(tanggal + 'T00:00:00')

  for (let i = 0; i < 120; i++) {
    cursor.setDate(cursor.getDate() + step)
    const candidate = cursor.toISOString().split('T')[0]
    const res = await getAgendaKelasHari(kelasId, candidate)
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

  const pages: AgendaKelasPageData[] = []
  for (const kelasId of uniqueKelas) {
    for (const month of uniqueMonths) {
      const { start, end } = monthRange(month)
      const access = await ensureAccess()
      if (access.error || !access.db) return { error: access.error, pages: [] }
      const effectiveDates = await getEffectiveDatesInRange(access.db, start, end)
      for (const tanggal of effectiveDates) {
        const res = await getAgendaKelasHari(kelasId, tanggal)
        if (res.error) return { error: res.error, pages: [] }
        if (res.data?.hasActiveBlocks) pages.push(res.data)
      }
    }
  }

  return { error: null, pages }
}

