// Lokasi: app/dashboard/rekap-absensi/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { formatNamaKelas } from '@/lib/utils'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'

// ============================================================
// HELPER
// ============================================================
function getSlotsHari(raw: string, hari: number): SlotJam[] {
  try { return (JSON.parse(raw) as PolaJam[]).find(p => p.hari.includes(hari))?.slots ?? [] } catch { return [] }
}
function hariNum(d: Date): number { const day = d.getDay(); return day === 0 ? 7 : day }
const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

// ============================================================
// FILTER OPTIONS
// ============================================================
export async function getRekapFilterOptions() {
  const db = await getDB()
  const [kelasRes, siswaRes] = await Promise.all([
    db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat, kelompok, nomor_kelas').all<any>(),
    db.prepare(`SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id WHERE s.status = 'aktif' ORDER BY s.nama_lengkap`).all<any>(),
  ])
  return {
    kelas: (kelasRes.results || []).map((k: any) => ({ id: k.id, tingkat: k.tingkat, label: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok) })),
    siswa: (siswaRes.results || []).map((s: any) => ({
      id: s.id, nama: s.nama_lengkap, nisn: s.nisn,
      kelas_label: formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok),
    })),
  }
}

// ============================================================
// 1. PER SISWA — harian detail + BOLOS detection
// ============================================================
export async function getAbsensiPerSiswa(siswaId: string, tglMulai: string, tglSelesai: string) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', data: [] }

  // Ambil siswa info
  const siswa = await db.prepare(
    `SELECT s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok, s.kelas_id
     FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id WHERE s.id = ?`
  ).bind(siswaId).first<any>()
  if (!siswa) return { error: 'Siswa tidak ditemukan', data: [] }

  // Ambil semua absensi (non-HADIR) dalam rentang
  const absensiRes = await db.prepare(`
    SELECT ab.tanggal, ab.jam_ke_mulai, ab.jam_ke_selesai, ab.jumlah_jam, ab.status, ab.catatan,
      mp.nama_mapel, u.nama_lengkap as guru_nama
    FROM absensi_siswa ab
    JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN "user" u ON pm.guru_id = u.id
    WHERE ab.siswa_id = ? AND ab.tanggal BETWEEN ? AND ?
    ORDER BY ab.tanggal, ab.jam_ke_mulai
  `).bind(siswaId, tglMulai, tglSelesai).all<any>()

  // Ambil jadwal kelas siswa ini (untuk mengetahui total jam per hari)
  const jadwalRes = await db.prepare(`
    SELECT jm.hari, jm.jam_ke, jm.penugasan_id, mp.nama_mapel
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ?
    ORDER BY jm.hari, jm.jam_ke
  `).bind(siswa.kelas_id, ta.id).all<any>()

  // Build per-hari: count total jam, hadir, tidak hadir
  const absensiMap = new Map<string, any[]>() // tanggal → records
  for (const r of absensiRes.results || []) {
    if (!absensiMap.has(r.tanggal)) absensiMap.set(r.tanggal, [])
    absensiMap.get(r.tanggal)!.push(r)
  }

  // Group jadwal per hari
  const jadwalPerHari = new Map<number, number>() // hari → count penugasan blocks
  const jadwalPenugasanPerHari = new Map<number, Set<string>>()
  for (const r of jadwalRes.results || []) {
    if (!jadwalPenugasanPerHari.has(r.hari)) jadwalPenugasanPerHari.set(r.hari, new Set())
    jadwalPenugasanPerHari.get(r.hari)!.add(r.penugasan_id)
  }
  for (const [hari, penSet] of jadwalPenugasanPerHari) jadwalPerHari.set(hari, penSet.size)

  // Build daily data
  const days: any[] = []
  const start = new Date(tglMulai + 'T00:00:00')
  const end = new Date(tglSelesai + 'T00:00:00')
  const d = new Date(start)
  while (d <= end) {
    const tgl = d.toISOString().split('T')[0]
    const hari = hariNum(d)
    const totalBlok = jadwalPerHari.get(hari) || 0
    if (hari <= 6 && totalBlok > 0) {
      const absRecords = absensiMap.get(tgl) || []
      const blokTidakHadir = absRecords.length
      const blokHadir = totalBlok - blokTidakHadir

      // BOLOS = ada jam hadir DAN ada jam alfa/tidak hadir di hari yang sama
      let statusHari = 'HADIR'
      if (blokTidakHadir === totalBlok) {
        // Semua tidak hadir
        const allSakit = absRecords.every((r: any) => r.status === 'SAKIT')
        const allIzin = absRecords.every((r: any) => r.status === 'IZIN')
        statusHari = allSakit ? 'SAKIT' : allIzin ? 'IZIN' : 'ALFA'
      } else if (blokTidakHadir > 0 && blokHadir > 0) {
        statusHari = 'HADIR PARSIAL'
      }

      days.push({
        tanggal: tgl, hariNama: HARI[hari], totalBlok, blokHadir, blokTidakHadir,
        statusHari, detail: absRecords,
      })
    }
    d.setDate(d.getDate() + 1)
  }

  // Summary
  const summary = { hadir: 0, parsial: 0, sakit: 0, izin: 0, alfa: 0 }
  for (const day of days) {
    if (day.statusHari === 'HADIR') summary.hadir++
    else if (day.statusHari === 'HADIR PARSIAL') summary.parsial++
    else if (day.statusHari === 'SAKIT') summary.sakit++
    else if (day.statusHari === 'IZIN') summary.izin++
    else summary.alfa++
  }

  return {
    error: null,
    siswa: { nama: siswa.nama_lengkap, nisn: siswa.nisn, kelas: formatNamaKelas(siswa.tingkat, siswa.nomor_kelas, siswa.kelompok) },
    days, summary, totalHari: days.length,
  }
}

// ============================================================
// 2. PER KELAS — ringkasan per kelas untuk tanggal tertentu
// ============================================================
export async function getAbsensiPerKelas(tanggal: string) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', data: [] }

  // Ambil semua kelas + jumlah siswa aktif
  const kelasRes = await db.prepare(`
    SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok,
      (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id = k.id AND s.status = 'aktif') as total_siswa
    FROM kelas k ORDER BY k.tingkat, k.kelompok, k.nomor_kelas
  `).all<any>()

  // Ambil semua absensi hari itu, group per kelas
  const absenRes = await db.prepare(`
    SELECT pm.kelas_id, ab.siswa_id, ab.status
    FROM absensi_siswa ab
    JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
    WHERE ab.tanggal = ?
  `).bind(tanggal).all<any>()

  // Group: kelas_id → { siswa_id → Set<status> }
  const kelasAbsen = new Map<string, Map<string, Set<string>>>()
  for (const r of absenRes.results || []) {
    if (!kelasAbsen.has(r.kelas_id)) kelasAbsen.set(r.kelas_id, new Map())
    const siswaMap = kelasAbsen.get(r.kelas_id)!
    if (!siswaMap.has(r.siswa_id)) siswaMap.set(r.siswa_id, new Set())
    siswaMap.get(r.siswa_id)!.add(r.status)
  }

  const data = (kelasRes.results || []).map((k: any) => {
    const sm = kelasAbsen.get(k.id) || new Map()
    let sakit = 0, alfa = 0, izin = 0, bolos = 0
    // siswa yang punya record non-hadir
    const tidakHadirIds = new Set<string>()
    for (const [sid, statuses] of sm) {
      tidakHadirIds.add(sid)
      if (statuses.has('SAKIT')) sakit++
      else if (statuses.has('IZIN')) izin++
      else if (statuses.has('ALFA')) alfa++
    }
    const hadir = k.total_siswa - tidakHadirIds.size

    return {
      kelas_id: k.id, tingkat: k.tingkat,
      label: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
      total: k.total_siswa, hadir, sakit, izin, alfa,
    }
  })

  return { error: null, data }
}

// ============================================================
// 2b. DETAIL KELAS — siapa saja yang tidak hadir
// ============================================================
export async function getDetailKelasHarian(kelasId: string, tanggal: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT ab.siswa_id, s.nama_lengkap, s.nisn, ab.status, ab.catatan,
      ab.jam_ke_mulai, ab.jam_ke_selesai, mp.nama_mapel
    FROM absensi_siswa ab
    JOIN siswa s ON ab.siswa_id = s.id
    JOIN penugasan_mengajar pm ON ab.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    WHERE pm.kelas_id = ? AND ab.tanggal = ?
    ORDER BY s.nama_lengkap, ab.jam_ke_mulai
  `).bind(kelasId, tanggal).all<any>()
  return res.results || []
}

// ============================================================
// 3. PER JAM PELAJARAN — siapa tidak hadir di jam tertentu
// ============================================================
export async function getAbsensiPerJam(tanggal: string) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran belum diatur', data: [], slots: [] }

  const hari = hariNum(new Date(tanggal + 'T00:00:00'))
  if (hari === 7) return { error: null, data: [], slots: [], hariNama: 'Minggu' }

  const slots = getSlotsHari(ta.jam_pelajaran || '[]', hari)

  // Ambil semua absensi hari itu dgn info jam
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

  // Group per jam_ke → expand range
  const jamMap = new Map<number, any[]>()
  for (const r of res.results || []) {
    for (let j = r.jam_ke_mulai; j <= r.jam_ke_selesai; j++) {
      if (!jamMap.has(j)) jamMap.set(j, [])
      // Avoid duplicates
      if (!jamMap.get(j)!.find((x: any) => x.siswa_id === r.siswa_id)) {
        jamMap.get(j)!.push(r)
      }
    }
  }

  const data = slots.map(slot => ({
    jam_ke: slot.id, nama: slot.nama, mulai: slot.mulai, selesai: slot.selesai,
    tidak_hadir: (jamMap.get(slot.id) || []).length,
    detail: jamMap.get(slot.id) || [],
  }))

  return { error: null, data, slots, hariNama: HARI[hari] }
}

// ============================================================
// 4. DATA CETAK — flexible query
// ============================================================
export async function getDataCetakAbsensi(params: {
  tglMulai: string; tglSelesai: string
  kelasId?: string; siswaId?: string
  statusFilter?: string // 'semua' | 'SAKIT' | 'ALFA' | 'IZIN'
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

// ============================================================
// 5. WALI KELAS — ambil nama wali kelas untuk siswa tertentu
// ============================================================
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
