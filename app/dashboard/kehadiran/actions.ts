// Lokasi: app/dashboard/kehadiran/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'
import { formatNamaKelas } from '@/lib/utils'
import { getEffectiveUser, getActAsDate } from '@/lib/act-as'

// ============================================================
// TYPES
// ============================================================
export type BlokMengajar = {
  penugasan_id: string
  mapel_nama: string
  kelas_id: string
  kelas_label: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  jumlah_jam: number
  slot_mulai: string
  slot_selesai: string
  sudah_absen: boolean
  total_siswa: number
  tidak_hadir: number
}

export type SiswaAbsensi = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  status: 'HADIR' | 'SAKIT' | 'ALFA' | 'IZIN'
  catatan: string
  ada_izin: boolean
  alasan_izin: string
  keterangan_wali_kelas: string | null  // non-null jika wali kelas sudah input keterangan
}

// ============================================================
// HELPER
// ============================================================
function getSlotsHari(raw: string, hari: number): SlotJam[] {
  try {
    const list: PolaJam[] = JSON.parse(raw)
    return list.find(p => p.hari.includes(hari))?.slots ?? []
  } catch { return [] }
}

function hariNum(d: Date): number { const day = d.getDay(); return day === 0 ? 7 : day }

// ============================================================
// 1. AMBIL BLOK MENGAJAR GURU HARI INI
//    Menerima optional guruId untuk fitur Act As
//    dan dateOverride untuk admin memilih tanggal
// ============================================================
export async function getBlokMengajarHariIni(guruIdOverride?: string, dateOverride?: string): Promise<{
  error: string | null
  blocks: BlokMengajar[]
  tanggal: string
  hari: number
  hariNama: string
}> {
  const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', blocks: [], tanggal: '', hari: 0, hariNama: '' }

  // Gunakan guruIdOverride jika tersedia (dari Act As), atau cek cookie act-as, fallback ke user.id
  let guruId = guruIdOverride || user.id
  if (!guruIdOverride) {
    const effective = await getEffectiveUser()
    if (effective?.isActingAs) {
      guruId = effective.effectiveUserId
    }
  }

  const db = await getDB()

  // Gunakan dateOverride jika tersedia (admin memilih tanggal)
  // Jika tidak ada explicit override, baca dari cookie act-as-date
  let tanggal: string
  let hari: number
  const resolvedDateOverride = dateOverride || (await getActAsDate()) || null
  if (resolvedDateOverride && /^\d{4}-\d{2}-\d{2}$/.test(resolvedDateOverride)) {
    tanggal = resolvedDateOverride
    // Hitung hari dari tanggal override: 1=Senin...7=Minggu
    const d = new Date(resolvedDateOverride + 'T00:00:00')
    const day = d.getDay()
    hari = day === 0 ? 7 : day
  } else {
    const now = new Date()
    tanggal = now.toISOString().split('T')[0]
    hari = hariNum(now)
  }

  if (hari === 7) return { error: null, blocks: [], tanggal, hari, hariNama: 'Minggu' }

  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', blocks: [], tanggal, hari, hariNama: HARI[hari] }

  const slots = getSlotsHari(ta.jam_pelajaran || '[]', hari)
  if (!slots.length) return { error: null, blocks: [], tanggal, hari, hariNama: HARI[hari] }

  const rows = (await db.prepare(`
    SELECT jm.penugasan_id, jm.jam_ke,
      mp.nama_mapel, k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ? AND pm.guru_id = ?
    ORDER BY jm.jam_ke
  `).bind(ta.id, hari, guruId).all<any>()).results || []

  if (!rows.length) return { error: null, blocks: [], tanggal, hari, hariNama: HARI[hari] }

  // Ambil absensi + total siswa per kelas (batch efisien)
  const kelasIds = [...new Set(rows.map((r: any) => r.kelas_id))]
  const penugasanIds = [...new Set(rows.map((r: any) => r.penugasan_id))]

  const [siswaCountRes, absenCountRes] = await Promise.all([
    db.prepare(
      `SELECT kelas_id, COUNT(*) as cnt FROM siswa WHERE status = 'aktif' AND kelas_id IN (${kelasIds.map(() => '?').join(',')}) GROUP BY kelas_id`
    ).bind(...kelasIds).all<any>(),
    db.prepare(
      `SELECT penugasan_id, COUNT(*) as cnt FROM absensi_siswa WHERE tanggal = ? AND penugasan_id IN (${penugasanIds.map(() => '?').join(',')}) GROUP BY penugasan_id`
    ).bind(tanggal, ...penugasanIds).all<any>(),
  ])

  const siswaCountMap = new Map((siswaCountRes.results || []).map((r: any) => [r.kelas_id, r.cnt]))
  const absenCountMap = new Map((absenCountRes.results || []).map((r: any) => [r.penugasan_id, r.cnt]))

  // Group per penugasan
  const grouped = new Map<string, any[]>()
  for (const r of rows) {
    if (!grouped.has(r.penugasan_id)) grouped.set(r.penugasan_id, [])
    grouped.get(r.penugasan_id)!.push(r)
  }

  const blocks: BlokMengajar[] = []
  for (const [pid, pRows] of grouped) {
    const jamList = pRows.map((r: any) => r.jam_ke).sort((a: number, b: number) => a - b)
    const f = pRows[0]
    const jM = jamList[0], jS = jamList[jamList.length - 1]
    const sM = slots.find(s => s.id === jM), sS = slots.find(s => s.id === jS)
    const totalSiswa = siswaCountMap.get(f.kelas_id) || 0
    const tidakHadir = absenCountMap.get(pid) || 0

    blocks.push({
      penugasan_id: pid, mapel_nama: f.nama_mapel,
      kelas_id: f.kelas_id, kelas_label: formatNamaKelas(f.tingkat, f.nomor_kelas, f.kelompok),
      jam_ke_mulai: jM, jam_ke_selesai: jS, jumlah_jam: jamList.length,
      slot_mulai: sM?.mulai ?? '-', slot_selesai: sS?.selesai ?? '-',
      sudah_absen: tidakHadir > 0, total_siswa: totalSiswa, tidak_hadir: tidakHadir,
    })
  }
  blocks.sort((a, b) => a.jam_ke_mulai - b.jam_ke_mulai)
  return { error: null, blocks, tanggal, hari, hariNama: HARI[hari] }
}

// ============================================================
// 2. LOAD SISWA + ABSENSI EXISTING + IZIN AKTIF
// ============================================================
export async function loadSiswaAbsensi(penugasanId: string, kelasId: string, tanggal: string): Promise<{
  error: string | null; siswa: SiswaAbsensi[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', siswa: [] }
  const db = await getDB()

  const [siswaRes, absensiRes, izinRes, waliKelasRes] = await Promise.all([
    db.prepare(`SELECT id, nama_lengkap, nisn FROM siswa WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama_lengkap`).bind(kelasId).all<any>(),
    db.prepare(`SELECT siswa_id, status, catatan FROM absensi_siswa WHERE penugasan_id = ? AND tanggal = ?`).bind(penugasanId, tanggal).all<any>(),
    db.prepare(`SELECT siswa_id, alasan FROM izin_tidak_masuk_kelas WHERE tanggal = ? AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`).bind(tanggal, kelasId).all<any>(),
    db.prepare(`SELECT siswa_id, status, keterangan FROM keterangan_absensi_wali_kelas WHERE tanggal = ? AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`).bind(tanggal, kelasId).all<any>(),
  ])

  const absenMap = new Map<string, { status: string; catatan: string }>()
  for (const a of absensiRes.results || []) absenMap.set(a.siswa_id, { status: a.status, catatan: a.catatan || '' })
  const izinMap = new Map<string, string>()
  for (const i of izinRes.results || []) izinMap.set(i.siswa_id, i.alasan || 'Izin')
  const waliMap = new Map<string, { status: string; keterangan: string }>()
  for (const w of waliKelasRes.results || []) waliMap.set(w.siswa_id, { status: w.status, keterangan: w.keterangan || '' })

  return {
    error: null,
    siswa: (siswaRes.results || []).map((s: any) => {
      const ab = absenMap.get(s.id)
      const adaIzin = izinMap.has(s.id)
      const wali = waliMap.get(s.id)

      // Prioritas status: absensi guru (sudah disimpan) > keterangan wali kelas > izin_tidak_masuk_kelas > HADIR
      let status: SiswaAbsensi['status']
      let catatan: string
      if (ab) {
        status = ab.status as any
        catatan = ab.catatan
      } else if (wali) {
        status = wali.status as any
        catatan = `Keterangan dari wali kelas${wali.keterangan ? ': ' + wali.keterangan : ''}`
      } else if (adaIzin) {
        status = 'IZIN'
        catatan = ''
      } else {
        status = 'HADIR'
        catatan = ''
      }

      return {
        siswa_id: s.id, nama_lengkap: s.nama_lengkap, nisn: s.nisn,
        status, catatan,
        ada_izin: adaIzin, alasan_izin: izinMap.get(s.id) || '',
        keterangan_wali_kelas: wali ? (wali.keterangan || wali.status) : null,
      }
    }),
  }
}

// ============================================================
// 3. SIMPAN ABSENSI BATCH (sparse: hanya non-HADIR)
//    Mendukung Act As: diinput_oleh = real admin user ID
// ============================================================
export async function simpanAbsensi(
  penugasanId: string, tanggal: string,
  jamKeMulai: number, jamKeSelesai: number, jumlahJam: number,
  dataAbsen: Array<{ siswa_id: string; status: string; catatan: string }>
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // Cek act-as: gunakan real user ID untuk audit trail
  const effective = await getEffectiveUser()
  const diinputOleh = effective?.realUserId || user.id

  const db = await getDB()

  const toSave = dataAbsen.filter(d => d.status !== 'HADIR')
  const delStmt = db.prepare('DELETE FROM absensi_siswa WHERE penugasan_id = ? AND tanggal = ?').bind(penugasanId, tanggal)

  if (toSave.length === 0) {
    try { await delStmt.run() } catch (e: any) { return { error: e.message } }
    revalidatePath('/dashboard/kehadiran')
    return { success: 'Absensi disimpan! Semua siswa HADIR.' }
  }

  const insStmts = toSave.map(d =>
    db.prepare(
      `INSERT INTO absensi_siswa (penugasan_id,siswa_id,tanggal,jam_ke_mulai,jam_ke_selesai,jumlah_jam,status,catatan,diinput_oleh) VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(penugasanId, d.siswa_id, tanggal, jamKeMulai, jamKeSelesai, jumlahJam, d.status, d.catatan || null, diinputOleh)
  )

  try {
    const all = [delStmt, ...insStmts]
    for (let i = 0; i < all.length; i += 100) await db.batch(all.slice(i, i + 100))
  } catch (e: any) { return { error: e.message } }

  revalidatePath('/dashboard/kehadiran')
  return { success: `Absensi disimpan! ${toSave.length} siswa tidak hadir.` }
}
