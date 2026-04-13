// Lokasi: app/dashboard/kedisiplinan/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { uploadBuktiFoto, deleteFromR2, validateImageFile } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
// import { formatNamaKelas } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

// ============================================================
// SEARCH SISWA (lazy — dipanggil saat user mengetik di form)
// Menggantikan pre-load semua siswa saat halaman dibuka
// ============================================================
export async function searchSiswa(query: string) {
  if (!query || query.trim().length < 2) return []

  const db = await getDB()
  const q = `%${query.trim()}%`

  const result = await db
    .prepare(
      `SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
       FROM siswa s
       LEFT JOIN kelas k ON s.kelas_id = k.id
       WHERE s.status = 'aktif' AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
       ORDER BY s.nama_lengkap ASC
       LIMIT 20`
    )
    .bind(q, q)
    .all<any>()

  return (result.results ?? []).map((s: any) => ({
    id: s.id,
    nama_lengkap: s.nama_lengkap,
    nisn: s.nisn,
    kelas: s.tingkat
      ? `${s.tingkat}-${s.nomor_kelas}`
      : 'Tanpa Kelas',
  }))
}

// ============================================================
// 1. SIMPAN / EDIT PELANGGARAN
// ============================================================
export async function simpanPelanggaran(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login', success: null }

  const ta = await db
    .prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur sistem.', success: null }

  const id = formData.get('id') as string | null
  const siswa_id = formData.get('siswa_id') as string
  const master_pelanggaran_id = formData.get('master_pelanggaran_id') as string
  const tanggal = formData.get('tanggal') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id || !master_pelanggaran_id) {
    return {
      error: 'Siswa dan Jenis Pelanggaran wajib dipilih dari daftar pencarian.',
      success: null,
    }
  }

  const file = formData.get('foto') as File | null
  let foto_url = formData.get('existing_foto_url') as string | null

  if (file && file.size > 0) {
    // Validasi sebelum upload
    const validationError = validateImageFile(file)
    if (validationError) return { error: validationError, success: null }

    // Hapus foto lama dari R2 jika ada (edit mode)
    if (id && foto_url) {
      await deleteFromR2(foto_url)
    }

    const { url, error: uploadError } = await uploadBuktiFoto(file)
    if (uploadError || !url) return { error: 'Gagal mengunggah foto bukti: ' + uploadError, success: null }
    foto_url = url
  }

  const payload = {
    siswa_id,
    master_pelanggaran_id,
    tanggal,
    keterangan,
    foto_url,
    tahun_ajaran_id: ta.id,
    diinput_oleh: user.id,
    updated_at: new Date().toISOString(),
  }

  if (id) {
    const result = await dbUpdate(db, 'siswa_pelanggaran', payload, { id })
    if (result.error) return { error: 'Gagal mengedit: ' + result.error, success: null }
  } else {
    const result = await dbInsert(db, 'siswa_pelanggaran', payload)
    if (result.error) return { error: 'Gagal merekam data: ' + result.error, success: null }
  }

  revalidatePath('/dashboard/kedisiplinan')
  return { error: null, success: 'Data pelanggaran berhasil disimpan!' }
}

// ============================================================
// 2. HAPUS PELANGGARAN (+ hapus foto R2)
// ============================================================
export async function hapusPelanggaran(id: string) {
  const db = await getDB()

  // Ambil foto_url sebelum dihapus
  const record = await db
    .prepare('SELECT foto_url FROM siswa_pelanggaran WHERE id = ?')
    .bind(id)
    .first<{ foto_url: string | null }>()

  // Hapus foto dari R2 jika ada
  if (record?.foto_url) {
    await deleteFromR2(record.foto_url)
  }

  const result = await dbDelete(db, 'siswa_pelanggaran', { id })
  if (result.error) return { error: 'Akses ditolak atau gagal menghapus: ' + result.error }

  revalidatePath('/dashboard/kedisiplinan')
  return { success: 'Catatan pelanggaran berhasil dihapus permanen.' }
}

// ============================================================
// 3. MASTER PELANGGARAN
// ============================================================
export async function simpanMasterPelanggaran(prevState: any, formData: FormData) {
  const db = await getDB()

  const id = formData.get('id') as string | null
  const kategori = formData.get('kategori') as string
  const nama_pelanggaran = formData.get('nama_pelanggaran') as string
  const poin = parseInt(formData.get('poin') as string)

  if (!kategori || !nama_pelanggaran || isNaN(poin)) {
    return { error: 'Semua field wajib diisi dengan benar.', success: null }
  }

  if (id) {
    const result = await dbUpdate(db, 'master_pelanggaran', { kategori, nama_pelanggaran, poin }, { id })
    if (result.error) return { error: result.error, success: null }
  } else {
    const result = await dbInsert(db, 'master_pelanggaran', { kategori, nama_pelanggaran, poin })
    if (result.error) return { error: result.error, success: null }
  }

  revalidatePath('/dashboard/kedisiplinan')
  return { error: null, success: 'Master pelanggaran berhasil disimpan.' }
}

export async function hapusMasterPelanggaran(id: string) {
  const db = await getDB()

  const existing = await db
    .prepare('SELECT id FROM siswa_pelanggaran WHERE master_pelanggaran_id = ? LIMIT 1')
    .bind(id)
    .first<any>()

  if (existing) {
    return {
      error:
        'Tidak bisa menghapus: Jenis pelanggaran ini sudah memiliki riwayat pada data siswa. Silakan edit saja namanya.',
    }
  }

  const result = await dbDelete(db, 'master_pelanggaran', { id })
  if (result.error) return { error: 'Gagal menghapus: ' + result.error }

  revalidatePath('/dashboard/kedisiplinan')
  return { success: 'Master pelanggaran berhasil dihapus.' }
}

export async function importMasterPelanggaranMassal(dataExcel: any[]) {
  const db = await getDB()

  const sanitizedData = dataExcel
    .map((item) => ({
      nama_pelanggaran: String(item.NAMA_PELANGGARAN || '').trim(),
      kategori: String(item.KATEGORI || 'Ringan').trim(),
      poin: parseInt(item.POIN) || 0,
    }))
    .filter((item) => item.nama_pelanggaran && item.poin > 0)

  if (sanitizedData.length === 0) {
    return { error: 'Tidak ada data valid yang bisa diimport. Pastikan kolom sesuai format.' }
  }

  const { successCount, error } = await (await import('@/utils/db')).dbBatchInsert(
    db,
    'master_pelanggaran',
    sanitizedData
  )

  if (error) return { error }

  revalidatePath('/dashboard/kedisiplinan')
  return { success: `Berhasil mengimport ${successCount} jenis pelanggaran.` }
}

// ============================================================
// 4. LOAD MORE KASUS (pagination client-side request)
// ============================================================
export async function loadMoreKasus(taAktifId: string, offset: number) {
  const db = await getDB()
  const PAGE_SIZE = 50

  const result = await db
    .prepare(
      `SELECT sp.id, sp.tanggal, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, k.kelompok,
        mp.nama_pelanggaran, mp.poin, u.nama_lengkap as pelapor_nama
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      LEFT JOIN "user" u ON sp.diinput_oleh = u.id
      WHERE sp.tahun_ajaran_id = ?
      ORDER BY sp.tanggal DESC, sp.created_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ?`
    )
    .bind(taAktifId, offset)
    .all<any>()

  return (result.results ?? []).map((p: any) => ({
    id: p.id,
    tanggal: p.tanggal,
    keterangan: p.keterangan,
    foto_url: p.foto_url,
    siswa_id: p.siswa_id,
    master_pelanggaran_id: p.master_pelanggaran_id,
    diinput_oleh: p.diinput_oleh,
    siswa: {
      nama_lengkap: p.siswa_nama,
      kelas: p.tingkat
        ? { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok }
        : null,
    },
    master_pelanggaran: { nama_pelanggaran: p.nama_pelanggaran, poin: p.poin },
    pelapor: { nama_lengkap: p.pelapor_nama },
  }))
}

// ============================================================
// 5. AMBIL DATA ANALITIK KEDISIPLINAN
// ============================================================
export async function getAnalitikKedisiplinan(taAktifId: string) {
  const db = await getDB()

  const [
    totalKasusRes, perKategoriRes, perBulanRes, topPelanggaranRes,
    siswaRisikoRes, perKelasRes, configRes,
  ] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as total_kasus, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
    `).bind(taAktifId).first<any>(),

    db.prepare(`
      SELECT mp.kategori, COUNT(*) as jumlah, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY mp.kategori ORDER BY total_poin DESC
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT strftime('%Y-%m', sp.tanggal) as bulan, COUNT(*) as jumlah, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY bulan ORDER BY bulan ASC
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT mp.nama_pelanggaran, mp.kategori, mp.poin, COUNT(*) as frekuensi, COUNT(*)*mp.poin as total_beban
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY sp.master_pelanggaran_id ORDER BY frekuensi DESC LIMIT 10
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT s.id, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok,
        COUNT(sp.id) as jumlah_kasus, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY sp.siswa_id ORDER BY total_poin DESC LIMIT 20
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT k.tingkat, k.nomor_kelas, k.kelompok,
        COUNT(DISTINCT sp.siswa_id) as siswa_terlibat,
        COUNT(sp.id) as total_kasus,
        SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY s.kelas_id ORDER BY total_poin DESC
    `).bind(taAktifId).all<any>(),

    db.prepare(`SELECT key, value FROM kedisiplinan_config`).all<any>().catch(() => ({ results: [] })),
  ])

  const configMap: Record<string, number> = {}
  for (const row of (configRes.results ?? [])) configMap[row.key] = parseInt(row.value) || 0

  const thresholds = {
    perhatian:  configMap.threshold_perhatian  ?? 25,
    peringatan: configMap.threshold_peringatan ?? 50,
    kritis:     configMap.threshold_kritis     ?? 75,
    creditAwal: configMap.credit_score_awal    ?? 100,
  }

  return {
    ringkasan: {
      total_kasus: totalKasusRes?.total_kasus ?? 0,
      total_poin: totalKasusRes?.total_poin ?? 0,
    },
    perKategori: perKategoriRes.results ?? [],
    perBulan: perBulanRes.results ?? [],
    topPelanggaran: topPelanggaranRes.results ?? [],
    siswaBerisiko: (siswaRisikoRes.results ?? []).map((s: any) => ({
      ...s,
      credit_score: Math.max(0, thresholds.creditAwal - (s.total_poin ?? 0)),
      level: (s.total_poin ?? 0) >= thresholds.kritis ? 'kritis'
        : (s.total_poin ?? 0) >= thresholds.peringatan ? 'peringatan'
        : (s.total_poin ?? 0) >= thresholds.perhatian ? 'perhatian'
        : 'aman',
    })),
    perKelas: perKelasRes.results ?? [],
    thresholds,
  }
}

// ============================================================
// 6. SIMPAN KONFIGURASI KEDISIPLINAN
// ============================================================
export async function simpanKedisiplinanConfig(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi', success: null }

  const keys = ['threshold_perhatian', 'threshold_peringatan', 'threshold_kritis', 'credit_score_awal']
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS kedisiplinan_config (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        key TEXT NOT NULL UNIQUE, value TEXT NOT NULL,
        label TEXT, keterangan TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()

    for (const key of keys) {
      const val = formData.get(key) as string
      if (val === null || val === '') continue
      const num = parseInt(val)
      if (isNaN(num) || num < 0) return { error: `Nilai untuk ${key} tidak valid.`, success: null }
      await db.prepare(`
        INSERT INTO kedisiplinan_config (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).bind(key, String(num)).run()
    }

    revalidatePath('/dashboard/kedisiplinan')
    return { error: null, success: 'Konfigurasi berhasil disimpan.' }
  } catch (e: any) {
    return { error: 'Gagal menyimpan: ' + (e?.message || ''), success: null }
  }
}

// ============================================================
// 7. AMBIL KONFIGURASI THRESHOLD (untuk detail siswa)
// ============================================================
export async function getKedisiplinanConfig() {
  const db = await getDB()
  try {
    const res = await db.prepare(`SELECT key, value FROM kedisiplinan_config`).all<any>()
    const map: Record<string, number> = {}
    for (const row of (res.results ?? [])) map[row.key] = parseInt(row.value) || 0
    return {
      threshold_perhatian:  map.threshold_perhatian  ?? 25,
      threshold_peringatan: map.threshold_peringatan ?? 50,
      threshold_kritis:     map.threshold_kritis     ?? 75,
      credit_score_awal:    map.credit_score_awal    ?? 100,
    }
  } catch {
    return { threshold_perhatian: 25, threshold_peringatan: 50, threshold_kritis: 75, credit_score_awal: 100 }
  }
}
