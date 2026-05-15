// Lokasi: app/dashboard/kehadiran/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'
import { formatNamaKelas } from '@/lib/utils'
import { getEffectiveUser, getActAsDate } from '@/lib/act-as'
import { currentTimeWIB, todayWIB, nowWIB } from '@/lib/time'
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'
import { getKalenderDateStatus } from '@/lib/kalender-pendidikan'

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

async function ensureAbsensiSessionTable(db: D1Database) {
  await db.prepare(`
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
  `).run()
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_absensi_sesi_guru_penugasan_tgl
    ON absensi_sesi_guru(penugasan_id, tanggal)
  `).run()
}

export type SiswaAbsensi = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  foto_url: string | null
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

function parseIzinJamPelajaran(raw: unknown): number[] | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? [raw] : []

  const text = String(raw).trim()
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter(Number.isFinite)
    }
    const n = Number(parsed)
    return Number.isFinite(n) ? [n] : []
  } catch {
    const n = Number(text)
    return Number.isFinite(n) ? [n] : []
  }
}

function jamBeririsan(jamIzin: number[] | null, jamKeMulai?: number, jamKeSelesai?: number): boolean {
  if (jamIzin === null) return true
  if (!jamIzin.length) return false
  if (!jamKeMulai || !jamKeSelesai) return true
  return jamIzin.some(jam => jam >= jamKeMulai && jam <= jamKeSelesai)
}

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
  calendarStatus?: { isEffective: boolean; reason: string | null; category: string | null }
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
  await ensureAbsensiSessionTable(db)

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
    // Gunakan WIB (UTC+7) agar tanggal & hari tidak terbalik di dini hari
    const now = nowWIB()
    tanggal = todayWIB()
    hari = hariNum(now)
  }

  if (hari === 7) return { error: null, blocks: [], tanggal, hari, hariNama: 'Minggu' }

  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return {
      error: null,
      blocks: [],
      tanggal,
      hari,
      hariNama: HARI[hari],
      calendarStatus: {
        isEffective: false,
        reason: calendarStatus.reason,
        category: calendarStatus.category,
      },
    }
  }

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
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND (
        pm.guru_id = ?
        OR pm.id IN (
          SELECT DISTINCT jm2.penugasan_id
          FROM jadwal_mengajar jm2
          JOIN guru_ppl_mapping jpp ON jpp.jadwal_mengajar_id = jm2.id
          WHERE jpp.guru_ppl_id = ?
        )
      )
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
    ORDER BY jm.jam_ke
  `).bind(ta.id, hari, guruId, guruId, tanggal).all<any>()).results || []

  if (!rows.length) return { error: null, blocks: [], tanggal, hari, hariNama: HARI[hari] }

  // Ambil absensi + total siswa per kelas (batch efisien)
  const kelasIds = [...new Set(rows.map((r: any) => r.kelas_id))]
  const penugasanIds = [...new Set(rows.map((r: any) => r.penugasan_id))]

  const [siswaCountRes, absenCountRes, sesiRes] = await Promise.all([
    db.prepare(
      `SELECT kelas_id, COUNT(*) as cnt FROM siswa WHERE status = 'aktif' AND kelas_id IN (${kelasIds.map(() => '?').join(',')}) GROUP BY kelas_id`
    ).bind(...kelasIds).all<any>(),
    db.prepare(
      `SELECT penugasan_id, COUNT(*) as cnt FROM absensi_siswa WHERE tanggal = ? AND penugasan_id IN (${penugasanIds.map(() => '?').join(',')}) GROUP BY penugasan_id`
    ).bind(tanggal, ...penugasanIds).all<any>(),
    db.prepare(
      `SELECT penugasan_id FROM absensi_sesi_guru WHERE tanggal = ? AND penugasan_id IN (${penugasanIds.map(() => '?').join(',')})`
    ).bind(tanggal, ...penugasanIds).all<any>(),
  ])

  const siswaCountMap = new Map((siswaCountRes.results || []).map((r: any) => [r.kelas_id, r.cnt]))
  const absenCountMap = new Map((absenCountRes.results || []).map((r: any) => [r.penugasan_id, r.cnt]))
  const sesiSet = new Set((sesiRes.results || []).map((r: any) => r.penugasan_id))

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
      sudah_absen: sesiSet.has(pid), total_siswa: totalSiswa, tidak_hadir: tidakHadir,
    })
  }
  blocks.sort((a, b) => a.jam_ke_mulai - b.jam_ke_mulai)
  return { error: null, blocks, tanggal, hari, hariNama: HARI[hari] }
}

// ============================================================
// 2. LOAD SISWA + ABSENSI EXISTING + IZIN AKTIF
// ============================================================
export async function loadSiswaAbsensi(penugasanId: string, kelasId: string, tanggal: string, jamKeMulai?: number, jamKeSelesai?: number): Promise<{
  error: string | null; siswa: SiswaAbsensi[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', siswa: [] }
  const db = await getDB()

  const [siswaRes, absensiRes, izinRes, izinKeluarRes, waliKelasRes] = await Promise.all([
    db.prepare(`SELECT id, nama_lengkap, nisn, foto_url FROM siswa WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama_lengkap`).bind(kelasId).all<any>(),
    db.prepare(`SELECT siswa_id, status, catatan FROM absensi_siswa WHERE penugasan_id = ? AND tanggal = ?`).bind(penugasanId, tanggal).all<any>(),
    db.prepare(`SELECT siswa_id, alasan, jam_pelajaran FROM izin_tidak_masuk_kelas WHERE tanggal = ? AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`).bind(tanggal, kelasId).all<any>(),
    db.prepare(`SELECT siswa_id, keterangan FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI' AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`).bind(kelasId).all<any>(),
    db.prepare(`SELECT siswa_id, status, keterangan FROM keterangan_absensi_wali_kelas WHERE tanggal = ? AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`).bind(tanggal, kelasId).all<any>(),
  ])

  const absenMap = new Map<string, { status: string; catatan: string }>()
  for (const a of absensiRes.results || []) absenMap.set(a.siswa_id, { status: a.status, catatan: a.catatan || '' })
  const izinMap = new Map<string, string>()
  for (const i of izinRes.results || []) {
    if (jamBeririsan(parseIzinJamPelajaran(i.jam_pelajaran), jamKeMulai, jamKeSelesai)) {
      izinMap.set(i.siswa_id, i.alasan || 'Izin')
    }
  }
  for (const i of izinKeluarRes.results || []) {
    if (!izinMap.has(i.siswa_id)) {
      izinMap.set(i.siswa_id, i.keterangan ? `Keluar komplek: ${i.keterangan}` : 'Keluar komplek')
    }
  }
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
        siswa_id: s.id, nama_lengkap: s.nama_lengkap, nisn: s.nisn, foto_url: s.foto_url ?? null,
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
  slotMulai: string, slotSelesai: string,
  jamKeMulai: number, jamKeSelesai: number, jumlahJam: number,
  dataAbsen: Array<{ siswa_id: string; status: string; catatan: string }>
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // Cek act-as: gunakan real user ID untuk audit trail
  const effective = await getEffectiveUser()
  const diinputOleh = effective?.realUserId || user.id

  const db = await getDB()
  await ensureAbsensiSessionTable(db)
  const calendarStatus = await getKalenderDateStatus(db, tanggal)
  if (!calendarStatus.isEffective) {
    return { error: `Tanggal ini tidak efektif pembelajaran${calendarStatus.reason ? `: ${calendarStatus.reason}` : ''}. Absensi tidak perlu disimpan.` }
  }

  const penugasan = await db.prepare(`
    SELECT k.kbm_nonaktif_mulai
    FROM penugasan_mengajar pm
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE pm.id = ?
  `).bind(penugasanId).first<{ kbm_nonaktif_mulai: string | null }>()
  if (!penugasan) return { error: 'Penugasan tidak ditemukan.' }
  if (penugasan.kbm_nonaktif_mulai && penugasan.kbm_nonaktif_mulai <= tanggal) {
    return { error: 'Kelas ini sudah dinonaktifkan dari kewajiban KBM. Absensi tidak perlu disimpan.' }
  }
  const attendanceTimeRestrictionEnabled = await getSystemSettingBoolean(
    SYSTEM_SETTING_KEYS.attendanceTimeRestriction,
    false
  )

  if (attendanceTimeRestrictionEnabled) {
    const { hours, minutes } = currentTimeWIB()
    const [mulaiH, mulaiM] = slotMulai.split(':').map(Number)
    const [selesaiH, selesaiM] = slotSelesai.split(':').map(Number)

    const mulaiMinutes = (mulaiH * 60 + mulaiM) - 5
    const selesaiMinutes = selesaiH * 60 + selesaiM
    const currentMinutes = hours * 60 + minutes

    if (currentMinutes < mulaiMinutes) {
      return { error: `Belum waktunya. Absensi bisa diisi mulai pukul ${slotMulai}.` }
    }
    if (currentMinutes > selesaiMinutes) {
      return { error: `Waktu pengisian absensi sudah berakhir (batas: ${slotSelesai}).` }
    }
  }

  const toSave = dataAbsen.filter(d => d.status !== 'HADIR')
  const delStmt = db.prepare('DELETE FROM absensi_siswa WHERE penugasan_id = ? AND tanggal = ?').bind(penugasanId, tanggal)
  const upsertSesiStmt = db.prepare(`
    INSERT INTO absensi_sesi_guru (penugasan_id, tanggal, submitted_at, diinput_oleh, updated_at)
    VALUES (?, ?, datetime('now'), ?, datetime('now'))
    ON CONFLICT(penugasan_id, tanggal) DO UPDATE SET
      submitted_at = excluded.submitted_at,
      diinput_oleh = excluded.diinput_oleh,
      updated_at = excluded.updated_at
  `).bind(penugasanId, tanggal, diinputOleh)

  if (toSave.length === 0) {
    try { await db.batch([delStmt, upsertSesiStmt]) } catch (e: any) { return { error: e.message } }
    revalidatePath('/dashboard/kehadiran')
    revalidatePath('/dashboard/rekap-absensi')
    return { success: 'Absensi disimpan! Semua siswa HADIR.' }
  }

  const insStmts = toSave.map(d =>
    db.prepare(
      `INSERT INTO absensi_siswa (penugasan_id,siswa_id,tanggal,jam_ke_mulai,jam_ke_selesai,jumlah_jam,status,catatan,diinput_oleh) VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(penugasanId, d.siswa_id, tanggal, jamKeMulai, jamKeSelesai, jumlahJam, d.status, d.catatan || null, diinputOleh)
  )

  try {
    const all = [delStmt, ...insStmts, upsertSesiStmt]
    for (let i = 0; i < all.length; i += 100) await db.batch(all.slice(i, i + 100))
  } catch (e: any) { return { error: e.message } }

  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: `Absensi disimpan! ${toSave.length} siswa tidak hadir.` }
}
