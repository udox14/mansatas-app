// Lokasi: app/dashboard/sp/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { uploadToR2, deleteFromR2 } from '@/utils/r2'
import { revalidatePath } from 'next/cache'
import { getDataForSurat } from '../surat/actions'
import { getSanksiList } from '../kedisiplinan/actions'
import { KODE_KLASIFIKASI_SP } from './constants'
import type { SpLevel, KeputusanSp } from './constants'

const BULAN_ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const MANAGE_SP_ROLES = ['super_admin', 'kepsek', 'wakamad', 'admin_tu', 'guru_bk']

async function hasAnyRole(db: any, userId: string, allowedRoles: string[]) {
  const roles = await getUserRoles(db, userId)
  return roles.some((role) => allowedRoles.includes(role))
}

async function ensureSpSchema(db: any) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS surat_peringatan (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        siswa_id TEXT NOT NULL,
        level TEXT NOT NULL,
        nomor_urut INTEGER NOT NULL,
        nomor_surat TEXT NOT NULL,
        tahun INTEGER NOT NULL,
        tanggal_sp TEXT,
        total_poin INTEGER DEFAULT 0,
        alasan TEXT,
        data_surat TEXT NOT NULL DEFAULT '{}',
        ditetapkan_oleh TEXT NOT NULL,
        nama_penetap TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sp_tindak_lanjut (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        siswa_id TEXT NOT NULL,
        surat_peringatan_id TEXT,
        tanggal TEXT,
        jenis TEXT,
        catatan TEXT,
        oleh TEXT,
        nama_oleh TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sp_keputusan (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        siswa_id TEXT NOT NULL UNIQUE,
        keputusan TEXT NOT NULL,
        tanggal TEXT,
        catatan TEXT,
        oleh TEXT,
        nama_oleh TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `),
  ])
  // Kolom file SP bertanda tangan (tambah jika belum ada)
  try {
    await db.prepare(`ALTER TABLE surat_peringatan ADD COLUMN file_ttd_url TEXT`).run()
  } catch {
    // kolom sudah ada — abaikan
  }
}

function formatNomorSP(nomorUrutLokal: string, bulan: number, tahun: number): string {
  const bulanRomawi = BULAN_ROMAWI[bulan] || String(bulan)
  return `${nomorUrutLokal}/Ma.10.20/${KODE_KLASIFIKASI_SP}/${bulanRomawi}/${tahun}`
}

// ============================================================
// DATA UNTUK PENETAPAN SP (siswa, pejabat, daftar rekomendasi)
// ============================================================
export async function getDataForSP() {
  const db = await getDB()
  await ensureSpSchema(db)

  const [masterData, sanksiList] = await Promise.all([
    getDataForSurat(),
    getSanksiList(),
  ])

  // Rekomendasi: siswa dgn akumulasi poin seumur hidup yg melewati threshold
  const rekomendasiRes = await db.prepare(`
    SELECT s.id, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok,
      COUNT(sp.id) as jumlah_kasus, SUM(mp.poin) as total_poin
    FROM siswa_pelanggaran sp
    JOIN siswa s ON sp.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
    WHERE s.status = 'aktif'
    GROUP BY sp.siswa_id
    HAVING total_poin > 0
    ORDER BY total_poin DESC
    LIMIT 50
  `).all<any>()

  const sorted = [...sanksiList].sort((a, b) => b.poin_minimal - a.poin_minimal)
  const levelForPoin = (p: number): SpLevel | null => {
    const hit = sorted.find((sx) => p >= sx.poin_minimal)
    if (!hit) return null
    const n = String(hit.nama).match(/\d/)?.[0]
    if (n === '1') return 'sp1'
    if (n === '2') return 'sp2'
    if (n === '3') return 'sp3'
    return hit.urutan === 1 ? 'sp1' : hit.urutan === 2 ? 'sp2' : 'sp3'
  }

  const rekomendasi = (rekomendasiRes.results || [])
    .map((r: any) => ({ ...r, level_rekomendasi: levelForPoin(r.total_poin ?? 0) }))
    .filter((r: any) => r.level_rekomendasi !== null)

  return {
    siswa: masterData.siswa,
    pejabat: masterData.pejabat,
    sanksiList,
    rekomendasi,
  }
}

// ============================================================
// TETAPKAN / SIMPAN SP
// ============================================================
export async function tetapkanSP(data: {
  siswa_id: string
  level: SpLevel
  total_poin?: number
  alasan?: string
  nomor_urut_manual?: string
  data_surat: any
}): Promise<{ success?: string; error?: string; nomor_surat?: string; id?: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  if (!(await hasAnyRole(db, user.id, MANAGE_SP_ROLES))) return { error: 'Tidak memiliki izin.' }
  if (!data.siswa_id) return { error: 'Siswa wajib dipilih.' }
  if (!data.level) return { error: 'Level SP wajib dipilih.' }
  if (!data.nomor_urut_manual) return { error: 'Nomor Urut Surat wajib diisi.' }

  await ensureSpSchema(db)

  const d = data.data_surat?.tanggal_surat_raw ? new Date(data.data_surat.tanggal_surat_raw) : new Date()
  const tahun = d.getFullYear()
  const bulan = d.getMonth() + 1
  const nomorUrut = parseInt(data.nomor_urut_manual.replace(/[^0-9]/g, '')) || 0
  const nomorSurat = formatNomorSP(data.nomor_urut_manual, bulan, tahun)

  const dataSurat = {
    ...data.data_surat,
    nomor_surat: nomorSurat,
    level: data.level,
    total_poin: data.total_poin ?? 0,
    alasan: data.alasan ?? '',
  }
  const namaPenetap = (user as any).nama_lengkap || (user as any).name || 'User'

  try {
    const result = await db.prepare(`
      INSERT INTO surat_peringatan
        (id, siswa_id, level, nomor_urut, nomor_surat, tahun, tanggal_sp, total_poin, alasan, data_surat, ditetapkan_oleh, nama_penetap)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      data.siswa_id,
      data.level,
      nomorUrut,
      nomorSurat,
      tahun,
      data.data_surat?.tanggal_surat_raw || null,
      data.total_poin ?? 0,
      data.alasan || null,
      JSON.stringify(dataSurat),
      user.id,
      namaPenetap,
    ).first<any>()

    revalidatePath('/dashboard/sp')
    return { success: 'SP berhasil ditetapkan & disimpan.', nomor_surat: nomorSurat, id: result?.id }
  } catch (e: any) {
    return { error: 'Gagal menyimpan SP: ' + (e?.message || '') }
  }
}

// ============================================================
// RIWAYAT SP (agregasi per siswa)
// ============================================================
export async function getRiwayatSP(): Promise<any[]> {
  const db = await getDB()
  await ensureSpSchema(db)

  const res = await db.prepare(`
    SELECT
      sp.siswa_id,
      s.nama_lengkap,
      k.tingkat, k.nomor_kelas, k.kelompok,
      COUNT(sp.id) AS jumlah_sp,
      MAX(sp.level) AS level_tertinggi,
      MAX(sp.created_at) AS sp_terakhir,
      kp.keputusan AS keputusan
    FROM surat_peringatan sp
    JOIN siswa s ON sp.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN sp_keputusan kp ON kp.siswa_id = sp.siswa_id
    GROUP BY sp.siswa_id
    ORDER BY sp_terakhir DESC
  `).all<any>()

  return res.results || []
}

// ============================================================
// DETAIL SP SATU SISWA (semua SP + tindak lanjut + keputusan)
// ============================================================
export async function getDetailSiswaSP(siswaId: string): Promise<{
  siswa: any
  spList: any[]
  tindakLanjut: any[]
  keputusan: any | null
}> {
  const db = await getDB()
  await ensureSpSchema(db)

  const [siswaRes, spRes, tlRes, kpRes] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id WHERE s.id = ?
    `).bind(siswaId).first<any>(),
    db.prepare(`SELECT * FROM surat_peringatan WHERE siswa_id = ? ORDER BY created_at ASC`).bind(siswaId).all<any>(),
    db.prepare(`SELECT * FROM sp_tindak_lanjut WHERE siswa_id = ? ORDER BY tanggal DESC, created_at DESC`).bind(siswaId).all<any>(),
    db.prepare(`SELECT * FROM sp_keputusan WHERE siswa_id = ?`).bind(siswaId).first<any>(),
  ])

  return {
    siswa: siswaRes || null,
    spList: spRes.results || [],
    tindakLanjut: tlRes.results || [],
    keputusan: kpRes || null,
  }
}

// ============================================================
// TINDAK LANJUT
// ============================================================
export async function simpanTindakLanjut(data: {
  siswa_id: string
  surat_peringatan_id?: string
  tanggal?: string
  jenis?: string
  catatan?: string
}): Promise<{ success?: string; error?: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  if (!(await hasAnyRole(db, user.id, MANAGE_SP_ROLES))) return { error: 'Tidak memiliki izin.' }
  if (!data.siswa_id) return { error: 'Siswa wajib dipilih.' }

  await ensureSpSchema(db)
  const namaOleh = (user as any).nama_lengkap || (user as any).name || 'User'

  try {
    await db.prepare(`
      INSERT INTO sp_tindak_lanjut (id, siswa_id, surat_peringatan_id, tanggal, jenis, catatan, oleh, nama_oleh)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.siswa_id,
      data.surat_peringatan_id || null,
      data.tanggal || null,
      data.jenis || null,
      data.catatan || null,
      user.id,
      namaOleh,
    ).run()
    revalidatePath('/dashboard/sp')
    return { success: 'Tindak lanjut tersimpan.' }
  } catch (e: any) {
    return { error: 'Gagal menyimpan tindak lanjut: ' + (e?.message || '') }
  }
}

export async function hapusTindakLanjut(id: string): Promise<{ success?: string; error?: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  if (!(await hasAnyRole(db, user.id, MANAGE_SP_ROLES))) return { error: 'Tidak memiliki izin.' }
  try {
    await db.prepare(`DELETE FROM sp_tindak_lanjut WHERE id = ?`).bind(id).run()
    revalidatePath('/dashboard/sp')
    return { success: 'Tindak lanjut dihapus.' }
  } catch (e: any) {
    return { error: 'Gagal menghapus: ' + (e?.message || '') }
  }
}

// ============================================================
// KEPUTUSAN AKHIR (catat saja — tidak ubah siswa.status)
// ============================================================
export async function simpanKeputusan(data: {
  siswa_id: string
  keputusan: KeputusanSp
  tanggal?: string
  catatan?: string
}): Promise<{ success?: string; error?: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  if (!(await hasAnyRole(db, user.id, MANAGE_SP_ROLES))) return { error: 'Tidak memiliki izin.' }
  if (!data.siswa_id || !data.keputusan) return { error: 'Data keputusan tidak lengkap.' }

  await ensureSpSchema(db)
  const namaOleh = (user as any).nama_lengkap || (user as any).name || 'User'

  try {
    await db.prepare(`
      INSERT INTO sp_keputusan (id, siswa_id, keputusan, tanggal, catatan, oleh, nama_oleh)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)
      ON CONFLICT(siswa_id) DO UPDATE SET
        keputusan = excluded.keputusan,
        tanggal = excluded.tanggal,
        catatan = excluded.catatan,
        oleh = excluded.oleh,
        nama_oleh = excluded.nama_oleh
    `).bind(
      data.siswa_id,
      data.keputusan,
      data.tanggal || null,
      data.catatan || null,
      user.id,
      namaOleh,
    ).run()
    revalidatePath('/dashboard/sp')
    return { success: 'Keputusan tersimpan. (Status siswa diubah manual di menu Siswa.)' }
  } catch (e: any) {
    return { error: 'Gagal menyimpan keputusan: ' + (e?.message || '') }
  }
}

// ============================================================
// UPLOAD SP YANG SUDAH DITANDATANGANI (webp terkompres dari client)
// ============================================================
export async function uploadSignedSP(spId: string, formData: FormData): Promise<{ success?: string; error?: string; url?: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  if (!(await hasAnyRole(db, user.id, MANAGE_SP_ROLES))) return { error: 'Tidak memiliki izin.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'File tidak ditemukan.' }

  await ensureSpSchema(db)

  // Hapus file lama jika ada
  const existing = await db.prepare(`SELECT file_ttd_url FROM surat_peringatan WHERE id = ?`).bind(spId).first<any>()
  if (existing?.file_ttd_url) await deleteFromR2(existing.file_ttd_url)

  const { url, error } = await uploadToR2(file, 'sp_ttd', `${spId}.webp`)
  if (error || !url) return { error: 'Gagal upload: ' + (error || '') }

  try {
    await db.prepare(`UPDATE surat_peringatan SET file_ttd_url = ? WHERE id = ?`).bind(url, spId).run()
    revalidatePath('/dashboard/sp')
    return { success: 'SP bertanda tangan terupload.', url }
  } catch (e: any) {
    return { error: 'Gagal simpan URL: ' + (e?.message || '') }
  }
}

export async function hapusSignedSP(spId: string): Promise<{ success?: string; error?: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  if (!(await hasAnyRole(db, user.id, MANAGE_SP_ROLES))) return { error: 'Tidak memiliki izin.' }
  await ensureSpSchema(db)
  const existing = await db.prepare(`SELECT file_ttd_url FROM surat_peringatan WHERE id = ?`).bind(spId).first<any>()
  if (existing?.file_ttd_url) await deleteFromR2(existing.file_ttd_url)
  try {
    await db.prepare(`UPDATE surat_peringatan SET file_ttd_url = NULL WHERE id = ?`).bind(spId).run()
    revalidatePath('/dashboard/sp')
    return { success: 'File SP dihapus.' }
  } catch (e: any) {
    return { error: 'Gagal menghapus: ' + (e?.message || '') }
  }
}

export async function hapusSP(id: string): Promise<{ success?: string; error?: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  if (!(await hasAnyRole(db, user.id, MANAGE_SP_ROLES))) return { error: 'Tidak memiliki izin.' }
  try {
    await db.prepare(`DELETE FROM surat_peringatan WHERE id = ?`).bind(id).run()
    revalidatePath('/dashboard/sp')
    return { success: 'SP dihapus.' }
  } catch (e: any) {
    return { error: 'Gagal menghapus: ' + (e?.message || '') }
  }
}
