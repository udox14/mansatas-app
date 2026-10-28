// Lokasi: app/dashboard/monitoring-agenda/actions.ts
'use server'

import { enrichTeacherLeaveSessions, validateTeacherLeaveReason } from '@/lib/teacher-leave-db'
import { isSchoolLeave, teacherPerformance, type TeacherLeaveMetadata } from '@/lib/teacher-leave'
import { dbUpdate, dbInsert } from '@/utils/db'
import { getDB as getRawDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'
import { logActivity } from '@/lib/activity-log'
import { getUserRoles } from '@/lib/features'
import { canReviewForgottenAgendaForRoles, type ForgottenAgendaRequestStatus } from '@/lib/agenda-forgotten'

async function getDB() {
  await requireActionAccess('monitoring-agenda', 'read')
  return getRawDB()
}
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'
import {
  getEffectiveDatesInRange,
  getKbmExceptionsForDate,
  getKbmExceptionsForRange,
  getKalenderDateStatus,
  splitTeachingSlotsByExceptions,
} from '@/lib/kalender-pendidikan'
import { currentTimeWIB, nowWIBISO, todayWIB } from '@/lib/time'
import { filterAndCountTeacherAttendanceHistory, type TeacherAttendanceHistoryFilter, type TeacherAttendanceHistoryStatus } from '@/lib/teacher-attendance-history'

export type { ForgottenAgendaRequestStatus } from '@/lib/agenda-forgotten'

async function canReviewForgottenAgenda(db: D1Database, userId: string, roles?: string[]) {
  const resolvedRoles = roles ?? await getUserRoles(db, userId)
  if (canReviewForgottenAgendaForRoles(resolvedRoles, null)) return true
  if (!resolvedRoles.includes('wakamad')) return false
  const structural = await db.prepare('SELECT jabatan_struktural_id FROM "user" WHERE id = ?')
    .bind(userId).first<{ jabatan_struktural_id: string | null }>()
  return canReviewForgottenAgendaForRoles(resolvedRoles, structural?.jabatan_struktural_id)
}

// ============================================================
// HELPER
// ============================================================
function parsePolaJam(raw: string): PolaJam[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function getSlotsForHari(polaList: PolaJam[], hari: number): SlotJam[] {
  return polaList.find(p => p.hari.includes(hari))?.slots ?? []
}

function getHariFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  return day === 0 ? 7 : day
}

const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const EDITABLE_AGENDA_STATUSES = new Set(['TEPAT_WAKTU', 'TELAT', 'ALFA', 'SAKIT', 'IZIN'])

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

// ============================================================
// 1. MONITORING HARIAN — semua guru yang punya jadwal di tanggal tertentu
//    Menampilkan siapa sudah isi & siapa ALFA
//    Efisien: 1 query join, tanpa N+1
// ============================================================
export async function getMonitoringHarian(
  tanggal: string,
  filterMode: 'semua' | 'guru' | 'kelas',
  filterId?: string,
  jamKe?: number
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  if (hari === 7) return { error: null, data: [], hariNama: 'Minggu' }

  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return {
      error: null,
      data: [],
      hariNama: HARI_NAMA[hari] || '',
      calendarStatus: {
        isEffective: false,
        reason: calendarStatus.reason,
        category: calendarStatus.category,
      },
    }
  }

  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', data: [] }

  const polaList = parsePolaJam(ta.jam_pelajaran || '[]')
  const slots = getSlotsForHari(polaList, hari)
  const kbmExceptions = await getKbmExceptionsForDate(db, tanggal)

  // Query: semua jadwal hari itu + LEFT JOIN agenda_guru + LEFT JOIN delegasi_tugas
  let sql = `
    SELECT
      jm.penugasan_id,
      jm.jam_ke,
      pm.guru_id,
      u.nama_lengkap as guru_nama,
      mp.nama_mapel,
      k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
      ag.id as agenda_id,
      ag.materi,
      ag.foto_url,
      ag.status,
      ag.waktu_input,
      ag.catatan_admin,
      ag.ppl_user_id,
      EXISTS (SELECT 1 FROM absensi_sesi_guru ass WHERE ass.penugasan_id = jm.penugasan_id AND ass.tanggal = ?) AS sudah_absen_siswa,
      u_ppl.nama_lengkap as ppl_nama,
      dtk.id as delegasi_kelas_id,
      dt_info.alasan_ketidakhadiran,
      dt_info.deskripsi_ketidakhadiran,
      COALESCE(u_pelaksana_kelas.nama_lengkap, u_pelaksana_delegasi.nama_lengkap) as pelaksana_nama
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN "user" u ON pm.guru_id = u.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    LEFT JOIN "user" u_ppl ON u_ppl.id = ag.ppl_user_id
    LEFT JOIN delegasi_tugas_kelas dtk ON dtk.penugasan_mengajar_id = jm.penugasan_id
      AND dtk.delegasi_id IN (SELECT dt.id FROM delegasi_tugas dt WHERE dt.dari_user_id = pm.guru_id AND dt.tanggal = ?)
    LEFT JOIN delegasi_tugas dt_info ON dtk.delegasi_id = dt_info.id
    LEFT JOIN "user" u_pelaksana_delegasi ON dt_info.kepada_user_id = u_pelaksana_delegasi.id
    LEFT JOIN "user" u_pelaksana_kelas ON dtk.pelaksana_user_id = u_pelaksana_kelas.id
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
  `
  const params: unknown[] = [tanggal, tanggal, tanggal, ta.id, hari, tanggal]

  if (filterMode === 'guru' && filterId) {
    sql += ' AND pm.guru_id = ?'
    params.push(filterId)
  } else if (filterMode === 'kelas' && filterId) {
    sql += ' AND pm.kelas_id = ?'
    params.push(filterId)
  }

  if (typeof jamKe === 'number' && Number.isFinite(jamKe)) {
    sql += `
      AND EXISTS (
        SELECT 1
        FROM jadwal_mengajar jm_filter
        WHERE jm_filter.tahun_ajaran_id = jm.tahun_ajaran_id
          AND jm_filter.hari = jm.hari
          AND jm_filter.penugasan_id = jm.penugasan_id
          AND jm_filter.jam_ke = ?
      )
    `
    params.push(jamKe)
  }

  if (filterMode === 'kelas' && filterId) {
    sql += ' ORDER BY jm.jam_ke ASC, u.nama_lengkap ASC'
  } else {
    sql += ' ORDER BY u.nama_lengkap ASC, jm.jam_ke ASC'
  }

  const result = await db.prepare(sql).bind(...params).all<any>()
  const rows = result.results || []

  // Group per penugasan
  const grouped = new Map<string, any[]>()
  for (const r of rows) {
    if (!grouped.has(r.penugasan_id)) grouped.set(r.penugasan_id, [])
    grouped.get(r.penugasan_id)!.push(r)
  }

  const data: any[] = []
  for (const [pid, pRows] of grouped) {
    const jamList = pRows.map(r => r.jam_ke).sort((a: number, b: number) => a - b)
    const first = pRows[0]
    const slotState = splitTeachingSlotsByExceptions(
      kbmExceptions,
      { id: first.kelas_id, tingkat: Number(first.tingkat) },
      jamList
    )
    if (slotState.activeJamKe.length === 0) continue
    if (typeof jamKe === 'number' && Number.isFinite(jamKe) && !slotState.activeJamKe.includes(jamKe)) continue
    const jamMulai = slotState.activeJamKe[0]
    const jamSelesai = slotState.activeJamKe[slotState.activeJamKe.length - 1]
    const slotMulai = slots.find(s => s.id === jamMulai)
    const slotSelesai = slots.find(s => s.id === jamSelesai)

    // Tentukan status: agenda > alasan penugasan > BELUM_MENGISI/ALFA
    let status: string
    if (first.agenda_id) {
      status = first.status
    } else if (first.delegasi_kelas_id) {
      status = first.alasan_ketidakhadiran === 'SAKIT' ? 'SAKIT' : 'IZIN'
    } else {
      status = isTeachingBlockEnded(tanggal, slotSelesai) ? 'ALFA' : 'BELUM_MENGISI'
    }

    data.push({
      penugasan_id: pid,
      guru_id: first.guru_id,
      guru_nama: first.guru_nama,
      mapel_nama: first.nama_mapel,
      kelas_id: first.kelas_id,
      kelas_label: formatNamaKelas(first.tingkat, first.nomor_kelas, first.kelompok),
      jam_ke_mulai: jamMulai,
      jam_ke_selesai: jamSelesai,
      jam_label: jamMulai === jamSelesai ? `Jam ${jamMulai}` : `Jam ${jamMulai}-${jamSelesai}`,
      slot_mulai: slotMulai?.mulai ?? '-',
      slot_selesai: slotSelesai?.selesai ?? '-',
      // Agenda data (null jika belum isi = ALFA/TUGAS)
      agenda_id: first.agenda_id,
      materi: first.materi,
      foto_url: first.foto_url,
      status,
      waktu_input: first.waktu_input,
      catatan_admin: first.catatan_admin,
      sudah_absen_siswa: Boolean(first.sudah_absen_siswa),
      ppl_user_id: first.ppl_user_id || null,
      ppl_nama: first.ppl_nama || null,
      pelaksana_nama: first.pelaksana_nama || null,
      alasan_ketidakhadiran: first.alasan_ketidakhadiran || null,
      deskripsi_ketidakhadiran: first.deskripsi_ketidakhadiran || null,
    })
  }

  if (filterMode === 'kelas' && filterId) {
    data.sort((a, b) =>
      a.jam_ke_mulai - b.jam_ke_mulai ||
      a.jam_ke_selesai - b.jam_ke_selesai ||
      a.guru_nama.localeCompare(b.guru_nama)
    )
  }

  return { error: null, data: await enrichTeacherLeaveSessions(db, data.map(row => ({ ...row, tanggal }))), hariNama: HARI_NAMA[hari] || '', slots }
}

export async function getMonitoringHarianSlots(tanggal: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', slots: [], hariNama: '' }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  if (hari === 7) return { error: null, slots: [], hariNama: 'Minggu' }

  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return {
      error: null,
      slots: [],
      hariNama: HARI_NAMA[hari] || '',
      calendarStatus: {
        isEffective: false,
        reason: calendarStatus.reason,
        category: calendarStatus.category,
      },
    }
  }

  const ta = await db.prepare(
    'SELECT jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', slots: [], hariNama: HARI_NAMA[hari] || '' }

  const polaList = parsePolaJam(ta.jam_pelajaran || '[]')
  return { error: null, slots: getSlotsForHari(polaList, hari), hariNama: HARI_NAMA[hari] || '' }
}

// ============================================================
// 2. DAFTAR GURU & KELAS (untuk filter dropdown)
// ============================================================
export async function getFilterOptions() {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { guru: [], kelas: [] }

  const [guruRes, kelasRes] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT u.id, u.nama_lengkap
      FROM penugasan_mengajar pm
      JOIN "user" u ON pm.guru_id = u.id
      WHERE pm.tahun_ajaran_id = ?
      ORDER BY u.nama_lengkap
    `).bind(ta.id).all<any>(),
    db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat, kelompok, nomor_kelas').all<any>(),
  ])

  return {
    guru: (guruRes.results || []).map((g: any) => ({ id: g.id, nama: g.nama_lengkap })),
    kelas: (kelasRes.results || []).map((k: any) => ({
      id: k.id,
      label: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
    })),
  }
}

function validHistoryRange(start: string, end: string) {
  const valid = (value: string) => /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  if (!valid(start) || !valid(end) || start > end) throw new Error('Rentang tanggal tidak valid.')
}

export async function getAgendaHistoryTeachers() {
  const db = await getDB()
  const result = await db.prepare(`
    SELECT DISTINCT u.id, u.nama_lengkap AS nama
    FROM penugasan_mengajar pm
    JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id AND ta.is_active = 1
    JOIN "user" u ON u.id = pm.guru_id
    ORDER BY u.nama_lengkap
  `).all<{ id: string; nama: string }>()
  return result.results || []
}

type MonthlyTeacherLeaveRow = {
  id: string; source: 'agenda' | 'delegasi'; guru_id: string; guru_nama: string
  tanggal: string; waktu_input: string | null; deskripsi: string | null
  alasan_nama: string | null; alasan_izin_guru_id: string | null
  kepentingan_sekolah: boolean; kelas: string; mapel: string; jam: string
  target: { penugasan_id: string; tanggal: string } | { delegasi_id: string }
}

async function getMonthlyTeacherLeaveRows(db: D1Database, month: string): Promise<MonthlyTeacherLeaveRow[]> {
  const start = `${month}-01`
  const end = monthEndForHistory(month)
  const [agenda, delegation] = await Promise.all([
    db.prepare(`SELECT ag.id, ag.guru_id, u.nama_lengkap AS guru_nama, ag.tanggal,
      ag.penugasan_id, ag.jam_ke_mulai, ag.jam_ke_selesai, ag.waktu_input,
      ag.catatan_admin AS deskripsi,
      COALESCE(ag.alasan_izin_guru_id, (
        SELECT dt.alasan_izin_guru_id FROM delegasi_tugas dt
        JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
        WHERE dtk.penugasan_mengajar_id = ag.penugasan_id
          AND dt.dari_user_id = ag.guru_id AND dt.tanggal = ag.tanggal
        ORDER BY dt.created_at DESC, dt.id DESC LIMIT 1
      )) AS alasan_izin_guru_id,
      r.nama AS alasan_nama, r.kepentingan_sekolah, mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok
      FROM agenda_guru ag JOIN "user" u ON u.id = ag.guru_id
      JOIN penugasan_mengajar pm ON pm.id = ag.penugasan_id
      JOIN mata_pelajaran mp ON mp.id = pm.mapel_id JOIN kelas k ON k.id = pm.kelas_id
      LEFT JOIN alasan_izin_guru r ON r.id = COALESCE(ag.alasan_izin_guru_id, (
        SELECT dt.alasan_izin_guru_id FROM delegasi_tugas dt
        JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
        WHERE dtk.penugasan_mengajar_id = ag.penugasan_id
          AND dt.dari_user_id = ag.guru_id AND dt.tanggal = ag.tanggal
        ORDER BY dt.created_at DESC, dt.id DESC LIMIT 1
      ))
      WHERE ag.status = 'IZIN' AND ag.tanggal BETWEEN ? AND ?
      ORDER BY ag.tanggal, u.nama_lengkap, ag.jam_ke_mulai`).bind(start, end).all<any>(),
    db.prepare(`SELECT dt.id, dt.dari_user_id AS guru_id, u.nama_lengkap AS guru_nama,
      dt.tanggal, dt.created_at AS waktu_input, dt.deskripsi_ketidakhadiran AS deskripsi,
      dt.alasan_izin_guru_id, r.nama AS alasan_nama, r.kepentingan_sekolah,
      dtk.penugasan_mengajar_id AS penugasan_id, mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok
      FROM delegasi_tugas dt JOIN "user" u ON u.id = dt.dari_user_id
      LEFT JOIN alasan_izin_guru r ON r.id = dt.alasan_izin_guru_id
      LEFT JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
      LEFT JOIN penugasan_mengajar pm ON pm.id = dtk.penugasan_mengajar_id
      LEFT JOIN mata_pelajaran mp ON mp.id = pm.mapel_id LEFT JOIN kelas k ON k.id = pm.kelas_id
      WHERE dt.alasan_ketidakhadiran = 'IZIN' AND dt.tanggal BETWEEN ? AND ?
      ORDER BY dt.tanggal, u.nama_lengkap, dt.created_at`).bind(start, end).all<any>(),
  ])
  const rows: MonthlyTeacherLeaveRow[] = (agenda.results || []).map(row => ({
    id: `agenda:${row.id}`, source: 'agenda', guru_id: row.guru_id,
    guru_nama: row.guru_nama, tanggal: row.tanggal, waktu_input: row.waktu_input,
    deskripsi: row.deskripsi, alasan_nama: row.alasan_nama,
    alasan_izin_guru_id: row.alasan_izin_guru_id,
    kepentingan_sekolah: row.kepentingan_sekolah === 1,
    kelas: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
    mapel: row.nama_mapel, jam: `Jam ${row.jam_ke_mulai}–${row.jam_ke_selesai}`,
    target: { penugasan_id: row.penugasan_id, tanggal: row.tanggal },
  }))
  // Satu pengajuan delegasi yang mencakup beberapa kelas tetap ditampilkan sekali.
  const delegated = new Map<string, MonthlyTeacherLeaveRow>()
  for (const row of delegation.results || []) {
    const id = `delegasi:${row.id}`
    const label = row.tingkat == null ? '' : `${formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok)}${row.nama_mapel ? ` · ${row.nama_mapel}` : ''}`
    const existing = delegated.get(id)
    if (existing) {
      if (label && !existing.kelas.includes(label)) existing.kelas += `, ${label}`
    } else delegated.set(id, {
      id, source: 'delegasi', guru_id: row.guru_id, guru_nama: row.guru_nama,
      tanggal: row.tanggal, waktu_input: row.waktu_input, deskripsi: row.deskripsi,
      alasan_nama: row.alasan_nama, alasan_izin_guru_id: row.alasan_izin_guru_id,
      kepentingan_sekolah: row.kepentingan_sekolah === 1,
      kelas: label, mapel: '', jam: '', target: { delegasi_id: row.id },
    })
  }
  return [...rows, ...delegated.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.guru_nama.localeCompare(b.guru_nama))
}

// Riwayat izin membaca catatan asli, termasuk yang berada di luar hari KBM efektif.
// Agenda dan delegasi tetap ditampilkan terpisah agar asal izin dapat ditinjau.
export async function getMonthlyTeacherLeaves(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Bulan tidak valid.')
  return getMonthlyTeacherLeaveRows(await getDB(), month)
}

function monthEndForHistory(month: string) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}

export async function getTeacherAgendaSubmissions(guruId: string, start: string, end: string) {
  validHistoryRange(start, end)
  if (!guruId) throw new Error('Pilih guru terlebih dahulu.')
  const db = await getDB()
  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ id: string; jam_pelajaran: string | null }>()
  if (!ta) return []

  const sessions = await getCanonicalTeacherSessions(db, ta, start, end, { guruId })
  return sessions.map(row => ({
    id: row.agenda_id,
    penugasan_id: row.penugasan_id,
    guru_id: row.guru_id,
    jam_ke_mulai: row.jam_ke_mulai,
    jam_ke_selesai: row.jam_ke_selesai,
    tanggal: row.tanggal,
    jam: `Jam ${row.jam_ke_mulai}–${row.jam_ke_selesai}`,
    kelas: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
    mapel: row.nama_mapel,
    materi: row.materi,
    foto_url: row.foto_url,
    status: row.status,
    waktu_input: row.waktu_input,
    catatan_admin: row.catatan_admin,
    keterangan: row.keterangan,
    sumber: row.sumber,
    alasan_izin_guru_id: row.alasan_izin_guru_id,
    alasan_izin_guru_nama: row.alasan_izin_guru_nama,
    kepentingan_sekolah: row.kepentingan_sekolah,
    sudah_absen_siswa: row.sudah_absen_siswa,
    diubah_oleh_nama: row.diubah_oleh_nama,
    ppl_nama: row.ppl_nama,
  })).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.jam_ke_mulai - b.jam_ke_mulai)
}

// ============================================================
// PENGAJUAN LUPA MENGISI AGENDA
// ============================================================
export async function getForgottenAgendaRequests(status: ForgottenAgendaRequestStatus | 'ALL' = 'PENDING') {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [], canReview: false }
  const db = await getDB()
  const validStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'])
  const normalizedStatus = validStatuses.has(status) ? status : 'PENDING'
  const where = normalizedStatus === 'ALL' ? '' : 'WHERE req.status = ?'
  const query = db.prepare(`
    SELECT req.id, req.guru_id, req.penugasan_id, req.tanggal,
      req.jam_ke_mulai, req.jam_ke_selesai, req.materi, req.status,
      req.submitted_at, req.reviewed_at, req.review_note, req.agenda_id,
      guru.nama_lengkap AS guru_nama,
      reviewer.nama_lengkap AS reviewer_nama,
      mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok,
      (SELECT COUNT(*) FROM agenda_lupa_pengajuan monthly
       WHERE monthly.guru_id = req.guru_id
         AND substr(monthly.tanggal, 1, 7) = substr(req.tanggal, 1, 7)) AS monthly_usage
    FROM agenda_lupa_pengajuan req
    JOIN "user" guru ON guru.id = req.guru_id
    JOIN penugasan_mengajar pm ON pm.id = req.penugasan_id
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    JOIN kelas k ON k.id = pm.kelas_id
    LEFT JOIN "user" reviewer ON reviewer.id = req.reviewed_by
    ${where}
    ORDER BY CASE req.status WHEN 'PENDING' THEN 0 ELSE 1 END,
      req.submitted_at ASC
    LIMIT 500
  `)
  const rows = normalizedStatus === 'ALL'
    ? await query.all<any>()
    : await query.bind(normalizedStatus).all<any>()

  return {
    error: null,
    canReview: await canReviewForgottenAgenda(db, user.id),
    data: (rows.results || []).map(row => ({
      ...row,
      kelas_label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
      monthly_usage: Number(row.monthly_usage || 0),
    })),
  }
}

export async function reviewForgottenAgendaRequest(
  requestId: string,
  decision: 'APPROVE' | 'REJECT',
  note?: string,
): Promise<{ error?: string; success?: string }> {
  const actor = await requireActionAccess('monitoring-agenda', 'update', {
    allowedRoles: ['super_admin', 'wakamad'],
  })
  if (actor.kind !== 'staff') return { error: 'Unauthorized' }
  const db = await getRawDB()
  if (!(await canReviewForgottenAgenda(db, actor.id, actor.roles))) {
    return { error: 'Hanya Super Admin atau Wakamad Kurikulum yang dapat meninjau pengajuan.' }
  }
  if (!requestId || !['APPROVE', 'REJECT'].includes(decision)) return { error: 'Keputusan tidak valid.' }

  const request = await db.prepare(`
    SELECT req.*, guru.nama_lengkap AS guru_nama,
      EXISTS(SELECT 1 FROM agenda_guru ag WHERE ag.penugasan_id = req.penugasan_id AND ag.tanggal = req.tanggal) AS agenda_exists
    FROM agenda_lupa_pengajuan req
    JOIN "user" guru ON guru.id = req.guru_id
    WHERE req.id = ?
  `).bind(requestId).first<any>()
  if (!request) return { error: 'Pengajuan tidak ditemukan.' }
  if (request.status !== 'PENDING') return { error: 'Pengajuan ini sudah ditinjau. Muat ulang antrean.' }

  const reviewedAt = nowWIBISO()
  const cleanNote = String(note || '').trim() || null
  if (Number(request.agenda_exists) === 1) {
    const cancelled = await db.prepare(`UPDATE agenda_lupa_pengajuan
      SET status = 'CANCELLED', reviewed_by = ?, reviewed_at = ?,
        review_note = ?, updated_at = ?
      WHERE id = ? AND status = 'PENDING' RETURNING id`)
      .bind(actor.id, reviewedAt, cleanNote || 'Agenda sudah terisi melalui mekanisme lain.', reviewedAt, requestId)
      .first<{ id: string }>()
    if (!cancelled) return { error: 'Pengajuan sudah berubah. Muat ulang antrean.' }
    await logActivity({
      db, module: 'monitoring-agenda', action: 'cancel_forgotten_agenda_request',
      summary: `Membatalkan pengajuan lupa agenda ${request.guru_nama} karena agenda sudah terisi`,
      entityType: 'agenda_lupa_pengajuan', entityId: requestId,
      entityLabel: `${request.tanggal} jam ke-${request.jam_ke_mulai}-${request.jam_ke_selesai}`,
      metadata: { reviewerId: actor.id, guruId: request.guru_id, penugasanId: request.penugasan_id, materi: request.materi, decision: 'CANCELLED', reason: 'agenda_already_exists' },
    })
    revalidatePath('/dashboard/monitoring-agenda')
    return { success: 'Pengajuan dibatalkan karena agenda sudah terisi melalui mekanisme lain.' }
  }

  if (decision === 'REJECT') {
    const rejected = await db.prepare(`UPDATE agenda_lupa_pengajuan
      SET status = 'REJECTED', reviewed_by = ?, reviewed_at = ?, review_note = ?, updated_at = ?
      WHERE id = ? AND status = 'PENDING' RETURNING id`)
      .bind(actor.id, reviewedAt, cleanNote, reviewedAt, requestId).first<{ id: string }>()
    if (!rejected) return { error: 'Pengajuan sudah berubah. Muat ulang antrean.' }
    await logActivity({
      db, module: 'monitoring-agenda', action: 'reject_forgotten_agenda_request',
      summary: `Menolak pengajuan lupa agenda ${request.guru_nama}`,
      entityType: 'agenda_lupa_pengajuan', entityId: requestId,
      entityLabel: `${request.tanggal} jam ke-${request.jam_ke_mulai}-${request.jam_ke_selesai}`,
      metadata: { reviewerId: actor.id, guruId: request.guru_id, penugasanId: request.penugasan_id, materi: request.materi, decision: 'REJECTED', note: cleanNote },
    })
    revalidatePath('/dashboard/agenda')
    revalidatePath('/dashboard/monitoring-agenda')
    return { success: 'Pengajuan ditolak. Status jadwal tetap Alfa.' }
  }

  const agendaId = crypto.randomUUID().replace(/-/g, '')
  const adminNote = cleanNote
    ? `Pengajuan lupa mengisi agenda disetujui. Catatan: ${cleanNote}`
    : 'Pengajuan lupa mengisi agenda disetujui.'
  try {
    const results = await db.batch([
      db.prepare(`
        INSERT INTO agenda_guru
          (id, guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai,
           materi, foto_url, status, waktu_input, catatan_admin, diubah_oleh, created_at, updated_at)
        SELECT ?, guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai,
          materi, NULL, 'TELAT', submitted_at, ?, ?, ?, ?
        FROM agenda_lupa_pengajuan
        WHERE id = ? AND status = 'PENDING'
          AND NOT EXISTS (
            SELECT 1 FROM agenda_guru ag
            WHERE ag.penugasan_id = agenda_lupa_pengajuan.penugasan_id
              AND ag.tanggal = agenda_lupa_pengajuan.tanggal
          )
      `).bind(agendaId, adminNote, actor.id, reviewedAt, reviewedAt, requestId),
      db.prepare(`UPDATE agenda_lupa_pengajuan
        SET status = 'APPROVED', reviewed_by = ?, reviewed_at = ?, review_note = ?,
          agenda_id = ?, updated_at = ?
        WHERE id = ? AND status = 'PENDING'
          AND EXISTS (SELECT 1 FROM agenda_guru WHERE id = ?)`)
        .bind(actor.id, reviewedAt, cleanNote, agendaId, reviewedAt, requestId, agendaId),
    ])
    if (Number((results[0] as any)?.meta?.changes || 0) !== 1 || Number((results[1] as any)?.meta?.changes || 0) !== 1) {
      return { error: 'Pengajuan sudah berubah atau agenda telah terisi. Muat ulang antrean.' }
    }
  } catch (error: any) {
    const existingAgenda = await db.prepare('SELECT id FROM agenda_guru WHERE penugasan_id = ? AND tanggal = ?')
      .bind(request.penugasan_id, request.tanggal).first()
    if (existingAgenda) {
      const cancelled = await db.prepare(`UPDATE agenda_lupa_pengajuan SET status = 'CANCELLED', reviewed_by = ?, reviewed_at = ?,
        review_note = ?, updated_at = ? WHERE id = ? AND status = 'PENDING' RETURNING id`)
        .bind(actor.id, reviewedAt, 'Agenda sudah terisi melalui mekanisme lain.', reviewedAt, requestId)
        .first<{ id: string }>()
      if (!cancelled) return { error: 'Pengajuan sudah berubah. Muat ulang antrean.' }
      await logActivity({
        db, module: 'monitoring-agenda', action: 'cancel_forgotten_agenda_request',
        summary: `Membatalkan pengajuan lupa agenda ${request.guru_nama} karena agenda sudah terisi`,
        entityType: 'agenda_lupa_pengajuan', entityId: requestId,
        entityLabel: `${request.tanggal} jam ke-${request.jam_ke_mulai}-${request.jam_ke_selesai}`,
        metadata: { reviewerId: actor.id, guruId: request.guru_id, penugasanId: request.penugasan_id, materi: request.materi, decision: 'CANCELLED', reason: 'agenda_already_exists' },
      })
      revalidatePath('/dashboard/monitoring-agenda')
      return { success: 'Pengajuan dibatalkan karena agenda sudah terisi melalui mekanisme lain.' }
    }
    return { error: error?.message || 'Persetujuan gagal disimpan.' }
  }

  await logActivity({
    db, module: 'monitoring-agenda', action: 'approve_forgotten_agenda_request',
    summary: `Menyetujui pengajuan lupa agenda ${request.guru_nama} sebagai Telat`,
    entityType: 'agenda_lupa_pengajuan', entityId: requestId,
    entityLabel: `${request.tanggal} jam ke-${request.jam_ke_mulai}-${request.jam_ke_selesai}`,
    metadata: { reviewerId: actor.id, guruId: request.guru_id, penugasanId: request.penugasan_id, materi: request.materi, decision: 'APPROVED', agendaId, status: 'TELAT', note: cleanNote },
  })
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/monitoring-agenda')
  return { success: 'Pengajuan disetujui dan agenda dicatat sebagai Telat.' }
}

// ============================================================
// 3. REKAP KEHADIRAN GURU (rentang tanggal)
//    Hitung total: TEPAT_WAKTU, TELAT, ALFA, SAKIT, IZIN per guru
// ============================================================
type CanonicalTeacherSession = TeacherLeaveMetadata & {
  agenda_id: string | null
  penugasan_id: string
  tanggal: string
  guru_id: string
  guru_nama: string
  nama_mapel: string
  kelas_id: string
  tingkat: number
  nomor_kelas: number
  kelompok: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  materi: string | null
  foto_url: string | null
  status: 'TEPAT_WAKTU' | 'TELAT' | 'ALFA' | 'SAKIT' | 'IZIN'
  waktu_input: string | null
  catatan_admin: string | null
  diubah_oleh_nama: string | null
  keterangan: string | null
  sudah_absen_siswa: boolean
  ppl_user_id: string | null
  ppl_nama: string | null
  sumber: 'AGENDA' | 'OVERRIDE' | 'PENUGASAN' | 'OTOMATIS'
}

// Sumber kebenaran bersama untuk REKAP dan CETAK.
// Prioritasnya sama dengan HARIAN: agenda/override > penugasan > ALFA.
async function getCanonicalTeacherSessions(
  db: D1Database,
  ta: { id: string; jam_pelajaran: string | null },
  tanggalMulai: string,
  tanggalSelesai: string,
  filters: { guruId?: string; kelasId?: string } = {}
): Promise<CanonicalTeacherSession[]> {
  const effectiveDates = await getEffectiveDatesInRange(db, tanggalMulai, tanggalSelesai)
  if (effectiveDates.length === 0) return []

  let scheduleSql = `
    SELECT pm.id as penugasan_id, pm.guru_id, u.nama_lengkap as guru_nama,
      mp.nama_mapel, k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
      k.kbm_nonaktif_mulai, jm.hari, jm.jam_ke
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
    JOIN "user" u ON u.id = pm.guru_id
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    JOIN kelas k ON k.id = pm.kelas_id
    WHERE jm.tahun_ajaran_id = ?
  `
  const scheduleParams: unknown[] = [ta.id]
  if (filters.guruId) {
    scheduleSql += ' AND pm.guru_id = ?'
    scheduleParams.push(filters.guruId)
  }
  if (filters.kelasId) {
    scheduleSql += ' AND pm.kelas_id = ?'
    scheduleParams.push(filters.kelasId)
  }
  scheduleSql += ' ORDER BY pm.id, jm.hari, jm.jam_ke'
  const scheduleRows = (await db.prepare(scheduleSql).bind(...scheduleParams).all<any>()).results || []

  type ScheduleBlock = {
    penugasan_id: string; guru_id: string; guru_nama: string; nama_mapel: string
    kelas_id: string; tingkat: number; nomor_kelas: number; kelompok: string
    kbm_nonaktif_mulai: string | null; hari: number; jamList: number[]
  }
  const scheduleMap = new Map<string, ScheduleBlock>()
  for (const row of scheduleRows) {
    const key = `${row.penugasan_id}:${row.hari}`
    if (!scheduleMap.has(key)) {
      scheduleMap.set(key, {
        penugasan_id: row.penugasan_id,
        guru_id: row.guru_id,
        guru_nama: row.guru_nama,
        nama_mapel: row.nama_mapel,
        kelas_id: row.kelas_id,
        tingkat: Number(row.tingkat),
        nomor_kelas: Number(row.nomor_kelas),
        kelompok: row.kelompok || '',
        kbm_nonaktif_mulai: row.kbm_nonaktif_mulai || null,
        hari: Number(row.hari),
        jamList: [],
      })
    }
    scheduleMap.get(key)!.jamList.push(Number(row.jam_ke))
  }
  if (scheduleMap.size === 0) return []

  const agendaParams: unknown[] = [ta.id, tanggalMulai, tanggalSelesai]
  let agendaSql = `
    SELECT ag.*, u_ppl.nama_lengkap AS ppl_nama, u_editor.nama_lengkap AS diubah_oleh_nama FROM agenda_guru ag
    JOIN penugasan_mengajar pm ON pm.id = ag.penugasan_id
    LEFT JOIN "user" u_ppl ON u_ppl.id = ag.ppl_user_id
    LEFT JOIN "user" u_editor ON u_editor.id = ag.diubah_oleh
    WHERE pm.tahun_ajaran_id = ? AND ag.guru_id = pm.guru_id
      AND ag.tanggal BETWEEN ? AND ?
  `
  if (filters.guruId) {
    agendaSql += ' AND ag.guru_id = ?'
    agendaParams.push(filters.guruId)
  }
  if (filters.kelasId) {
    agendaSql += ' AND pm.kelas_id = ?'
    agendaParams.push(filters.kelasId)
  }
  const agendaRows = (await db.prepare(agendaSql).bind(...agendaParams).all<any>()).results || []
  const agendaMap = new Map<string, any>(agendaRows.map(row => [`${row.penugasan_id}:${row.tanggal}`, row]))

  const attendanceRows = (await db.prepare(`
    SELECT ass.penugasan_id, ass.tanggal
    FROM absensi_sesi_guru ass
    JOIN penugasan_mengajar pm ON pm.id = ass.penugasan_id
    WHERE pm.tahun_ajaran_id = ? AND ass.tanggal BETWEEN ? AND ?
  `).bind(ta.id, tanggalMulai, tanggalSelesai).all<{ penugasan_id: string; tanggal: string }>()).results || []
  const attendanceKeys = new Set(attendanceRows.map(row => `${row.penugasan_id}:${row.tanggal}`))

  const delegationParams: unknown[] = [ta.id, tanggalMulai, tanggalSelesai]
  let delegationSql = `
    SELECT dt.tanggal, dt.dari_user_id as guru_id, dt.alasan_ketidakhadiran,
      dt.deskripsi_ketidakhadiran, dtk.penugasan_mengajar_id as penugasan_id
    FROM delegasi_tugas dt
    JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
    JOIN penugasan_mengajar pm ON pm.id = dtk.penugasan_mengajar_id
    WHERE pm.tahun_ajaran_id = ? AND dt.dari_user_id = pm.guru_id
      AND dt.tanggal BETWEEN ? AND ?
  `
  if (filters.guruId) {
    delegationSql += ' AND dt.dari_user_id = ?'
    delegationParams.push(filters.guruId)
  }
  if (filters.kelasId) {
    delegationSql += ' AND pm.kelas_id = ?'
    delegationParams.push(filters.kelasId)
  }
  delegationSql += ' ORDER BY dt.created_at DESC'
  const delegationRows = (await db.prepare(delegationSql).bind(...delegationParams).all<any>()).results || []
  const delegationMap = new Map<string, any>()
  for (const row of delegationRows) {
    const key = `${row.penugasan_id}:${row.tanggal}`
    if (!delegationMap.has(key)) delegationMap.set(key, row)
  }

  const exceptionsByDate = new Map<string, Awaited<ReturnType<typeof getKbmExceptionsForRange>>>()
  for (const exception of await getKbmExceptionsForRange(db, tanggalMulai, tanggalSelesai)) {
    if (!exceptionsByDate.has(exception.tanggal)) exceptionsByDate.set(exception.tanggal, [])
    exceptionsByDate.get(exception.tanggal)!.push(exception)
  }

  const polaList = parsePolaJam(ta.jam_pelajaran || '[]')
  const sessions: CanonicalTeacherSession[] = []
  for (const tanggal of effectiveDates) {
    const hari = getHariFromDate(tanggal)
    const slots = getSlotsForHari(polaList, hari)
    for (const schedule of scheduleMap.values()) {
      if (schedule.hari !== hari) continue
      if (schedule.kbm_nonaktif_mulai && schedule.kbm_nonaktif_mulai <= tanggal) continue

      const slotState = splitTeachingSlotsByExceptions(
        exceptionsByDate.get(tanggal) || [],
        { id: schedule.kelas_id, tingkat: schedule.tingkat },
        schedule.jamList
      )
      if (slotState.activeJamKe.length === 0) continue

      const jamKeMulai = slotState.activeJamKe[0]
      const jamKeSelesai = slotState.activeJamKe[slotState.activeJamKe.length - 1]
      const key = `${schedule.penugasan_id}:${tanggal}`
      const agenda = agendaMap.get(key)
      const delegation = delegationMap.get(key)
      const slotSelesai = slots.find(slot => slot.id === jamKeSelesai)

      // Sesi hari ini yang belum selesai tidak boleh langsung dianggap ALFA.
      if (!agenda && !delegation && !isTeachingBlockEnded(tanggal, slotSelesai)) continue

      const agendaStatus = EDITABLE_AGENDA_STATUSES.has(agenda?.status)
        ? agenda.status as CanonicalTeacherSession['status']
        : null
      const delegationStatus = delegation?.alasan_ketidakhadiran === 'SAKIT' || delegation?.alasan_ketidakhadiran === 'IZIN'
        ? delegation.alasan_ketidakhadiran as 'SAKIT' | 'IZIN'
        : null

      sessions.push({
        agenda_id: agenda?.id || null,
        penugasan_id: schedule.penugasan_id,
        tanggal,
        guru_id: schedule.guru_id,
        guru_nama: schedule.guru_nama,
        nama_mapel: schedule.nama_mapel,
        kelas_id: schedule.kelas_id,
        tingkat: schedule.tingkat,
        nomor_kelas: schedule.nomor_kelas,
        kelompok: schedule.kelompok,
        jam_ke_mulai: jamKeMulai,
        jam_ke_selesai: jamKeSelesai,
        materi: agenda?.materi || null,
        foto_url: agenda?.foto_url || null,
        status: agendaStatus || delegationStatus || 'ALFA',
        waktu_input: agenda?.waktu_input || null,
        catatan_admin: agenda?.catatan_admin || null,
        diubah_oleh_nama: agenda?.diubah_oleh_nama || null,
        keterangan: agenda?.catatan_admin || delegation?.deskripsi_ketidakhadiran || null,
        sudah_absen_siswa: attendanceKeys.has(key),
        ppl_user_id: agenda?.ppl_user_id || null,
        ppl_nama: agenda?.ppl_nama || null,
        sumber: agenda
          ? (agenda.diubah_oleh && !agenda.waktu_input ? 'OVERRIDE' : 'AGENDA')
          : delegation ? 'PENUGASAN' : 'OTOMATIS',
      })
    }
  }

  return (await enrichTeacherLeaveSessions(db, sessions)).sort((a, b) =>
    a.tanggal.localeCompare(b.tanggal) ||
    a.guru_nama.localeCompare(b.guru_nama) ||
    a.jam_ke_mulai - b.jam_ke_mulai
  )
}

export type MonthlyTeacherHistoryStatus = TeacherAttendanceHistoryFilter

type MonthlyTeacherHistoryRow = Omit<MonthlyTeacherLeaveRow, 'source' | 'target'> & {
  status: TeacherAttendanceHistoryStatus
  source: MonthlyTeacherLeaveRow['source'] | 'AGENDA' | 'OVERRIDE' | 'PENUGASAN' | 'OTOMATIS'
  target?: MonthlyTeacherLeaveRow['target']
}

export async function getMonthlyTeacherAttendanceHistory(
  month: string,
  statusFilter: MonthlyTeacherHistoryStatus = 'ALL'
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Bulan tidak valid.')
  if (!['ALL', 'IZIN', 'SAKIT', 'ALFA'].includes(statusFilter)) throw new Error('Filter status tidak valid.')

  const db = await getDB()
  const [leaveRows, ta] = await Promise.all([
    getMonthlyTeacherLeaveRows(db, month),
    db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
      .first<{ id: string; jam_pelajaran: string | null }>(),
  ])
  const start = `${month}-01`
  const end = monthEndForHistory(month)
  const canonicalRows = ta
    ? await getCanonicalTeacherSessions(db, ta, start, end)
    : []

  const rows: MonthlyTeacherHistoryRow[] = [
    ...leaveRows.map(row => ({ ...row, status: 'IZIN' as const })),
    ...canonicalRows.filter(row => row.status === 'SAKIT' || row.status === 'ALFA').map(row => ({
      id: `session:${row.penugasan_id}:${row.tanggal}`,
      status: row.status as 'SAKIT' | 'ALFA',
      source: row.sumber,
      guru_id: row.guru_id,
      guru_nama: row.guru_nama,
      tanggal: row.tanggal,
      waktu_input: row.waktu_input,
      deskripsi: row.keterangan,
      alasan_nama: row.alasan_izin_guru_nama || null,
      alasan_izin_guru_id: row.alasan_izin_guru_id || null,
      kepentingan_sekolah: Boolean(row.kepentingan_sekolah),
      kelas: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
      mapel: row.nama_mapel,
      jam: `Jam ${row.jam_ke_mulai}–${row.jam_ke_selesai}`,
    })),
  ].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.guru_nama.localeCompare(b.guru_nama) || a.status.localeCompare(b.status))

  return filterAndCountTeacherAttendanceHistory(rows, statusFilter)
}

async function buildRekapKehadiranGuru(
  db: D1Database,
  ta: { id: string; jam_pelajaran: string | null },
  tanggalMulai: string,
  tanggalSelesai: string,
  sortBy: 'nama' | 'patuh' | 'alfa' | 'absen_siswa'
) {
  const sessions = await getCanonicalTeacherSessions(db, ta, tanggalMulai, tanggalSelesai)
  const rows = new Map<string, any>()
  for (const session of sessions) {
    if (!rows.has(session.guru_id)) {
      rows.set(session.guru_id, {
        guru_id: session.guru_id, guru_nama: session.guru_nama,
         total_blok: 0, tepat_waktu: 0, telat: 0, alfa: 0, sakit: 0, izin: 0, izinSekolah: 0,
         absen_siswa_terisi: 0, absen_siswa_belum: 0,
         absen_siswa_belum_detail: [] as Array<{ tanggal: string; mapel: string; kelas: string; jam: string }>,
      })
    }
    const row = rows.get(session.guru_id)!
    row.total_blok++
    if (session.waktu_input) {
      if (session.sudah_absen_siswa) row.absen_siswa_terisi++
      else {
        row.absen_siswa_belum++
        row.absen_siswa_belum_detail.push({
          tanggal: session.tanggal,
          mapel: session.nama_mapel,
          kelas: formatNamaKelas(session.tingkat, session.nomor_kelas, session.kelompok),
          jam: session.jam_ke_mulai === session.jam_ke_selesai
            ? `Jam ${session.jam_ke_mulai}`
            : `Jam ${session.jam_ke_mulai}–${session.jam_ke_selesai}`,
        })
      }
    }
    if (isSchoolLeave(session.status, session)) row.izinSekolah++
    if (session.status === 'TEPAT_WAKTU') row.tepat_waktu++
    else if (session.status === 'TELAT') row.telat++
    else if (session.status === 'SAKIT') row.sakit++
    else if (session.status === 'IZIN') row.izin++
    else row.alfa++
  }

  const data = Array.from(rows.values()).map(row => ({
    ...row,
    absen_siswa_belum_detail: row.absen_siswa_belum_detail.sort((a: { tanggal: string }, b: { tanggal: string }) => b.tanggal.localeCompare(a.tanggal)),
    performa: teacherPerformance({ total: row.total_blok, hadir: row.tepat_waktu + row.telat, sakit: row.sakit, izin: row.izin, izinSekolah: row.izinSekolah }),
    kepatuhan: row.total_blok > 0
      ? Math.min(100, Math.max(0, Math.round(((row.total_blok - row.alfa) / row.total_blok) * 100)))
      : 0,
  }))
  if (sortBy === 'patuh') data.sort((a, b) => b.kepatuhan - a.kepatuhan)
  else if (sortBy === 'alfa') data.sort((a, b) => b.alfa - a.alfa)
  else if (sortBy === 'absen_siswa') data.sort((a, b) => b.absen_siswa_belum - a.absen_siswa_belum || a.guru_nama.localeCompare(b.guru_nama))
  else data.sort((a, b) => a.guru_nama.localeCompare(b.guru_nama))
  return { error: null, data }
}

export async function getRekapKehadiranGuru(
  tanggalMulai: string,
  tanggalSelesai: string,
  sortBy: 'nama' | 'patuh' | 'alfa' | 'absen_siswa' = 'nama'
) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', data: [] }

  return buildRekapKehadiranGuru(db, ta, tanggalMulai, tanggalSelesai, sortBy)

  /* Implementasi agregat lama dinonaktifkan; dipertahankan sementara untuk jejak migrasi.
  // Hitung total jadwal per guru dalam rentang tanggal
  // Kita perlu hitung berapa blok mengajar per guru per hari kerja dalam range
  // Simplified approach: count distinct (penugasan_id) per hari dari jadwal

  // 1. Ambil semua penugasan guru + jadwal hari apa saja
  const jadwalRes = await db.prepare(`
    SELECT pm.guru_id, jm.penugasan_id, jm.hari, jm.jam_ke, k.id as kelas_id, k.tingkat, k.kbm_nonaktif_mulai
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE jm.tahun_ajaran_id = ?
  `).bind(ta.id).all<any>()

  // Group: guru_id → Map<penugasan_id, Set<hari>>
  const guruJadwal = new Map<string, Map<string, { hariMap: Map<number, Set<number>>; kelasId: string; tingkat: number; kbmNonaktifMulai: string | null }>>()
  for (const row of jadwalRes.results || []) {
    if (!guruJadwal.has(row.guru_id)) guruJadwal.set(row.guru_id, new Map())
    const penMap = guruJadwal.get(row.guru_id)!
    if (!penMap.has(row.penugasan_id)) {
      penMap.set(row.penugasan_id, {
        hariMap: new Map(),
        kelasId: row.kelas_id,
        tingkat: Number(row.tingkat),
        kbmNonaktifMulai: row.kbm_nonaktif_mulai || null,
      })
    }
    const jadwal = penMap.get(row.penugasan_id)!
    if (!jadwal.hariMap.has(row.hari)) jadwal.hariMap.set(row.hari, new Set())
    jadwal.hariMap.get(row.hari)!.add(Number(row.jam_ke))
  }

  // 2. Hitung total blok per guru dalam rentang tanggal
  const effectiveDates = await getEffectiveDatesInRange(db, tanggalMulai, tanggalSelesai)
  const exceptionsByDate = new Map<string, Awaited<ReturnType<typeof getKbmExceptionsForRange>>>()
  for (const exception of await getKbmExceptionsForRange(db, tanggalMulai, tanggalSelesai)) {
    if (!exceptionsByDate.has(exception.tanggal)) exceptionsByDate.set(exception.tanggal, [])
    exceptionsByDate.get(exception.tanggal)!.push(exception)
  }
  const totalBlokPerGuru = new Map<string, number>()

  for (const [guruId, penMap] of guruJadwal) {
    let total = 0
    for (const tanggal of effectiveDates) {
      const hari = getHariFromDate(tanggal)
      for (const [, jadwal] of penMap) {
        if (jadwal.kbmNonaktifMulai && jadwal.kbmNonaktifMulai <= tanggal) continue
        const jamSet = jadwal.hariMap.get(hari)
        if (!jamSet) continue
        const jamList = Array.from(jamSet).sort((a, b) => a - b)
        if (!hasActiveTeachingSlots(exceptionsByDate.get(tanggal) || [], { id: jadwal.kelasId, tingkat: jadwal.tingkat }, jamList)) continue
        total++
      }
    }
    totalBlokPerGuru.set(guruId, total)
  }

  // 3. Ambil agenda yang tercatat
  const agendaRes = effectiveDates.length > 0 ? await db.prepare(`
    SELECT ag.guru_id, ag.status, COUNT(*) as cnt
    FROM agenda_guru ag
    WHERE ag.tanggal BETWEEN ? AND ?
      AND ag.tanggal IN (${effectiveDates.map(() => '?').join(',')})
    GROUP BY ag.guru_id, ag.status
  `).bind(tanggalMulai, tanggalSelesai, ...effectiveDates).all<any>() : { results: [] }

  // 3b. Ambil delegasi tugas (count per guru = berapa blok yang didelegasikan)
  const delegasiRes = effectiveDates.length > 0 ? await db.prepare(`
    SELECT
      dt.dari_user_id as guru_id,
      COUNT(DISTINCT dtk.penugasan_mengajar_id) as cnt,
      SUM(CASE WHEN dt.alasan_ketidakhadiran = 'SAKIT' THEN 1 ELSE 0 END) as sakit_cnt,
      SUM(CASE WHEN dt.alasan_ketidakhadiran = 'IZIN' THEN 1 ELSE 0 END) as izin_cnt
    FROM delegasi_tugas dt
    JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
    WHERE dt.tanggal BETWEEN ? AND ?
      AND dt.tanggal IN (${effectiveDates.map(() => '?').join(',')})
    GROUP BY dt.dari_user_id
  `).bind(tanggalMulai, tanggalSelesai, ...effectiveDates).all<any>() : { results: [] }

  const delegasiCountMap = new Map<string, { total: number; sakit: number; izin: number }>()
  for (const row of delegasiRes.results || []) {
    delegasiCountMap.set(row.guru_id, {
      total: row.cnt || 0,
      sakit: row.sakit_cnt || 0,
      izin: row.izin_cnt || 0,
    })
  }

  // Build rekap per guru
  const rekapMap = new Map<string, { tepat: number, telat: number, alfa: number, sakit: number, izin: number }>()
  for (const row of agendaRes.results || []) {
    if (!rekapMap.has(row.guru_id)) rekapMap.set(row.guru_id, { tepat: 0, telat: 0, alfa: 0, sakit: 0, izin: 0 })
    const r = rekapMap.get(row.guru_id)!
    if (row.status === 'TEPAT_WAKTU') r.tepat = row.cnt
    else if (row.status === 'TELAT') r.telat = row.cnt
    else if (row.status === 'ALFA') r.alfa = row.cnt
    else if (row.status === 'SAKIT') r.sakit = row.cnt
    else if (row.status === 'IZIN') r.izin = row.cnt
  }

  // 4. Ambil nama guru
  const guruIds = Array.from(guruJadwal.keys())
  if (guruIds.length === 0) return { error: null, data: [] }

  const placeholders = guruIds.map(() => '?').join(',')
  const guruRes = await db.prepare(
    `SELECT id, nama_lengkap FROM "user" WHERE id IN (${placeholders})`
  ).bind(...guruIds).all<any>()
  const guruNamaMap = new Map<string, string>()
  for (const g of guruRes.results || []) guruNamaMap.set(g.id, g.nama_lengkap)

  // 5. Compile data
  const data = guruIds.map(gid => {
    const totalBlok = totalBlokPerGuru.get(gid) || 0
    const r = rekapMap.get(gid) || { tepat: 0, telat: 0, alfa: 0, sakit: 0, izin: 0 }
    const tugasBreakdown = delegasiCountMap.get(gid) || { total: 0, sakit: 0, izin: 0 }
    const tugasCount = tugasBreakdown.total
    const totalIsi = r.tepat + r.telat + r.sakit + r.izin + r.alfa + tugasCount
    const alfaHitung = Math.max(0, totalBlok - totalIsi) + r.alfa
    const kepatuhan = totalBlok > 0 ? Math.round(((r.tepat + r.telat + tugasCount) / totalBlok) * 100) : 0

    return {
      guru_id: gid,
      guru_nama: guruNamaMap.get(gid) || 'Unknown',
      total_blok: totalBlok,
      tepat_waktu: r.tepat,
      telat: r.telat,
      tugas: tugasCount,
      tugas_sakit: tugasBreakdown.sakit,
      tugas_izin: tugasBreakdown.izin,
      alfa: alfaHitung,
      sakit: r.sakit,
      izin: r.izin,
      kepatuhan,
    }
  })

  // Sort
  if (sortBy === 'patuh') data.sort((a, b) => b.kepatuhan - a.kepatuhan)
  else if (sortBy === 'alfa') data.sort((a, b) => b.alfa - a.alfa)
  else data.sort((a, b) => a.guru_nama.localeCompare(b.guru_nama))

  return { error: null, data }
  */
}

// ============================================================
// 4. ADMIN: EDIT STATUS AGENDA
//    Bisa ubah ALFA → SAKIT/IZIN/HADIR, dll
//    Jika belum ada record (ALFA), buat baru
// ============================================================
export async function editAgendaStatus(
  agendaId: string | null, penugasanId: string, tanggal: string, guruId: string,
  jamKeMulai: number, jamKeSelesai: number, newStatus: string, catatanAdmin: string,
  alasanIzinGuruId?: string
): Promise<{ error?: string; success?: string }> {
  await requireActionAccess('monitoring-agenda', 'update', { allowedRoles: ['super_admin', 'admin_tu', 'kepsek'] })
  return batchEditAgendaStatus(tanggal, [{ penugasan_id: penugasanId, guru_id: guruId }], newStatus, catatanAdmin, alasanIzinGuruId)
}

export type BatchAgendaStatusItem = {
  penugasan_id: string
  guru_id: string
}

export async function batchEditAgendaStatus(
  tanggal: string,
  items: BatchAgendaStatusItem[],
  newStatus: string,
  catatanAdmin: string,
  alasanIzinGuruId?: string
): Promise<{ error?: string; success?: string; updated?: number; skipped?: number }> {
  const actor = await requireActionAccess('monitoring-agenda', 'update', { allowedRoles: ['super_admin', 'admin_tu', 'kepsek'] })
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const isAdmin = actor.kind === 'staff' && ['super_admin', 'admin_tu', 'kepsek'].some(role => actor.roles.includes(role))
  if (!isAdmin) return { error: 'Hanya admin yang bisa mengubah status.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: 'Tanggal tidak valid.' }
  if (!EDITABLE_AGENDA_STATUSES.has(newStatus)) return { error: 'Status agenda tidak valid.' }

  const uniqueItems = Array.from(new Map(
    items
      .filter(item => item?.penugasan_id && item?.guru_id)
      .map(item => [`${item.penugasan_id}:${item.guru_id}`, item])
  ).values())
  if (uniqueItems.length === 0) return { error: 'Belum ada agenda yang dipilih.' }
  if (uniqueItems.length > 100) return { error: 'Maksimal 100 sesi dalam satu batch.' }

  const db = await getDB()
  let reasonId: string | null
  try { reasonId = await validateTeacherLeaveReason(db, newStatus, alasanIzinGuruId) } catch { return { error: 'Pilih alasan izin guru yang masih aktif.' } }
  if (newStatus === 'IZIN' && !catatanAdmin.trim()) return { error: 'Deskripsi izin wajib diisi.' }
  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return { error: `Tanggal ini tidak efektif pembelajaran${calendarStatus.reason ? `: ${calendarStatus.reason}` : ''}.` }
  }

  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur.' }

  const hari = getHariFromDate(tanggal)
  const penugasanIds = Array.from(new Set(uniqueItems.map(item => item.penugasan_id)))
  const scheduleRows: any[] = []
  for (let offset = 0; offset < penugasanIds.length; offset += 80) {
    const chunk = penugasanIds.slice(offset, offset + 80)
    const result = await db.prepare(`
    SELECT
      pm.id as penugasan_id,
      pm.guru_id,
      k.id as kelas_id,
      k.tingkat,
      k.kbm_nonaktif_mulai,
      COALESCE(ag.status, dt.alasan_ketidakhadiran) AS current_status,
      COALESCE(ag.alasan_izin_guru_id, dt.alasan_izin_guru_id) AS current_reason_id,
      GROUP_CONCAT(jm.jam_ke) as jam_list
    FROM penugasan_mengajar pm
    JOIN jadwal_mengajar jm ON jm.penugasan_id = pm.id
      AND jm.tahun_ajaran_id = ? AND jm.hari = ?
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = pm.id AND ag.tanggal = ?
    LEFT JOIN delegasi_tugas dt ON dt.id = (
      SELECT d.id FROM delegasi_tugas d JOIN delegasi_tugas_kelas dk ON dk.delegasi_id = d.id
      WHERE dk.penugasan_mengajar_id = pm.id AND d.dari_user_id = pm.guru_id AND d.tanggal = ?
      ORDER BY d.created_at DESC, d.id DESC LIMIT 1)
    WHERE pm.id IN (${chunk.map(() => '?').join(',')})
    GROUP BY pm.id, pm.guru_id, k.id, k.tingkat, k.kbm_nonaktif_mulai
  `).bind(ta.id, hari, tanggal, tanggal, ...chunk).all<any>()
    scheduleRows.push(...(result.results || []))
  }

  const scheduleMap = new Map(scheduleRows.map(row => [row.penugasan_id, row]))
  if (!actor.roles.includes('super_admin') && newStatus === 'IZIN' && scheduleRows.some(row => row.current_status === 'IZIN' && row.current_reason_id !== reasonId)) {
    return { error: 'Hanya super admin yang dapat memetakan ulang alasan pada izin yang sudah tercatat.' }
  }
  const exceptions = await getKbmExceptionsForDate(db, tanggal)
  const statements: D1PreparedStatement[] = []
  let skipped = 0
  let updated = 0
  const catatan = catatanAdmin.trim().slice(0, 1000) || null
  const updatedAt = nowWIBISO()

  for (const item of uniqueItems) {
    const schedule = scheduleMap.get(item.penugasan_id)
    if (!schedule || schedule.guru_id !== item.guru_id || (schedule.kbm_nonaktif_mulai && schedule.kbm_nonaktif_mulai <= tanggal)) {
      skipped++
      continue
    }

    const jamList = String(schedule.jam_list || '').split(',').map(Number).filter(Number.isFinite)
    const slotState = splitTeachingSlotsByExceptions(
      exceptions,
      { id: schedule.kelas_id, tingkat: Number(schedule.tingkat) },
      jamList
    )
    if (slotState.activeJamKe.length === 0) {
      skipped++
      continue
    }

    const jamKeMulai = slotState.activeJamKe[0]
    const jamKeSelesai = slotState.activeJamKe[slotState.activeJamKe.length - 1]
    statements.push(db.prepare(`INSERT INTO izin_guru_audit (id, actor_id, action, target_id, before_json, after_json)
      VALUES (?, ?, 'AGENDA_STATUS', ?, (SELECT json_object('status', status, 'alasan_izin_guru_id', alasan_izin_guru_id) FROM agenda_guru WHERE penugasan_id = ? AND tanggal = ?), ?)`)
      .bind(crypto.randomUUID(), actor.id, `${item.penugasan_id}:${tanggal}`, item.penugasan_id, tanggal,
        JSON.stringify({ status: newStatus, alasan_izin_guru_id: reasonId })))
    updated++
    statements.push(db.prepare(`
      INSERT INTO agenda_guru (
        guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai,
        materi, foto_url, status, waktu_input, catatan_admin, diubah_oleh, updated_at, alasan_izin_guru_id
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?)
      ON CONFLICT(penugasan_id, tanggal) DO UPDATE SET
        alasan_izin_guru_id = excluded.alasan_izin_guru_id,
        status = excluded.status,
        catatan_admin = excluded.catatan_admin,
        diubah_oleh = excluded.diubah_oleh,
        updated_at = excluded.updated_at
    `).bind(
      schedule.guru_id,
      item.penugasan_id,
      tanggal,
      jamKeMulai,
      jamKeSelesai,
      newStatus,
      catatan,
      user.id,
      updatedAt,
      reasonId
    ))
  }

  if (statements.length === 0) {
    return { error: 'Tidak ada sesi wajib KBM yang valid untuk diperbarui.', updated: 0, skipped }
  }

  try {
    await db.batch(statements)
  } catch (error: any) {
    return { error: error?.message || 'Batch perubahan status gagal disimpan.' }
  }

  revalidatePath('/dashboard', 'layout')
  const success = `${updated} status agenda berhasil diubah menjadi ${newStatus}${skipped > 0 ? `; ${skipped} sesi dilewati karena tidak valid/non-KBM` : ''}.`
  return { success, updated, skipped }
}

// ============================================================
// 5. DATA CETAK LAPORAN
// ============================================================
export async function getDataCetakLaporan(
  tanggalMulai: string,
  tanggalSelesai: string,
  guruId?: string,
  kelasId?: string
) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalMulai) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalSelesai)) {
    throw new Error('Format tanggal tidak valid')
  }
  if (tanggalMulai > tanggalSelesai) throw new Error('Rentang tanggal tidak valid')

  const db = await getDB()

  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<{ id: string; jam_pelajaran: string | null }>()
  if (!ta) return []

  return getCanonicalTeacherSessions(db, ta, tanggalMulai, tanggalSelesai, { guruId, kelasId })

  /* Implementasi cetak lama hanya membaca agenda_guru dan tidak mencakup ALFA/penugasan.
  let sql = `
    SELECT ag.*,
      u.nama_lengkap as guru_nama,
      mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok
    FROM agenda_guru ag
    JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
    JOIN "user" u ON ag.guru_id = u.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE ag.tanggal BETWEEN ? AND ?
  `
  const params: unknown[] = [tanggalMulai, tanggalSelesai]

  if (guruId) {
    sql += ' AND ag.guru_id = ?'
    params.push(guruId)
  }

  sql += ' ORDER BY ag.tanggal ASC, u.nama_lengkap ASC, ag.jam_ke_mulai ASC'

  const result = await db.prepare(sql).bind(...params).all<any>()
  return result.results || []
  */
}

// ============================================================
// 6. MONITORING PIKET HARIAN
//    Semua guru piket yang punya jadwal di tanggal tertentu
//    beserta status kehadiran (HADIR/TELAT/ALFA/SAKIT/IZIN)
// ============================================================
export async function getMonitoringPiketHarian(tanggal: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  if (hari === 7) return { error: null, data: [], hariNama: 'Minggu' }

  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return {
      error: null,
      data: [],
      hariNama: HARI_NAMA[hari] || '',
      calendarStatus: {
        isEffective: false,
        reason: calendarStatus.reason,
        category: calendarStatus.category,
      },
    }
  }

  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()

  const polaList = ta ? parsePolaJam(ta.jam_pelajaran || '[]') : []
  const slots = getSlotsForHari(polaList, hari)

  const result = await db.prepare(`
    SELECT
      j.id as jadwal_id,
      j.user_id,
      u.nama_lengkap as guru_nama,
      s.id as shift_id,
      s.nama_shift,
      s.jam_mulai,
      s.jam_selesai,
      ap.id as agenda_id,
      ap.foto_url,
      ap.status as agenda_status,
      ap.waktu_submit,
      ap.catatan_admin
    FROM jadwal_guru_piket j
    JOIN pengaturan_shift_piket s ON j.shift_id = s.id
    JOIN "user" u ON j.user_id = u.id
    LEFT JOIN agenda_piket ap ON ap.jadwal_id = j.id AND ap.tanggal = ? AND ap.user_id = j.user_id
    WHERE j.hari = ?
    ORDER BY u.nama_lengkap ASC, s.id ASC
  `).bind(tanggal, hari).all<any>()

  const rows = result.results || []

  const data = rows.map((r: any) => {
    const slotMulai = slots.find(s => s.id === r.jam_mulai)
    const slotSelesai = slots.find(s => s.id === r.jam_selesai)
    const status = r.agenda_id ? (r.agenda_status || 'HADIR') : 'ALFA'

    return {
      jadwal_id: r.jadwal_id,
      user_id: r.user_id,
      guru_nama: r.guru_nama,
      shift_id: r.shift_id,
      shift_nama: r.nama_shift,
      jam_mulai: r.jam_mulai,
      jam_selesai: r.jam_selesai,
      slot_mulai: slotMulai?.mulai ?? '-',
      slot_selesai: slotSelesai?.selesai ?? '-',
      agenda_id: r.agenda_id ?? null,
      foto_url: r.foto_url ?? null,
      status,
      waktu_submit: r.waktu_submit ?? null,
      catatan_admin: r.catatan_admin ?? null,
    }
  })

  return { error: null, data, hariNama: HARI_NAMA[hari] || '' }
}

// ============================================================
// 7. ADMIN: EDIT STATUS AGENDA PIKET
//    Bisa ubah ALFA → SAKIT/IZIN/HADIR, dll
//    Jika belum ada record, buat baru (tandai admin sebagai pembuat)
// ============================================================
export async function editAgendaPiketStatus(
  agendaId: string | null,
  jadwalId: string,
  userId: string,
  shiftId: number,
  tanggal: string,
  newStatus: string,
  catatanAdmin: string
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(user.role)
  if (!isAdmin) return { error: 'Hanya admin yang bisa mengubah status.' }

  const db = await getDB()

  if (agendaId) {
    const result = await dbUpdate(db, 'agenda_piket', {
      status: newStatus,
      catatan_admin: catatanAdmin || null,
      diubah_oleh: user.id,
    }, { id: agendaId })
    if (result.error) return { error: result.error }
  } else {
    const result = await dbInsert(db, 'agenda_piket', {
      user_id: userId,
      jadwal_id: jadwalId,
      shift_id: shiftId,
      tanggal,
      foto_url: null,
      status: newStatus,
      waktu_submit: null,
      catatan_admin: catatanAdmin || null,
      diubah_oleh: user.id,
    })
    if (result.error) return { error: result.error }
  }

  revalidatePath('/dashboard/monitoring-agenda')
  return { success: `Status piket berhasil diubah menjadi ${newStatus}.` }
}
