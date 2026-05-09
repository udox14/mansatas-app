'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { formatNamaKelas } from '@/lib/utils'
import {
  getAccessibleWaliKelasClasses,
  getFinalAttendanceForClass,
  getFinalAttendanceForStudent,
} from '@/lib/wali-kelas-attendance'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'

function getSlotsHari(raw: string, hari: number): SlotJam[] {
  try { return (JSON.parse(raw) as PolaJam[]).find(p => p.hari.includes(hari))?.slots ?? [] } catch { return [] }
}

function hariNum(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 7 : day
}

const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export async function getRekapFilterOptions() {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { kelas: [], siswa: [] }

  const roles = await getUserRoles(db, user.id)
  const isWaliOnly = roles.includes('wali_kelas') &&
    !roles.some(role => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))

  let kelasRows: any[] = []
  let siswaRows: any[] = []

  if (isWaliOnly) {
    const kelasAkses = await getAccessibleWaliKelasClasses(db, user.id, roles)
    kelasRows = kelasAkses

    if (kelasAkses.length > 0) {
      const kelasIds = kelasAkses.map(item => item.id)
      const placeholders = kelasIds.map(() => '?').join(',')
      const siswaRes = await db.prepare(`
        SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
        FROM siswa s
        LEFT JOIN kelas k ON s.kelas_id = k.id
        WHERE s.status = 'aktif' AND s.kelas_id IN (${placeholders})
        ORDER BY s.nama_lengkap
      `).bind(...kelasIds).all<any>()
      siswaRows = siswaRes.results || []
    }
  } else {
    const [kelasRes, siswaRes] = await Promise.all([
      db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat, kelompok, nomor_kelas').all<any>(),
      db.prepare(`
        SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
        FROM siswa s
        LEFT JOIN kelas k ON s.kelas_id = k.id
        WHERE s.status = 'aktif'
        ORDER BY s.nama_lengkap
      `).all<any>(),
    ])
    kelasRows = kelasRes.results || []
    siswaRows = siswaRes.results || []
  }

  return {
    kelas: kelasRows.map((k: any) => ({
      id: k.id,
      tingkat: k.tingkat,
      label: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
    })),
    siswa: siswaRows.map((s: any) => ({
      id: s.id,
      nama: s.nama_lengkap,
      nisn: s.nisn,
      kelas_label: formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok),
    })),
  }
}

export async function getAbsensiPerSiswa(siswaId: string, tglMulai: string, tglSelesai: string) {
  const db = await getDB()
  const result = await getFinalAttendanceForStudent(db, siswaId, tglMulai, tglSelesai)
  if (!result) return { error: 'Siswa tidak ditemukan', data: [] }

  const days = result.statuses
    .filter(day => day.total_blok > 0 || day.wali_status !== null || day.detail_guru.length > 0)
    .map(day => {
      const blokTidakHadir = day.guru_status === 'HADIR' || day.guru_status === 'BELUM_ADA_DATA'
        ? 0
        : day.guru_status === 'PARSIAL'
          ? day.detail_guru.length
          : day.total_blok

      return {
        tanggal: day.tanggal,
        hariNama: HARI[hariNum(new Date(day.tanggal + 'T00:00:00'))],
        totalBlok: day.total_blok,
        blokHadir: Math.max(0, day.total_blok - blokTidakHadir),
        blokTidakHadir,
        statusHari: day.status_akhir === 'PARSIAL' ? 'HADIR PARSIAL' : day.status_akhir,
        statusGuru: day.guru_status,
        statusWaliKelas: day.wali_status,
        sumberStatus: day.sumber_status,
        keteranganWaliKelas: day.keterangan_wali_kelas,
        detail: day.detail_guru,
      }
    })

  const summary = { hadir: 0, parsial: 0, sakit: 0, izin: 0, alfa: 0, belum_ada_data: 0 }
  for (const day of days) {
    if (day.statusHari === 'HADIR') summary.hadir++
    else if (day.statusHari === 'HADIR PARSIAL') summary.parsial++
    else if (day.statusHari === 'SAKIT') summary.sakit++
    else if (day.statusHari === 'IZIN') summary.izin++
    else if (day.statusHari === 'ALFA') summary.alfa++
    else summary.belum_ada_data++
  }

  return {
    error: null,
    siswa: { nama: result.siswa.nama_lengkap, nisn: result.siswa.nisn, kelas: result.kelas_label },
    days,
    summary,
    totalHari: days.length,
  }
}

export async function getAbsensiPerKelas(tanggal: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const roles = await getUserRoles(db, user.id)
  const kelasList = await getAccessibleWaliKelasClasses(db, user.id, roles)
  const data: any[] = []

  for (const kelas of kelasList) {
    const classData = await getFinalAttendanceForClass(db, kelas.id, tanggal, tanggal)
    if (!classData) continue

    let hadir = 0
    let sakit = 0
    let izin = 0
    let alfa = 0
    let parsial = 0
    let belumAdaData = 0

    for (const siswa of classData.siswa) {
      const status = classData.statusByStudent.get(siswa.id)?.[0]?.status_akhir || 'BELUM_ADA_DATA'
      if (status === 'SAKIT') sakit++
      else if (status === 'IZIN') izin++
      else if (status === 'ALFA') alfa++
      else if (status === 'PARSIAL') parsial++
      else if (status === 'BELUM_ADA_DATA') belumAdaData++
      else hadir++
    }

    data.push({
      kelas_id: kelas.id,
      tingkat: kelas.tingkat,
      label: kelas.label,
      total: classData.siswa.length,
      hadir,
      sakit,
      izin,
      alfa,
      parsial,
      belum_ada_data: belumAdaData,
    })
  }

  return { error: null, data }
}

export async function getDetailKelasHarian(kelasId: string, tanggal: string) {
  const db = await getDB()
  const classData = await getFinalAttendanceForClass(db, kelasId, tanggal, tanggal)
  if (!classData) return []

  return classData.siswa
    .map(siswa => classData.statusByStudent.get(siswa.id)?.[0])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter(item => !['HADIR', 'BELUM_ADA_DATA'].includes(item.status_akhir))
    .map(item => ({
      siswa_id: item.siswa_id,
      nama_lengkap: item.nama_lengkap,
      nisn: item.nisn,
      status: item.status_akhir,
      status_guru: item.guru_status,
      status_wali_kelas: item.wali_status,
      sumber_status: item.sumber_status,
      catatan: item.keterangan_wali_kelas || item.detail_guru.map(detail => detail.catatan).filter(Boolean).join(' • '),
      detail_guru: item.detail_guru,
      jam_ke_mulai: item.detail_guru[0]?.jam_ke_mulai ?? null,
      jam_ke_selesai: item.detail_guru[item.detail_guru.length - 1]?.jam_ke_selesai ?? null,
      nama_mapel: item.detail_guru.map(detail => detail.nama_mapel).join(', '),
    }))
}

export async function getAbsensiPerJam(tanggal: string) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran belum diatur', data: [], slots: [] }

  const hari = hariNum(new Date(tanggal + 'T00:00:00'))
  if (hari === 7) return { error: null, data: [], slots: [], hariNama: 'Minggu' }

  const slots = getSlotsHari(ta.jam_pelajaran || '[]', hari)

  const res = await db.prepare(`
    SELECT ab.jam_ke_mulai, ab.jam_ke_selesai, ab.siswa_id, ab.status,
      s.nama_lengkap, mp.nama_mapel, k.tingkat, k.nomor_kelas, k.kelompok
    FROM absensi_siswa ab
    JOIN siswa s ON ab.siswa_id = s.id
    JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE ab.tanggal = ?
    ORDER BY ab.jam_ke_mulai, s.nama_lengkap
  `).bind(tanggal).all<any>()

  const jamMap = new Map<number, any[]>()
  for (const row of res.results || []) {
    for (let jam = row.jam_ke_mulai; jam <= row.jam_ke_selesai; jam++) {
      if (!jamMap.has(jam)) jamMap.set(jam, [])
      if (!jamMap.get(jam)!.find((item: any) => item.siswa_id === row.siswa_id)) {
        jamMap.get(jam)!.push(row)
      }
    }
  }

  const data = slots.map(slot => ({
    jam_ke: slot.id,
    nama: slot.nama,
    mulai: slot.mulai,
    selesai: slot.selesai,
    tidak_hadir: (jamMap.get(slot.id) || []).length,
    detail: jamMap.get(slot.id) || [],
  }))

  return { error: null, data, slots, hariNama: HARI[hari] }
}

export async function getDataCetakAbsensi(params: {
  tglMulai: string
  tglSelesai: string
  kelasId?: string
  siswaId?: string
  statusFilter?: string
}) {
  const db = await getDB()
  let sql = `
    SELECT ab.tanggal, ab.jam_ke_mulai, ab.jam_ke_selesai, ab.jumlah_jam, ab.status, ab.catatan,
      s.nama_lengkap, s.nisn, mp.nama_mapel, u.nama_lengkap as guru_nama,
      k.tingkat, k.nomor_kelas, k.kelompok
    FROM absensi_siswa ab
    JOIN siswa s ON ab.siswa_id = s.id
    JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN "user" u ON pm.guru_id = u.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE ab.tanggal BETWEEN ? AND ?
  `
  const p: unknown[] = [params.tglMulai, params.tglSelesai]

  if (params.kelasId) { sql += ' AND pm.kelas_id = ?'; p.push(params.kelasId) }
  if (params.siswaId) { sql += ' AND ab.siswa_id = ?'; p.push(params.siswaId) }
  if (params.statusFilter && params.statusFilter !== 'semua') { sql += ' AND ab.status = ?'; p.push(params.statusFilter) }

  sql += ' ORDER BY ab.tanggal, k.tingkat, k.kelompok, k.nomor_kelas, s.nama_lengkap, ab.jam_ke_mulai'
  return (await db.prepare(sql).bind(...p).all<any>()).results || []
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
