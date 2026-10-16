'use server'

import { getDB as getRawDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'

async function getDB() {
  await requireActionAccess('rekap-absensi', 'read')
  return getRawDB()
}
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { formatNamaKelas } from '@/lib/utils'
import {
  getAccessibleWaliKelasClasses,
  getFinalAttendanceForClass,
  getFinalAttendanceForStudent,
  type FinalAttendanceDetail,
} from '@/lib/wali-kelas-attendance'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'
import {
  findSlotException,
  getEffectiveDatesInRange,
  getKbmExceptionsForDate,
  getKalenderDateStatus,
} from '@/lib/kalender-pendidikan'
import { attendanceStatusCode } from '@/lib/attendance-status'
import { liveAttendanceSummary } from '@/lib/attendance-live-summary'

const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const MAX_RANGE_DAYS = 31

type RekapScope = {
  isAdmin: boolean
  allowedClassIds: string[]
}

type KelasRow = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  wali_kelas_nama?: string | null
}

type Summary = {
  hadir: number
  sakit: number
  izin: number
  alfa: number
  bolos: number
  perlu_konfirmasi_wali: number
  belum_ada_input: number
  belum_ada_data: number
}

function emptySummary(): Summary {
  return {
    hadir: 0,
    sakit: 0,
    izin: 0,
    alfa: 0,
    bolos: 0,
    perlu_konfirmasi_wali: 0,
    belum_ada_input: 0,
    belum_ada_data: 0,
  }
}

function hariNum(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 7 : day
}

function statusKey(status: string | null | undefined): keyof Summary {
  if (status === 'HADIR') return 'hadir'
  if (status === 'SAKIT') return 'sakit'
  if (status === 'IZIN') return 'izin'
  if (status === 'ALFA') return 'alfa'
  if (status === 'PARSIAL' || status === 'BOLOS') return 'bolos'
  if (status === 'PERLU_KONFIRMASI_WALI' || status === 'PERLU KONFIRMASI WALI') return 'perlu_konfirmasi_wali'
  if (status === 'BELUM_ADA_INPUT' || status === 'BELUM ADA INPUT') return 'belum_ada_input'
  return 'belum_ada_data'
}

function displayStatus(status: string | null | undefined) {
  if (status === 'PARSIAL') return 'BOLOS'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'PERLU KONFIRMASI WALI'
  if (status === 'BELUM_ADA_INPUT') return 'BELUM ADA INPUT'
  return status || 'BELUM_ADA_DATA'
}

function addStatus(summary: Summary, status: string | null | undefined) {
  summary[statusKey(status)] += 1
}

function percentage(hadir: number, total: number) {
  return total > 0 ? Math.round((hadir / total) * 100) : 0
}

function getSlotsHari(raw: string, hari: number): SlotJam[] {
  try {
    const list = JSON.parse(raw) as PolaJam[]
    return list.find(p => p.hari.includes(hari))?.slots ?? []
  } catch {
    return []
  }
}

function parseJamIzin(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite)
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : []
  } catch {
    const n = Number(raw)
    return Number.isFinite(n) ? [n] : []
  }
}

function validateRange(tglMulai: string, tglSelesai: string) {
  if (!tglMulai || !tglSelesai || tglMulai > tglSelesai) return 'Rentang tanggal tidak valid.'
  const start = new Date(tglMulai + 'T00:00:00')
  const end = new Date(tglSelesai + 'T00:00:00')
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  if (days > MAX_RANGE_DAYS) return `Rentang maksimal ${MAX_RANGE_DAYS} hari.`
  return null
}

async function getRekapScope(db: D1Database, userId: string, allowLiveSummary = false): Promise<RekapScope> {
  const roles = await getUserRoles(db, userId)
  const isAdmin = roles.some(role => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))
  if (isAdmin) return { isAdmin: true, allowedClassIds: [] }
  // Pramubakti only receive class totals through the live summary endpoint.
  if (allowLiveSummary && roles.includes('pramubakti')) return { isAdmin: true, allowedClassIds: [] }

  if (roles.includes('guru_bk')) {
    const taAktif = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
    if (!taAktif?.id) return { isAdmin: false, allowedClassIds: [] }
    const rows = await db.prepare(`
      SELECT DISTINCT kelas_id
      FROM kelas_binaan_bk
      WHERE guru_bk_id = ? AND tahun_ajaran_id = ?
    `).bind(userId, taAktif.id).all<{ kelas_id: string }>()
    return { isAdmin: false, allowedClassIds: (rows.results || []).map(row => row.kelas_id).filter(Boolean) }
  }

  const waliKelas = await getAccessibleWaliKelasClasses(db, userId, roles)
  const allowed = new Set(waliKelas.map(k => k.id))
  const guruRes = await db.prepare(`
    SELECT DISTINCT kelas_id
    FROM penugasan_mengajar
    WHERE guru_id = ?
  `).bind(userId).all<{ kelas_id: string }>()

  for (const row of guruRes.results || []) {
    if (row.kelas_id) allowed.add(row.kelas_id)
  }

  return { isAdmin: false, allowedClassIds: Array.from(allowed) }
}

async function getClassRows(db: D1Database, scope: RekapScope, tingkat?: number): Promise<Array<KelasRow & { label: string }>> {
  const params: unknown[] = []
  const where: string[] = []
  if (tingkat) {
    where.push('k.tingkat = ?')
    params.push(tingkat)
  }
  if (!scope.isAdmin) {
    if (scope.allowedClassIds.length === 0) return []
    where.push(`k.id IN (${scope.allowedClassIds.map(() => '?').join(',')})`)
    params.push(...scope.allowedClassIds)
  }

  const rows = await db.prepare(`
    SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, u.nama_lengkap as wali_kelas_nama
    FROM kelas k
    LEFT JOIN "user" u ON k.wali_kelas_id = u.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY k.tingkat, k.kelompok, CAST(k.nomor_kelas AS INTEGER)
  `).bind(...params).all<KelasRow>()

  return (rows.results || []).map(k => ({
    ...k,
    label: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
  }))
}

async function canAccessClass(db: D1Database, scope: RekapScope, kelasId: string) {
  if (scope.isAdmin) return true
  return scope.allowedClassIds.includes(kelasId)
}

async function getIzinMapForClass(db: D1Database, kelasId: string, startDate: string, endDate: string) {
  const rows = await db.prepare(`
    SELECT itk.siswa_id, itk.tanggal, itk.jam_pelajaran, itk.alasan, itk.keterangan
    FROM izin_tidak_masuk_kelas itk
    JOIN siswa s ON itk.siswa_id = s.id
    WHERE s.kelas_id = ? AND itk.tanggal BETWEEN ? AND ?
  `).bind(kelasId, startDate, endDate).all<any>()

  const map = new Map<string, Array<{ jam: number[]; alasan: string; keterangan: string | null }>>()
  for (const row of rows.results || []) {
    const key = `${row.siswa_id}__${row.tanggal}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({
      jam: parseJamIzin(row.jam_pelajaran),
      alasan: row.alasan || 'Izin',
      keterangan: row.keterangan || null,
    })
  }
  return map
}

function applyIzinStatus(item: FinalAttendanceDetail, _izinItems?: Array<{ jam: number[]; alasan: string; keterangan: string | null }>) {
  return item.status_akhir
}

function noteFrom(item: FinalAttendanceDetail, izinItems?: Array<{ jam: number[]; alasan: string; keterangan: string | null }>) {
  const notes = [
    item.keterangan_wali_kelas,
    ...item.detail_guru.map(detail => detail.catatan).filter(Boolean),
    ...(izinItems || []).map(izin => [izin.alasan, izin.keterangan].filter(Boolean).join(': ')),
  ].filter(Boolean)
  return Array.from(new Set(notes)).join(' | ')
}

function classSummaryFromDaily(classData: NonNullable<Awaited<ReturnType<typeof getFinalAttendanceForClass>>>, izinMap: Map<string, any[]>) {
  const summary = emptySummary()
  for (const siswa of classData.siswa) {
    const item = classData.statusByStudent.get(siswa.id)?.[0]
    const status = item ? applyIzinStatus(item, izinMap.get(`${siswa.id}__${item.tanggal}`)) : 'BELUM_ADA_DATA'
    addStatus(summary, status)
  }
  return summary
}

function summarizeDays(days: FinalAttendanceDetail[], izinMap: Map<string, any[]>) {
  const summary = emptySummary()
  for (const day of days) {
    const status = applyIzinStatus(day, izinMap.get(`${day.siswa_id}__${day.tanggal}`))
    addStatus(summary, status)
  }
  return summary
}

export async function getRekapFilterOptions() {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { kelas: [], siswa: [], angkatan: [] }

  const scope = await getRekapScope(db, user.id)
  const roles = await getUserRoles(db, user.id)
  const liveOnly = roles.includes('pramubakti') && !scope.isAdmin && scope.allowedClassIds.length === 0
  const kelas = await getClassRows(db, await getRekapScope(db, user.id, true))

  return {
    liveOnly,
    angkatan: Array.from(new Set(kelas.map(k => k.tingkat))).sort((a, b) => a - b),
    kelas: kelas.map(k => ({
      id: k.id,
      tingkat: k.tingkat,
      label: k.label,
      wali_kelas_nama: k.wali_kelas_nama || null,
    })),
    siswa: [],
  }
}

export async function getKelasByAngkatan(tingkat?: number) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }
  const scope = await getRekapScope(db, user.id)
  return { error: null, data: await getClassRows(db, scope, tingkat) }
}

export async function getSiswaByKelas(kelasId: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }
  const scope = await getRekapScope(db, user.id)
  if (!(await canAccessClass(db, scope, kelasId))) return { error: 'Anda tidak punya akses ke kelas ini.', data: [] }

  const rows = await db.prepare(`
    SELECT id, nama_lengkap, nisn, nis_lokal
    FROM siswa
    WHERE kelas_id = ? AND status = 'aktif'
    ORDER BY nama_lengkap
  `).bind(kelasId).all<any>()
  return { error: null, data: rows.results || [] }
}

export async function getAbsensiPerKelas(tanggal: string, tingkat?: number, view: 'harian' | 'saat-ini' = 'harian') {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return { error: null, data: [], calendarStatus }
  }

  const scope = await getRekapScope(db, user.id, view === 'saat-ini')
  const kelasList = await getClassRows(db, scope, tingkat)
  const data: any[] = []

  for (const kelas of kelasList) {
    if (view === 'saat-ini') {
      const matrix = await buildClassDailyMatrix(db, kelas.id, tanggal)
      if (matrix.error) continue
      const summary = liveAttendanceSummary(tanggal, matrix.slots, matrix.rows)
      data.push({ kelas_id: kelas.id, tingkat: kelas.tingkat, label: kelas.label,
        wali_kelas_nama: kelas.wali_kelas_nama || null, total: matrix.rows.length,
        ...summary, persentase_hadir: percentage(summary.hadir, matrix.rows.length) })
      continue
    }
    const classData = await getFinalAttendanceForClass(db, kelas.id, tanggal, tanggal)
    if (!classData) continue
    const izinMap = await getIzinMapForClass(db, kelas.id, tanggal, tanggal)
    const summary = classSummaryFromDaily(classData, izinMap)
    data.push({
      kelas_id: kelas.id,
      tingkat: kelas.tingkat,
      label: kelas.label,
      wali_kelas_nama: kelas.wali_kelas_nama || null,
      total: classData.siswa.length,
      ...summary,
      persentase_hadir: percentage(summary.hadir, classData.siswa.length),
    })
  }

  return { error: null, data }
}

export async function getAbsensiPerKelasRentang(tingkat: number, tglMulai: string, tglSelesai: string) {
  const err = validateRange(tglMulai, tglSelesai)
  if (err) return { error: err, data: [] }

  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const effectiveDates = await getEffectiveDatesInRange(db, tglMulai, tglSelesai)
  const scope = await getRekapScope(db, user.id)
  const kelasList = await getClassRows(db, scope, tingkat)
  const data: any[] = []

  for (const kelas of kelasList) {
    const classData = await getFinalAttendanceForClass(db, kelas.id, tglMulai, tglSelesai)
    if (!classData) continue
    const izinMap = await getIzinMapForClass(db, kelas.id, tglMulai, tglSelesai)
    const summary = emptySummary()
    for (const siswa of classData.siswa) {
      const days = classData.statusByStudent.get(siswa.id) || []
      for (const day of days) {
        addStatus(summary, applyIzinStatus(day, izinMap.get(`${siswa.id}__${day.tanggal}`)))
      }
    }
    const totalStatus = classData.siswa.length * classData.dates.length
    data.push({
      kelas_id: kelas.id,
      tingkat: kelas.tingkat,
      label: kelas.label,
      wali_kelas_nama: kelas.wali_kelas_nama || null,
      total_siswa: classData.siswa.length,
      total_hari_efektif: classData.dates.length,
      total_status: totalStatus,
      ...summary,
      persentase_hadir: percentage(summary.hadir, totalStatus),
    })
  }

  return { error: null, data, effectiveDates }
}

async function buildClassDailyMatrix(db: D1Database, kelasId: string, tanggal: string) {
  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return { error: null, rows: [], slots: [], kelas: null, calendarStatus }
  }

  const classData = await getFinalAttendanceForClass(db, kelasId, tanggal, tanggal)
  if (!classData) return { error: 'Kelas tidak ditemukan.', rows: [], slots: [], kelas: null }

  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  const hari = hariNum(new Date(tanggal + 'T00:00:00'))
  const slots = ta ? getSlotsHari(ta.jam_pelajaran || '[]', hari) : []
  const kbmExceptions = await getKbmExceptionsForDate(db, tanggal)
  const jadwalRes = ta ? await db.prepare(`
    SELECT jm.jam_ke, jm.penugasan_id, mp.nama_mapel, mp.kode_mapel, mp.kode_asc
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN kelas k ON pm.kelas_id = k.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
    ORDER BY jm.jam_ke
  `).bind(kelasId, ta.id, hari, tanggal).all<any>() : { results: [] }

  const jadwalByJam = new Map<number, { penugasan_id: string; nama_mapel: string; kode_mapel: string | null; kode_asc: string | null }>()
  for (const row of jadwalRes.results || []) {
    jadwalByJam.set(row.jam_ke, {
      penugasan_id: row.penugasan_id,
      nama_mapel: row.nama_mapel,
      kode_mapel: row.kode_mapel || null,
      kode_asc: row.kode_asc || null,
    })
  }

  const sesiRes = await db.prepare(`
    SELECT asg.penugasan_id
    FROM absensi_sesi_guru asg
    JOIN penugasan_mengajar pm ON asg.penugasan_id = pm.id
    WHERE pm.kelas_id = ? AND asg.tanggal = ?
  `).bind(kelasId, tanggal).all<any>()
  const submitted = new Set((sesiRes.results || []).map((row: any) => row.penugasan_id))

  const absenRes = await db.prepare(`
    SELECT ab.siswa_id, ab.penugasan_id, ab.status, ab.catatan, ab.jam_ke_mulai, ab.jam_ke_selesai,
      mp.nama_mapel
    FROM absensi_siswa ab
    JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    WHERE pm.kelas_id = ? AND ab.tanggal = ?
  `).bind(kelasId, tanggal).all<any>()

  const absenMap = new Map<string, any>()
  for (const row of absenRes.results || []) {
    for (let jam = row.jam_ke_mulai; jam <= row.jam_ke_selesai; jam++) {
      absenMap.set(`${row.siswa_id}__${jam}`, row)
    }
  }

  const izinMap = await getIzinMapForClass(db, kelasId, tanggal, tanggal)

  const rows = classData.siswa.map(siswa => {
    const finalDay = classData.statusByStudent.get(siswa.id)?.[0]
    const izinItems = izinMap.get(`${siswa.id}__${tanggal}`) || []
    const cells = slots.map(slot => {
      const exception = findSlotException(kbmExceptions, { id: kelasId, tingkat: Number(classData.kelas.tingkat) }, slot.id)
      if (exception) {
        return {
          jam_ke: slot.id,
          status: 'KBM_EXCEPTION',
          label: exception.judul,
          nama_mapel: exception.judul,
          catatan: exception.description || `Pengecualian KBM jam ${exception.jam_ke_mulai}-${exception.jam_ke_selesai}`,
        }
      }
      const jadwal = jadwalByJam.get(slot.id)
      if (!jadwal) return { jam_ke: slot.id, status: '-', label: '-', nama_mapel: null, catatan: null }

      const block = finalDay?.block_statuses.find(item => item.penugasan_id === jadwal.penugasan_id)
      const absen = absenMap.get(`${siswa.id}__${slot.id}`)
      const permission = finalDay?.detail_guru.find(item => item.sumber === 'perizinan_siswa' &&
        item.jam_ke_mulai <= slot.id && item.jam_ke_selesai >= slot.id)
      const status = block?.status || (submitted.has(jadwal.penugasan_id) ? 'HADIR' : 'BELUM_ADA_INPUT')
      const catatan = permission?.catatan || absen?.catatan || null

      return {
        jam_ke: slot.id,
        status,
        teacher_submitted: submitted.has(jadwal.penugasan_id) || Boolean(absen),
        label: displayStatus(status),
        nama_mapel: jadwal.nama_mapel,
        catatan,
      }
    })

    const statusHarian = finalDay
      ? displayStatus(applyIzinStatus(finalDay, izinItems))
      : 'BELUM_ADA_DATA'

    return {
      siswa_id: siswa.id,
      nama_lengkap: siswa.nama_lengkap,
      nisn: siswa.nisn,
      status_harian: statusHarian,
      is_daily_final: finalDay?.is_daily_final || false,
      kbm_end_at: finalDay?.kbm_end_at || null,
      sumber_status: finalDay?.sumber_status || 'belum_ada_data',
      submitted_blok: finalDay?.submitted_blok || 0,
      pending_blok: finalDay?.pending_blok || 0,
      total_blok: finalDay?.total_blok || 0,
      status_reason: finalDay?.status_reason || 'Belum ada data status harian.',
      keterangan: finalDay ? noteFrom(finalDay, izinItems) : '',
      cells,
    }
  })

  const slotsWithMapel = slots.map(slot => ({
    ...slot,
    nama_mapel: findSlotException(kbmExceptions, { id: kelasId, tingkat: Number(classData.kelas.tingkat) }, slot.id)?.judul || jadwalByJam.get(slot.id)?.nama_mapel || null,
    kode_mapel: jadwalByJam.get(slot.id)?.kode_mapel || jadwalByJam.get(slot.id)?.kode_asc || null,
  }))

  return {
    error: null,
    kelas: classData.kelas,
    slots: slotsWithMapel,
    rows,
    calendarStatus: null,
  }
}

export async function getAbsensiSiswaKelasHarian(kelasId: string, tanggal: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', rows: [], slots: [] }
  const scope = await getRekapScope(db, user.id)
  if (!(await canAccessClass(db, scope, kelasId))) return { error: 'Anda tidak punya akses ke kelas ini.', rows: [], slots: [] }
  return buildClassDailyMatrix(db, kelasId, tanggal)
}

export async function getAbsensiSiswaKelasRentang(kelasId: string, tglMulai: string, tglSelesai: string) {
  const err = validateRange(tglMulai, tglSelesai)
  if (err) return { error: err, rows: [] }

  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', rows: [] }
  const scope = await getRekapScope(db, user.id)
  if (!(await canAccessClass(db, scope, kelasId))) return { error: 'Anda tidak punya akses ke kelas ini.', rows: [] }

  const classData = await getFinalAttendanceForClass(db, kelasId, tglMulai, tglSelesai)
  if (!classData) return { error: 'Kelas tidak ditemukan.', rows: [] }

  const izinMap = await getIzinMapForClass(db, kelasId, tglMulai, tglSelesai)
  const effectiveDates = await getEffectiveDatesInRange(db, tglMulai, tglSelesai)

  const rows = classData.siswa.map(siswa => {
    const days = (classData.statusByStudent.get(siswa.id) || []).map(day => {
      const izinItems = izinMap.get(`${siswa.id}__${day.tanggal}`) || []
      return {
        tanggal: day.tanggal,
        hariNama: HARI[hariNum(new Date(day.tanggal + 'T00:00:00'))],
        statusHari: displayStatus(applyIzinStatus(day, izinItems)),
        isDailyFinal: day.is_daily_final,
        kbmEndAt: day.kbm_end_at,
        totalBlok: day.total_blok,
        submittedBlok: day.submitted_blok,
        pendingBlok: day.pending_blok,
        sumberStatus: day.sumber_status,
        statusReason: day.status_reason,
        keterangan: noteFrom(day, izinItems),
        detail: day.detail_guru,
      }
    })
    const summary = summarizeDays(classData.statusByStudent.get(siswa.id) || [], izinMap)
    return {
      siswa_id: siswa.id,
      nama_lengkap: siswa.nama_lengkap,
      nisn: siswa.nisn,
      total_hari_efektif: classData.dates.length,
      ...summary,
      persentase_hadir: percentage(summary.hadir, classData.dates.length),
      days,
    }
  })

  return { error: null, kelas: classData.kelas, rows, effectiveDates }
}

type CatatanAbsenStatus = 'SAKIT' | 'IZIN' | 'ALFA'

type TidakHadirFilter = 'SEMUA' | 'SAKIT' | 'IZIN' | 'ALFA'

/**
 * Daftar kejadian tidak hadir, lintas kelas yang dapat diakses pengguna.
 * Satu baris mewakili satu siswa pada satu tanggal efektif pembelajaran.
 */
export async function getSiswaTidakHadir(params: {
  tglMulai: string
  tglSelesai: string
  status?: TidakHadirFilter
  tingkat?: number
  kelasId?: string
}) {
  const err = validateRange(params.tglMulai, params.tglSelesai)
  if (err) return { error: err, data: [], summary: { total: 0, sakit: 0, izin: 0, alfa: 0 } }

  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [], summary: { total: 0, sakit: 0, izin: 0, alfa: 0 } }

  const scope = await getRekapScope(db, user.id)
  const selectedStatus: TidakHadirFilter = ['SAKIT', 'IZIN', 'ALFA'].includes(params.status || '')
    ? params.status as TidakHadirFilter
    : 'SEMUA'

  if (params.kelasId && !(await canAccessClass(db, scope, params.kelasId))) {
    return { error: 'Anda tidak punya akses ke kelas ini.', data: [], summary: { total: 0, sakit: 0, izin: 0, alfa: 0 } }
  }

  const availableClasses = await getClassRows(db, scope, params.tingkat)
  const kelasList = params.kelasId
    ? availableClasses.filter(kelas => kelas.id === params.kelasId)
    : availableClasses
  const allowedStatuses = new Set(selectedStatus === 'SEMUA' ? ['SAKIT', 'IZIN', 'ALFA'] : [selectedStatus])
  const data: Array<{
    siswa_id: string
    nama_lengkap: string
    nisn: string | null
    kelas_id: string
    kelas_label: string
    tanggal: string
    hariNama: string
    status: 'SAKIT' | 'IZIN' | 'ALFA'
    keterangan: string
    sumberStatus: string
  }> = []
  const summary = { total: 0, sakit: 0, izin: 0, alfa: 0 }

  for (const kelas of kelasList) {
    const classData = await getFinalAttendanceForClass(db, kelas.id, params.tglMulai, params.tglSelesai)
    if (!classData) continue
    const izinMap = await getIzinMapForClass(db, kelas.id, params.tglMulai, params.tglSelesai)

    for (const siswa of classData.siswa) {
      for (const day of classData.statusByStudent.get(siswa.id) || []) {
        const status = applyIzinStatus(day, izinMap.get(`${siswa.id}__${day.tanggal}`))
        if (!allowedStatuses.has(status)) continue

        const absentStatus = status as 'SAKIT' | 'IZIN' | 'ALFA'
        summary.total += 1
        if (absentStatus === 'SAKIT') summary.sakit += 1
        if (absentStatus === 'IZIN') summary.izin += 1
        if (absentStatus === 'ALFA') summary.alfa += 1
        data.push({
          siswa_id: siswa.id,
          nama_lengkap: siswa.nama_lengkap,
          nisn: siswa.nisn || null,
          kelas_id: kelas.id,
          kelas_label: kelas.label,
          tanggal: day.tanggal,
          hariNama: HARI[hariNum(new Date(day.tanggal + 'T00:00:00'))],
          status: absentStatus,
          keterangan: noteFrom(day, izinMap.get(`${siswa.id}__${day.tanggal}`)),
          sumberStatus: day.sumber_status,
        })
      }
    }
  }

  data.sort((a, b) => b.tanggal.localeCompare(a.tanggal)
    || a.kelas_label.localeCompare(b.kelas_label, 'id')
    || a.nama_lengkap.localeCompare(b.nama_lengkap, 'id'))

  return { error: null, data, summary }
}

/**
 * Catatan mentah Sakit/Izin/Alfa yang ditulis guru saat mengisi absensi.
 * Data ini sengaja tidak mengikuti status final harian siswa.
 */
export async function getCatatanAbsenOlehGuru(params: {
  tglMulai: string
  tglSelesai: string
  statuses?: CatatanAbsenStatus[]
  tingkat?: number
  kelasId: string
  siswaId?: string
}) {
  const emptyResult = { error: null as string | null, data: [], summary: { total: 0, sakit: 0, izin: 0, alfa: 0 } }
  const err = validateRange(params.tglMulai, params.tglSelesai)
  if (err) return { ...emptyResult, error: err }

  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { ...emptyResult, error: 'Unauthorized' }

  const scope = await getRekapScope(db, user.id)
  if (!params.kelasId) return { ...emptyResult, error: 'Pilih kelas terlebih dahulu.' }
  if (!(await canAccessClass(db, scope, params.kelasId))) {
    return { ...emptyResult, error: 'Anda tidak punya akses ke kelas ini.' }
  }

  const availableClasses = await getClassRows(db, scope, params.tingkat)
  const kelasList = availableClasses.filter(kelas => kelas.id === params.kelasId)
  if (kelasList.length === 0) return emptyResult

  let selectedSiswa: { id: string; nama_lengkap: string; nisn: string | null } | null = null
  if (params.siswaId) {
    selectedSiswa = await db.prepare('SELECT id, nama_lengkap, nisn FROM siswa WHERE id = ? AND kelas_id = ? LIMIT 1')
      .bind(params.siswaId, params.kelasId)
      .first<{ id: string; nama_lengkap: string; nisn: string | null }>()
    if (!selectedSiswa) return { ...emptyResult, error: 'Siswa tidak ditemukan pada kelas yang dipilih.' }
  }

  const allowedStatuses: CatatanAbsenStatus[] = ['SAKIT', 'IZIN', 'ALFA']
  const statuses = allowedStatuses.filter(status => params.statuses?.includes(status) ?? true)
  if (statuses.length === 0) return emptyResult

  const classIds = kelasList.map(kelas => kelas.id)
  const rows = await db.prepare(`
    SELECT ab.id, ab.tanggal, ab.siswa_id, ab.status, ab.catatan,
      ab.jam_ke_mulai, ab.jam_ke_selesai,
      s.nama_lengkap, s.nisn, pm.kelas_id,
      mp.nama_mapel,
      COALESCE(input_user.nama_lengkap, assignment_user.nama_lengkap) as guru_nama
    FROM absensi_siswa ab
    JOIN siswa s ON s.id = ab.siswa_id
    JOIN penugasan_mengajar pm ON pm.id = ab.penugasan_id
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    LEFT JOIN "user" input_user ON input_user.id = ab.diinput_oleh
    LEFT JOIN "user" assignment_user ON assignment_user.id = pm.guru_id
    WHERE pm.kelas_id IN (${classIds.map(() => '?').join(',')})
      AND ab.tanggal BETWEEN ? AND ?
      AND ab.status IN (${statuses.map(() => '?').join(',')})
      AND TRIM(COALESCE(ab.catatan, '')) <> ''
      ${params.siswaId ? 'AND ab.siswa_id = ?' : ''}
  `).bind(...classIds, params.tglMulai, params.tglSelesai, ...statuses, ...(params.siswaId ? [params.siswaId] : [])).all<any>()

  const kelasById = new Map(kelasList.map(kelas => [kelas.id, kelas.label]))
  const data = (rows.results || []).map(row => ({
    id: row.id,
    tanggal: row.tanggal,
    hariNama: HARI[hariNum(new Date(row.tanggal + 'T00:00:00'))],
    siswa_id: row.siswa_id,
    nama_lengkap: row.nama_lengkap,
    nisn: row.nisn || null,
    kelas_id: row.kelas_id,
    kelas_label: kelasById.get(row.kelas_id) || '-',
    status: row.status as CatatanAbsenStatus,
    nama_mapel: row.nama_mapel || '-',
    jam_ke_mulai: Number(row.jam_ke_mulai) || 0,
    jam_ke_selesai: Number(row.jam_ke_selesai) || Number(row.jam_ke_mulai) || 0,
    guru_nama: row.guru_nama || '-',
    catatan: String(row.catatan).trim(),
  }))

  data.sort((a, b) => b.tanggal.localeCompare(a.tanggal)
    || a.kelas_label.localeCompare(b.kelas_label, 'id')
    || a.nama_lengkap.localeCompare(b.nama_lengkap, 'id')
    || a.jam_ke_mulai - b.jam_ke_mulai)

  const summary = data.reduce((total, row) => {
    total.total += 1
    if (row.status === 'SAKIT') total.sakit += 1
    if (row.status === 'IZIN') total.izin += 1
    if (row.status === 'ALFA') total.alfa += 1
    return total
  }, { total: 0, sakit: 0, izin: 0, alfa: 0 })

  return {
    error: null,
    data,
    summary,
    scope: {
      mode: selectedSiswa ? 'siswa' : 'kelas',
      kelas_label: kelasList[0].label,
      siswa: selectedSiswa,
    },
  }
}

export async function getAbsensiHeatmap(tingkat: number, tanggal: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [], slots: [] }
  const scope = await getRekapScope(db, user.id)
  const kelasList = await getClassRows(db, scope, tingkat)

  const ta = await db.prepare('SELECT jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  const hari = hariNum(new Date(tanggal + 'T00:00:00'))
  const slots = ta ? getSlotsHari(ta.jam_pelajaran || '[]', hari) : []
  const data: any[] = []

  for (const kelas of kelasList) {
    const matrix = await buildClassDailyMatrix(db, kelas.id, tanggal)
    const cells = slots.map(slot => {
      const detail = (matrix.rows || [])
        .map((row: any) => {
          const cell = row.cells.find((c: any) => c.jam_ke === slot.id)
          return cell && !['HADIR', '-', 'BELUM_ADA_DATA', 'KBM_EXCEPTION'].includes(cell.status)
            ? { siswa_id: row.siswa_id, nama_lengkap: row.nama_lengkap, nisn: row.nisn, ...cell }
            : null
        })
        .filter(Boolean)
      const belumAdaData = (matrix.rows || []).filter((row: any) => row.cells.find((c: any) => c.jam_ke === slot.id)?.status === 'BELUM_ADA_DATA').length
      const exceptionCell = (matrix.rows || [])[0]?.cells?.find((c: any) => c.jam_ke === slot.id && c.status === 'KBM_EXCEPTION')
      return {
        jam_ke: slot.id,
        bermasalah: detail.length,
        belum_ada_data: belumAdaData,
        exception: exceptionCell ? { label: exceptionCell.label, catatan: exceptionCell.catatan } : null,
        detail,
      }
    })
    data.push({ kelas_id: kelas.id, label: kelas.label, total_siswa: matrix.rows?.length || 0, cells })
  }

  return { error: null, data, slots, hariNama: HARI[hari] || '' }
}

export async function getAbsensiPerSiswa(siswaId: string, tglMulai: string, tglSelesai: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const scope = await getRekapScope(db, user.id)
  if (!scope.isAdmin) {
    const siswaCheck = await db.prepare('SELECT kelas_id FROM siswa WHERE id = ?').bind(siswaId).first<{ kelas_id: string }>()
    if (!siswaCheck?.kelas_id || !scope.allowedClassIds.includes(siswaCheck.kelas_id)) {
      return { error: 'Anda tidak punya akses ke data siswa ini.', data: [] }
    }
  }

  const result = await getFinalAttendanceForStudent(db, siswaId, tglMulai, tglSelesai)
  if (!result) return { error: 'Siswa tidak ditemukan', data: [] }
  const izinMap = await getIzinMapForClass(db, result.siswa.kelas_id, tglMulai, tglSelesai)

  const days = result.statuses
    .filter(day => day.total_blok > 0 || day.wali_status !== null || day.detail_guru.length > 0)
    .map(day => {
      const izinItems = izinMap.get(`${day.siswa_id}__${day.tanggal}`) || []
      const statusHari = displayStatus(applyIzinStatus(day, izinItems))
      const blokHadir = day.block_statuses.filter(block => block.submitted && block.status === 'HADIR').length
      const blokTidakHadir = day.block_statuses.filter(block => block.submitted && block.status !== 'HADIR').length

      return {
        tanggal: day.tanggal,
        hariNama: HARI[hariNum(new Date(day.tanggal + 'T00:00:00'))],
        totalBlok: day.total_blok,
        submittedBlok: day.submitted_blok,
        pendingBlok: day.pending_blok,
        blokHadir,
        blokTidakHadir,
        statusHari,
        isDailyFinal: day.is_daily_final,
        kbmEndAt: day.kbm_end_at,
        statusGuru: day.guru_status,
        statusWaliKelas: day.wali_status,
        sumberStatus: day.sumber_status,
        statusReason: day.status_reason,
        keteranganWaliKelas: day.keterangan_wali_kelas,
        keterangan: noteFrom(day, izinItems),
        detail: day.detail_guru,
      }
    })

  const summary = emptySummary()
  for (const day of days) addStatus(summary, day.statusHari)

  return {
    error: null,
    siswa: { nama: result.siswa.nama_lengkap, nisn: result.siswa.nisn, nis_lokal: result.siswa.nis_lokal, kelas: result.kelas_label },
    days,
    summary: { ...summary, parsial: summary.bolos },
    totalHari: days.length,
  }
}

export async function getCetakRekapKelas(params: {
  mode: 'hari' | 'rentang'
  tanggal?: string
  tglMulai?: string
  tglSelesai?: string
  kelasId: string
}) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', sections: [] }
  const scope = await getRekapScope(db, user.id)
  const kelasList = (await getClassRows(db, scope)).filter(k => k.id === params.kelasId)
  if (kelasList.length === 0) return { error: 'Pilih satu kelas yang dapat diakses.', sections: [] }

  const sections: any[] = []
  for (const kelas of kelasList) {
    if (params.mode === 'hari') {
      const matrix = await buildClassDailyMatrix(db, kelas.id, params.tanggal || '')
      sections.push({ mode: 'hari', tanggal: params.tanggal, ...matrix, kelas })
    } else {
      const data = await getAbsensiSiswaKelasRentang(kelas.id, params.tglMulai || '', params.tglSelesai || '')
      sections.push({ mode: 'rentang', kelas, tglMulai: params.tglMulai, tglSelesai: params.tglSelesai, ...data })
    }
  }
  return { error: null, sections }
}

export async function getCetakRekapSiswa(siswaId: string, tglMulai: string, tglSelesai: string) {
  const [rekap, waliKelas] = await Promise.all([
    getAbsensiPerSiswa(siswaId, tglMulai, tglSelesai),
    getWaliKelasForSiswa(siswaId),
  ])
  return { rekap, waliKelas }
}

type MonitoringPrintMode = 'bulanan' | 'semester'

const MONITORING_CODES = ['H', 'S', 'I', 'A', 'B', 'K', 'BI', 'BL'] as const
type MonitoringCode = typeof MONITORING_CODES[number]

function emptyMonitoringTotals(): Record<MonitoringCode, number> {
  return { H: 0, S: 0, I: 0, A: 0, B: 0, K: 0, BI: 0, BL: 0 }
}

function monitoringPrintMark(status: string | null | undefined): MonitoringCode {
  const code = attendanceStatusCode(status)
  return MONITORING_CODES.includes(code as MonitoringCode) ? code as MonitoringCode : 'BL'
}

function monthLabel(month: number) {
  return ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUNI', 'JULI', 'AGT', 'SEP', 'OKT', 'NOV', 'DES'][month - 1] || ''
}

export async function getCetakMonitoringSiswa(params: {
  kelasId: string
  mode: MonitoringPrintMode
  tglMulai: string
  tglSelesai: string
  months?: number[]
  labelPeriode?: string
}) {
  if (!params.kelasId) return { error: 'Pilih satu kelas terlebih dahulu.', sections: [] }
  if (!params.tglMulai || !params.tglSelesai || params.tglMulai > params.tglSelesai) {
    return { error: 'Rentang tanggal tidak valid.', sections: [] }
  }

  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', sections: [] }

  const scope = await getRekapScope(db, user.id)
  const kelasList = (await getClassRows(db, scope)).filter(kelas => kelas.id === params.kelasId)

  if (kelasList.length === 0) {
    return { error: 'Tidak ada kelas yang bisa dicetak.', sections: [] }
  }

  const sections: any[] = []
  for (const kelas of kelasList) {
    if (!(await canAccessClass(db, scope, kelas.id))) continue
    const classData = await getFinalAttendanceForClass(db, kelas.id, params.tglMulai, params.tglSelesai)
    if (!classData) continue

    const dates = classData.dates
    const months = params.months?.length
      ? params.months.map(month => ({ month, label: monthLabel(month) }))
      : Array.from(new Set(dates.map(tanggal => Number(tanggal.slice(5, 7)))))
        .map(month => ({ month, label: monthLabel(month) }))

    const rows = classData.siswa.map((siswa, idx) => {
      const dayMap = new Map((classData.statusByStudent.get(siswa.id) || []).map(day => [day.tanggal, day]))
      const totals = emptyMonitoringTotals()
      const cells = dates.map(tanggal => {
        const mark = monitoringPrintMark(dayMap.get(tanggal)?.status_akhir)
        totals[mark] += 1
        return { tanggal, mark }
      })

      const monthTotals = months.map(({ month, label }) => {
        const total = emptyMonitoringTotals()
        for (const tanggal of dates) {
          if (Number(tanggal.slice(5, 7)) !== month) continue
          const mark = monitoringPrintMark(dayMap.get(tanggal)?.status_akhir)
          total[mark] += 1
        }
        return { month, label, ...total }
      })

      const semesterTotal = monthTotals.reduce((acc, item) => {
        for (const code of MONITORING_CODES) acc[code] += item[code]
        return acc
      }, emptyMonitoringTotals())

      return {
        siswa_id: siswa.id,
        urut: idx + 1,
        nis: siswa.nis_lokal || siswa.nisn || '-',
        nama_lengkap: siswa.nama_lengkap,
        jenis_kelamin: siswa.jenis_kelamin || '',
        cells,
        totals,
        monthTotals,
        semesterTotal,
      }
    })

    sections.push({
      mode: params.mode,
      kelas: classData.kelas,
      tglMulai: params.tglMulai,
      tglSelesai: params.tglSelesai,
      labelPeriode: params.labelPeriode,
      dates,
      months,
      rows,
    })
  }

  return {
    error: null,
    sections,
  }
}

export async function getWaliKelasForSiswa(siswaId: string) {
  const db = await getDB()
  const row = await db.prepare(`
    SELECT u.nama_lengkap as wali_kelas_nama
    FROM siswa s
    JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN "user" u ON k.wali_kelas_id = u.id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()
  return row?.wali_kelas_nama ?? null
}
