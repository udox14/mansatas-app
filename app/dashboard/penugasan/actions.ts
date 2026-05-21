// Lokasi: app/dashboard/penugasan/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'
import { nowWIBISO } from '@/lib/time'
import { sendPushNotification } from '@/lib/web-push'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'

// ============================================================
// TYPES
// ============================================================
export type JadwalBlock = {
  penugasan_id: string
  mapel_nama: string
  kelas_id: string
  kelas_label: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  slot_mulai: string
  slot_selesai: string
  sudah_isi_agenda: boolean
  sudah_didelegasi: boolean
}

export type DelegasiMasuk = {
  delegasi_id: string
  delegasi_kelas_id: string
  dari_user_nama: string
  pelaksana_user_id: string | null
  pelaksana_nama: string | null
  tanggal: string
  kelas_id: string
  kelas_label: string
  penugasan_mengajar_id: string
  mapel_nama: string
  tugas: string
  absen_selesai: boolean
  status: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  slot_mulai: string
  slot_selesai: string
}

export type UserOption = {
  id: string
  nama: string
  jam_mulai: number
  jam_selesai: number
  shift_nama: string
}

type GuruPiketRow = {
  id: string
  nama_lengkap: string
  jam_mulai: number
  jam_selesai: number
  nama_shift: string
}

// ============================================================
// HELPERS
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

function parseIzinJamPelajaran(raw: unknown): number[] | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? [raw] : []

  const text = String(raw).trim()
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite)
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

async function getGuruPiketHariIni(db: D1Database, hari: number, excludeUserId?: string): Promise<GuruPiketRow[]> {
  const excludeSql = excludeUserId ? 'AND u.id != ?' : ''
  const excludeArgs = excludeUserId ? [excludeUserId] : []

  const piketRegular = await db.prepare(
    `SELECT u.id, u.nama_lengkap as nama_lengkap, sp.jam_mulai, sp.jam_selesai, sp.nama_shift
     FROM "user" u
     JOIN jadwal_guru_piket j ON u.id = j.user_id
     JOIN pengaturan_shift_piket sp ON j.shift_id = sp.id
     WHERE j.hari = ? AND u.banned = 0 ${excludeSql}
     ORDER BY sp.jam_mulai ASC, u.nama_lengkap ASC`
  ).bind(hari, ...excludeArgs).all<any>()

  const piketPPL = await db.prepare(
    `SELECT u.id, u.nama_lengkap || ' (PPL)' as nama_lengkap, sp.jam_mulai, sp.jam_selesai, sp.nama_shift
     FROM "user" u
     JOIN guru_ppl_mapping jpp ON jpp.guru_ppl_id = u.id
     JOIN jadwal_guru_piket j ON j.id = jpp.jadwal_piket_id
     JOIN pengaturan_shift_piket sp ON j.shift_id = sp.id
     WHERE j.hari = ? AND u.banned = 0 ${excludeSql}
     ORDER BY sp.jam_mulai ASC, u.nama_lengkap ASC`
  ).bind(hari, ...excludeArgs).all<any>()

  const seen = new Set<string>()
  const rows: GuruPiketRow[] = []
  for (const row of [...(piketRegular.results || []), ...(piketPPL.results || [])]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }
  return rows
}

async function isGuruPiketPadaHari(db: D1Database, userId: string, hari: number): Promise<boolean> {
  const regular = await db.prepare(
    `SELECT 1
     FROM jadwal_guru_piket j
     JOIN "user" u ON u.id = j.user_id
     WHERE j.hari = ? AND j.user_id = ? AND u.banned = 0
     LIMIT 1`
  ).bind(hari, userId).first<any>()
  if (regular) return true

  const ppl = await db.prepare(
    `SELECT 1
     FROM guru_ppl_mapping jpp
     JOIN jadwal_guru_piket j ON j.id = jpp.jadwal_piket_id
     JOIN "user" u ON u.id = jpp.guru_ppl_id
     WHERE j.hari = ? AND jpp.guru_ppl_id = ? AND u.banned = 0
     LIMIT 1`
  ).bind(hari, userId).first<any>()
  return !!ppl
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

// ============================================================
// 1. AMBIL JADWAL GURU HARI INI (untuk form kirim tugas)
//    Mirip agenda, tapi juga cek apakah sudah didelegasikan
// ============================================================
export async function getJadwalUntukDelegasi(tanggal: string): Promise<{
  error: string | null
  blocks: JadwalBlock[]
  slots: SlotJam[]
  tanggal: string
  hari: number
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', blocks: [], slots: [], tanggal: '', hari: 0 }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  if (hari === 7) return { error: null, blocks: [], slots: [], tanggal, hari }

  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', blocks: [], slots: [], tanggal, hari }

  const polaList = parsePolaJam(ta.jam_pelajaran || '[]')
  const slots = getSlotsForHari(polaList, hari)
  if (slots.length === 0) return { error: null, blocks: [], slots: [], tanggal, hari }

  // Ambil jadwal guru + cek agenda + cek delegasi existing
  const rows = (await db.prepare(`
    SELECT
      jm.penugasan_id, jm.jam_ke,
      mp.nama_mapel,
      k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
      ag.id as agenda_id,
      dtk.id as delegasi_kelas_id
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    LEFT JOIN delegasi_tugas_kelas dtk ON dtk.penugasan_mengajar_id = jm.penugasan_id
      AND dtk.delegasi_id IN (SELECT id FROM delegasi_tugas WHERE dari_user_id = ? AND tanggal = ?)
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ? AND pm.guru_id = ?
    ORDER BY jm.jam_ke ASC
  `).bind(tanggal, user.id, tanggal, ta.id, hari, user.id).all<any>()).results || []

  if (rows.length === 0) return { error: null, blocks: [], slots, tanggal, hari }

  // Group per penugasan_id
  const grouped = new Map<string, any[]>()
  for (const r of rows) {
    if (!grouped.has(r.penugasan_id)) grouped.set(r.penugasan_id, [])
    grouped.get(r.penugasan_id)!.push(r)
  }

  const blocks: JadwalBlock[] = []
  for (const [pid, pRows] of grouped) {
    const jamList = pRows.map((r: any) => r.jam_ke).sort((a: number, b: number) => a - b)
    const first = pRows[0]
    const jamMulai = jamList[0]
    const jamSelesai = jamList[jamList.length - 1]
    const slotMulai = slots.find(s => s.id === jamMulai)
    const slotSelesai = slots.find(s => s.id === jamSelesai)

    blocks.push({
      penugasan_id: pid,
      mapel_nama: first.nama_mapel,
      kelas_id: first.kelas_id,
      kelas_label: formatNamaKelas(first.tingkat, first.nomor_kelas, first.kelompok),
      jam_ke_mulai: jamMulai,
      jam_ke_selesai: jamSelesai,
      slot_mulai: slotMulai?.mulai ?? '-',
      slot_selesai: slotSelesai?.selesai ?? '-',
      sudah_isi_agenda: !!first.agenda_id,
      sudah_didelegasi: !!first.delegasi_kelas_id,
    })
  }

  blocks.sort((a, b) => a.jam_ke_mulai - b.jam_ke_mulai)
  return { error: null, blocks, slots, tanggal, hari }
}

// ============================================================
// 2. AMBIL DAFTAR GURU PIKET HARI INI (untuk info penerima broadcast)
// ============================================================
export async function getDaftarUser(tanggal: string): Promise<UserOption[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  const rows = await getGuruPiketHariIni(db, hari)
  return rows.map((u: any) => ({
    id: u.id,
    nama: u.nama_lengkap || 'Tanpa Nama',
    jam_mulai: u.jam_mulai,
    jam_selesai: u.jam_selesai,
    shift_nama: u.nama_shift,
  }))
}

// ============================================================
// 3. KIRIM DELEGASI TUGAS
// ============================================================
export async function kirimDelegasiTugas(
  tanggal: string,
  items: Array<{ penugasan_mengajar_id: string; kelas_id: string; tugas: string }>
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  if (!tanggal || items.length === 0) {
    return { error: 'Data tidak lengkap. Pilih minimal satu kelas.' }
  }

  for (const item of items) {
    if (!item.tugas.trim()) return { error: 'Tugas untuk setiap kelas wajib diisi.' }
  }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  const guruPiket = await getGuruPiketHariIni(db, hari)
  if (guruPiket.length === 0) {
    return { error: 'Belum ada guru piket yang bertugas pada hari ini.' }
  }

  // Cek apakah sudah ada delegasi untuk penugasan_mengajar yang sama di tanggal ini
  const penIds = items.map(i => i.penugasan_mengajar_id)
  const placeholders = penIds.map(() => '?').join(',')
  const existing = await db.prepare(`
    SELECT dtk.penugasan_mengajar_id
    FROM delegasi_tugas_kelas dtk
    JOIN delegasi_tugas dt ON dtk.delegasi_id = dt.id
    WHERE dt.tanggal = ? AND dtk.penugasan_mengajar_id IN (${placeholders})
  `).bind(tanggal, ...penIds).all<any>()

  if ((existing.results || []).length > 0) {
    return { error: 'Beberapa kelas sudah didelegasikan hari ini. Batalkan dulu jika ingin mengganti.' }
  }

  // Insert delegasi_tugas
  const delegasiResult = await dbInsert<any>(db, 'delegasi_tugas', {
    dari_user_id: user.id,
    kepada_user_id: null,
    tanggal,
    status: 'DIKIRIM',
  })
  if (delegasiResult.error) return { error: delegasiResult.error }
  const delegasiId = delegasiResult.data?.id

  if (!delegasiId) return { error: 'Gagal membuat delegasi.' }

  // Insert delegasi_tugas_kelas (batch)
  const stmts = items.map(item =>
    db.prepare(
      `INSERT INTO delegasi_tugas_kelas (id, delegasi_id, penugasan_mengajar_id, kelas_id, tugas) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`
    ).bind(delegasiId, item.penugasan_mengajar_id, item.kelas_id, item.tugas.trim())
  )

  try {
    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }
  } catch (e: any) {
    return { error: e.message }
  }

  // Trigger Push Notification
  try {
    const jumlahSesi = items.length;
    await Promise.allSettled(guruPiket.map(piket =>
      sendPushNotification({
        title: 'Tugas Baru Masuk!',
        body: `Ada penugasan piket dari ${user.name || 'Guru'} untuk ${jumlahSesi} sesi kelas pada tanggal ${tanggal}. Siapa pun guru piket hari ini bisa melaksanakan.`,
        url: '/dashboard/penugasan'
      }, { userId: piket.id })
    ));
  } catch (pushErr) {
    console.error("Gagal mengirim push alert ke guru piket:", pushErr);
  }

  revalidatePath('/dashboard/penugasan')
  return { success: `Tugas berhasil dikirim ke ${guruPiket.length} guru piket yang bertugas hari ini.` }
}

// ============================================================
// 4. AMBIL TUGAS MASUK (delegasi yang diterima user)
// ============================================================
export async function getTugasMasuk(tanggal: string): Promise<{
  error: string | null
  data: DelegasiMasuk[]
  slots: SlotJam[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [], slots: [] }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)

  // Get slots for time display
  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()
  const polaList = parsePolaJam(ta?.jam_pelajaran || '[]')
  const slots = getSlotsForHari(polaList, hari)

  const rows = (await db.prepare(`
    SELECT
      dt.id as delegasi_id,
      dtk.id as delegasi_kelas_id,
      u_dari.nama_lengkap as dari_user_nama,
      dt.tanggal,
      dtk.kelas_id,
      k.tingkat, k.nomor_kelas, k.kelompok,
      dtk.penugasan_mengajar_id,
      mp.nama_mapel,
      dtk.tugas,
      dtk.absen_selesai,
      dtk.pelaksana_user_id,
      u_pelaksana.nama_lengkap as pelaksana_nama,
      dt.status
    FROM delegasi_tugas dt
    JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
    JOIN "user" u_dari ON dt.dari_user_id = u_dari.id
    LEFT JOIN "user" u_pelaksana ON dtk.pelaksana_user_id = u_pelaksana.id
    JOIN penugasan_mengajar pm ON dtk.penugasan_mengajar_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON dtk.kelas_id = k.id
    WHERE dt.tanggal = ?
      AND (dt.kepada_user_id = ? OR (dt.kepada_user_id IS NULL AND EXISTS (
        SELECT 1 FROM jadwal_guru_piket j
        JOIN "user" u_piket ON u_piket.id = j.user_id
        WHERE j.hari = ? AND j.user_id = ? AND u_piket.banned = 0
        UNION
        SELECT 1 FROM guru_ppl_mapping jpp
        JOIN jadwal_guru_piket j ON j.id = jpp.jadwal_piket_id
        JOIN "user" u_ppl ON u_ppl.id = jpp.guru_ppl_id
        WHERE j.hari = ? AND jpp.guru_ppl_id = ? AND u_ppl.banned = 0
      )))
    ORDER BY k.tingkat, k.kelompok, k.nomor_kelas
  `).bind(tanggal, user.id, hari, user.id, hari, user.id).all<any>()).results || []

  // Get jam_ke for each penugasan from jadwal_mengajar
  const penugasanIds = [...new Set(rows.map((r: any) => r.penugasan_mengajar_id))]
  let jamMap = new Map<string, { mulai: number; selesai: number }>()

  if (penugasanIds.length > 0 && ta) {
    const ph = penugasanIds.map(() => '?').join(',')
    const jamRows = (await db.prepare(`
      SELECT penugasan_id, MIN(jam_ke) as jam_mulai, MAX(jam_ke) as jam_selesai
      FROM jadwal_mengajar
      WHERE tahun_ajaran_id = ? AND hari = ? AND penugasan_id IN (${ph})
      GROUP BY penugasan_id
    `).bind(ta.id, hari, ...penugasanIds).all<any>()).results || []
    for (const j of jamRows) {
      jamMap.set(j.penugasan_id, { mulai: j.jam_mulai, selesai: j.jam_selesai })
    }
  }

  const data: DelegasiMasuk[] = rows.map((r: any) => {
    const jam = jamMap.get(r.penugasan_mengajar_id)
    const slotMulai = slots.find(s => s.id === jam?.mulai)
    const slotSelesai = slots.find(s => s.id === jam?.selesai)
    return {
      delegasi_id: r.delegasi_id,
      delegasi_kelas_id: r.delegasi_kelas_id,
      dari_user_nama: r.dari_user_nama,
      pelaksana_user_id: r.pelaksana_user_id || null,
      pelaksana_nama: r.pelaksana_nama || null,
      tanggal: r.tanggal,
      kelas_id: r.kelas_id,
      kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
      penugasan_mengajar_id: r.penugasan_mengajar_id,
      mapel_nama: r.nama_mapel,
      tugas: r.tugas,
      absen_selesai: !!r.absen_selesai,
      status: r.status,
      jam_ke_mulai: jam?.mulai ?? 0,
      jam_ke_selesai: jam?.selesai ?? 0,
      slot_mulai: slotMulai?.mulai ?? '-',
      slot_selesai: slotSelesai?.selesai ?? '-',
    }
  })

  return { error: null, data, slots }
}

// ============================================================
// 5. AMBIL DELEGASI YANG DIKIRIM USER (riwayat hari ini)
// ============================================================
export async function getDelegasiTerkirim(tanggal: string): Promise<{
  error: string | null
  data: Array<{
    delegasi_id: string
    kepada_user_nama: string
    status: string
    items: Array<{ kelas_label: string; tugas: string; absen_selesai: boolean; pelaksana_nama: string | null }>
  }>
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const db = await getDB()

  const rows = (await db.prepare(`
    SELECT
      dt.id as delegasi_id,
      u_kepada.nama_lengkap as kepada_user_nama,
      dt.status,
      dtk.id as dtk_id,
      k.tingkat, k.nomor_kelas, k.kelompok,
      dtk.tugas,
      dtk.absen_selesai,
      u_pelaksana.nama_lengkap as pelaksana_nama
    FROM delegasi_tugas dt
    LEFT JOIN "user" u_kepada ON dt.kepada_user_id = u_kepada.id
    JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
    LEFT JOIN "user" u_pelaksana ON dtk.pelaksana_user_id = u_pelaksana.id
    JOIN kelas k ON dtk.kelas_id = k.id
    WHERE dt.dari_user_id = ? AND dt.tanggal = ?
    ORDER BY dt.created_at DESC, k.tingkat, k.kelompok, k.nomor_kelas
  `).bind(user.id, tanggal).all<any>()).results || []

  // Group by delegasi_id
  const grouped = new Map<string, any>()
  for (const r of rows) {
    if (!grouped.has(r.delegasi_id)) {
      grouped.set(r.delegasi_id, {
        delegasi_id: r.delegasi_id,
        kepada_user_nama: r.kepada_user_nama || 'Semua guru piket hari ini',
        status: r.status,
        items: [],
      })
    }
    grouped.get(r.delegasi_id)!.items.push({
      kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
      tugas: r.tugas,
      absen_selesai: !!r.absen_selesai,
      pelaksana_nama: r.pelaksana_nama || null,
    })
  }

  return { error: null, data: Array.from(grouped.values()) }
}

// ============================================================
// 6. BATALKAN DELEGASI
// ============================================================
export async function batalkanDelegasi(delegasiId: string): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()

  // Verify ownership
  const dt = await db.prepare(
    'SELECT id, status FROM delegasi_tugas WHERE id = ? AND dari_user_id = ?'
  ).bind(delegasiId, user.id).first<any>()

  if (!dt) return { error: 'Delegasi tidak ditemukan.' }
  if (dt.status === 'SELESAI') return { error: 'Delegasi sudah selesai, tidak bisa dibatalkan.' }

  const done = await db.prepare(
    'SELECT COUNT(*) as cnt FROM delegasi_tugas_kelas WHERE delegasi_id = ? AND absen_selesai = 1'
  ).bind(delegasiId).first<any>()
  if ((done?.cnt || 0) > 0) return { error: 'Sebagian tugas sudah dilaksanakan, tidak bisa dibatalkan.' }

  // Delete cascade
  const result = await dbDelete(db, 'delegasi_tugas', { id: delegasiId })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/penugasan')
  return { success: 'Delegasi berhasil dibatalkan.' }
}

// ============================================================
// 7. LOAD SISWA UNTUK ABSENSI (pelaksana)
// ============================================================
export async function loadSiswaDelegasi(
  delegasiKelasId: string,
  penugasanMengajarId: string,
  kelasId: string,
  tanggal: string,
  jamKeMulai?: number,
  jamKeSelesai?: number
): Promise<{
  error: string | null
  siswa: Array<{
    siswa_id: string
    nama_lengkap: string
    nisn: string
    status: 'HADIR' | 'SAKIT' | 'ALFA' | 'IZIN'
    catatan: string
    ada_izin: boolean
    alasan_izin: string
    keterangan_wali_kelas: string | null
  }>
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', siswa: [] }

  const db = await getDB()

  // Verify user is the assigned receiver (legacy) or any teacher on today's piket roster.
  const dtk = await db.prepare(`
    SELECT dtk.id, dt.kepada_user_id FROM delegasi_tugas_kelas dtk
    JOIN delegasi_tugas dt ON dtk.delegasi_id = dt.id
    WHERE dtk.id = ? AND dt.tanggal = ?
  `).bind(delegasiKelasId, tanggal).first<any>()
  if (!dtk) return { error: 'Tidak memiliki akses.', siswa: [] }
  if (dtk.kepada_user_id && dtk.kepada_user_id !== user.id) return { error: 'Tidak memiliki akses.', siswa: [] }
  if (!dtk.kepada_user_id && !(await isGuruPiketPadaHari(db, user.id, getHariFromDate(tanggal)))) {
    return { error: 'Tidak memiliki akses.', siswa: [] }
  }

  const [siswaRes, absensiRes, izinRes, izinKeluarRes, waliKelasRes] = await Promise.all([
    db.prepare(`SELECT id, nama_lengkap, nisn FROM siswa WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama_lengkap`).bind(kelasId).all<any>(),
    db.prepare(`SELECT siswa_id, status, catatan FROM absensi_siswa WHERE penugasan_id = ? AND tanggal = ?`).bind(penugasanMengajarId, tanggal).all<any>(),
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

      let status: 'HADIR' | 'SAKIT' | 'ALFA' | 'IZIN'
      let catatan = ''
      if (ab) {
        status = ab.status as any
        catatan = ab.catatan
      } else if (wali) {
        status = wali.status as any
        catatan = `Keterangan dari wali kelas${wali.keterangan ? ': ' + wali.keterangan : ''}`
      } else if (adaIzin) {
        status = 'IZIN'
      } else {
        status = 'HADIR'
      }

      return {
        siswa_id: s.id,
        nama_lengkap: s.nama_lengkap,
        nisn: s.nisn,
        status,
        catatan,
        ada_izin: adaIzin,
        alasan_izin: izinMap.get(s.id) || '',
        keterangan_wali_kelas: wali ? (wali.keterangan || wali.status) : null,
      }
    }),
  }
}

// ============================================================
// 8. SIMPAN ABSENSI DELEGASI (pelaksana)
// ============================================================
export async function simpanAbsensiDelegasi(
  delegasiKelasId: string,
  penugasanMengajarId: string,
  tanggal: string,
  jamKeMulai: number,
  jamKeSelesai: number,
  dataAbsen: Array<{ siswa_id: string; status: string; catatan: string }>
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()

  // Verify user is the assigned receiver (legacy) or any teacher on today's piket roster.
  const dtk = await db.prepare(`
    SELECT dtk.id, dtk.delegasi_id, dtk.absen_selesai, dtk.pelaksana_user_id, dt.kepada_user_id FROM delegasi_tugas_kelas dtk
    JOIN delegasi_tugas dt ON dtk.delegasi_id = dt.id
    WHERE dtk.id = ? AND dt.tanggal = ?
  `).bind(delegasiKelasId, tanggal).first<any>()
  if (!dtk) return { error: 'Tidak memiliki akses.' }
  if (dtk.kepada_user_id && dtk.kepada_user_id !== user.id) return { error: 'Tidak memiliki akses.' }
  if (!dtk.kepada_user_id && !(await isGuruPiketPadaHari(db, user.id, getHariFromDate(tanggal)))) {
    return { error: 'Tidak memiliki akses.' }
  }
  if (dtk.absen_selesai && dtk.pelaksana_user_id && dtk.pelaksana_user_id !== user.id) {
    return { error: 'Tugas ini sudah dilaksanakan guru piket lain.' }
  }

  // Sparse: only save non-HADIR
  await ensureAbsensiSessionTable(db)
  const toSave = dataAbsen.filter(d => d.status !== 'HADIR')
  const jumlahJam = jamKeSelesai - jamKeMulai + 1
  const delStmt = db.prepare(
    'DELETE FROM absensi_siswa WHERE penugasan_id = ? AND tanggal = ?'
  ).bind(penugasanMengajarId, tanggal)
  const upsertSesiStmt = db.prepare(`
    INSERT INTO absensi_sesi_guru (penugasan_id, tanggal, submitted_at, diinput_oleh, updated_at)
    VALUES (?, ?, datetime('now'), ?, datetime('now'))
    ON CONFLICT(penugasan_id, tanggal) DO UPDATE SET
      submitted_at = excluded.submitted_at,
      diinput_oleh = excluded.diinput_oleh,
      updated_at = excluded.updated_at
  `).bind(penugasanMengajarId, tanggal, user.id)

  if (toSave.length === 0) {
    try { await db.batch([delStmt, upsertSesiStmt]) } catch (e: any) { return { error: e.message } }
  } else {
    const insStmts = toSave.map(d =>
      db.prepare(
        `INSERT INTO absensi_siswa (penugasan_id,siswa_id,tanggal,jam_ke_mulai,jam_ke_selesai,jumlah_jam,status,catatan,diinput_oleh) VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(penugasanMengajarId, d.siswa_id, tanggal, jamKeMulai, jamKeSelesai, jumlahJam, d.status, d.catatan || null, user.id)
    )
    try {
      const all = [delStmt, ...insStmts, upsertSesiStmt]
      for (let i = 0; i < all.length; i += 100) await db.batch(all.slice(i, i + 100))
    } catch (e: any) { return { error: e.message } }
  }

  // Mark absen_selesai
  await dbUpdate(db, 'delegasi_tugas_kelas', {
    absen_selesai: 1,
    pelaksana_user_id: user.id,
    selesai_at: nowWIBISO(),
  }, { id: delegasiKelasId })

  // Check if all kelas in this delegasi are done → mark delegasi as SELESAI
  const remaining = await db.prepare(
    'SELECT COUNT(*) as cnt FROM delegasi_tugas_kelas WHERE delegasi_id = ? AND absen_selesai = 0'
  ).bind(dtk.delegasi_id).first<any>()

  if (remaining?.cnt === 0) {
    await dbUpdate(db, 'delegasi_tugas', {
      status: 'SELESAI',
      updated_at: nowWIBISO(),
    }, { id: dtk.delegasi_id })
  }

  revalidatePath('/dashboard/penugasan')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: `Absensi disimpan! ${toSave.length} siswa tidak hadir.` }
}
