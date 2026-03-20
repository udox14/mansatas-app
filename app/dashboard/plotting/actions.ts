// Lokasi: app/dashboard/plotting/actions.ts
'use server'

import { getDB, dbUpdate } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. AMBIL TAHUN AJARAN AKTIF
// ============================================================
export async function getTahunAjaranAktif() {
  const db = await getDB()
  let ta = await db
    .prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()

  if (!ta) {
    const id = crypto.randomUUID()
    await db
      .prepare('INSERT INTO tahun_ajaran (id, nama, semester, is_active) VALUES (?, ?, ?, 1)')
      .bind(id, '2024/2025', 1)
      .run()
    ta = { id, nama: '2024/2025', semester: 1 }
  }

  return ta
}

// ============================================================
// 2. SISWA BELUM PUNYA KELAS
// ============================================================
export async function getSiswaBelumAdaKelas() {
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT id, nisn, nama_lengkap, jenis_kelamin FROM siswa
       WHERE kelas_id IS NULL AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .all<any>()
  return result.results ?? []
}

// ============================================================
// 3. KELAS BERDASARKAN TINGKAT (dengan jumlah siswa)
// FIX: Sudah pakai GROUP BY — tidak ada correlated subquery
// ============================================================
export async function getKelasByTingkat(tingkat: number) {
  const db = await getDB()
  const rows = await db
    .prepare(
      `SELECT k.id, k.tingkat, k.kelompok, k.nomor_kelas, k.kapasitas,
              COUNT(CASE WHEN s.status = 'aktif' THEN 1 END) as jumlah_siswa
       FROM kelas k
       LEFT JOIN siswa s ON s.kelas_id = k.id
       WHERE k.tingkat = ?
       GROUP BY k.id
       ORDER BY k.kelompok ASC, k.nomor_kelas ASC`
    )
    .bind(tingkat)
    .all<any>()
  return rows.results ?? []
}

// ============================================================
// 4. SISWA BERDASARKAN TINGKAT (untuk tab plotting)
// ============================================================
export async function getSiswaByTingkat(tingkat: number) {
  const db = await getDB()
  // Hanya ambil kolom yang dibutuhkan di UI plotting
  const result = await db
    .prepare(
      `SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, s.kelas_id, s.minat_jurusan,
              k.tingkat, k.kelompok, k.nomor_kelas
       FROM siswa s
       JOIN kelas k ON s.kelas_id = k.id
       WHERE k.tingkat = ? AND s.status = 'aktif'
       ORDER BY s.nama_lengkap ASC`
    )
    .bind(tingkat)
    .all<any>()

  return (result.results ?? []).map((s: any) => ({
    id: s.id,
    nisn: s.nisn,
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
    kelas_id: s.kelas_id,
    minat_jurusan: s.minat_jurusan,
    // kelas_lama dan kelompok dibutuhkan oleh SiswaType di tab-penjurusan, tab-pengacakan, tab-kelulusan
    kelas_lama: s.tingkat ? `${s.tingkat}-${s.nomor_kelas}` : '',
    kelompok: s.kelompok ?? 'UMUM',
    kelas: {
      tingkat: s.tingkat,
      kelompok: s.kelompok,
      nomor_kelas: s.nomor_kelas,
    },
  }))
}

// ============================================================
// 5. DRAFT PENJURUSAN
// ============================================================
export async function setDraftPenjurusan(siswa_id: string, minat_jurusan: string | null) {
  const db = await getDB()
  const result = await dbUpdate(db, 'siswa', { minat_jurusan }, { id: siswa_id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/plotting')
  return { success: true }
}

export async function setDraftPenjurusanMassal(payload: { id: string; minat_jurusan: string }[]) {
  const db = await getDB()

  // Chunk per 100
  const chunkSize = 100
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const stmts = chunk.map((p) =>
      db
        .prepare('UPDATE siswa SET minat_jurusan = ? WHERE id = ?')
        .bind(p.minat_jurusan, p.id)
    )
    await db.batch(stmts)
  }

  revalidatePath('/dashboard/plotting')
  return { success: true }
}

// ============================================================
// 6. SIMPAN PLOTTING MASSAL
// FIX: Pisah UPDATE dan INSERT riwayat ke 2 batch terpisah
// agar lebih terprediksi dan tidak campur tipe operasi
// ============================================================
export async function simpanPlottingMassal(
  hasilPlotting: { siswa_id: string; kelas_id: string }[]
) {
  if (!hasilPlotting.length) return { error: 'Tidak ada data plotting.' }

  const db = await getDB()
  const ta = await getTahunAjaranAktif()
  if (!ta) return { error: 'Gagal mendapatkan Tahun Ajaran Aktif.' }

  try {
    const now = new Date().toISOString()
    const chunkSize = 100

    // Batch 1: UPDATE kelas_id siswa
    const updateStmts = hasilPlotting.map((plot) =>
      db
        .prepare(
          'UPDATE siswa SET kelas_id = ?, minat_jurusan = NULL, updated_at = ? WHERE id = ?'
        )
        .bind(plot.kelas_id, now, plot.siswa_id)
    )
    for (let i = 0; i < updateStmts.length; i += chunkSize) {
      await db.batch(updateStmts.slice(i, i + chunkSize))
    }

    // Batch 2: INSERT riwayat_kelas (DO NOTHING jika sudah ada)
    const riwayatStmts = hasilPlotting.map((plot) =>
      db
        .prepare(
          `INSERT INTO riwayat_kelas (siswa_id, kelas_id, tahun_ajaran_id)
           VALUES (?, ?, ?)
           ON CONFLICT(siswa_id, tahun_ajaran_id) DO NOTHING`
        )
        .bind(plot.siswa_id, plot.kelas_id, ta.id)
    )
    for (let i = 0; i < riwayatStmts.length; i += chunkSize) {
      await db.batch(riwayatStmts.slice(i, i + chunkSize))
    }

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
    return { success: `Berhasil memploting ${hasilPlotting.length} siswa secara permanen!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat menyimpan plotting.' }
  }
}

// ============================================================
// 7. PROSES KELULUSAN MASSAL KELAS 12
// ============================================================
export async function prosesKelulusanMassal(siswaIds: string[]) {
  if (!siswaIds.length) return { error: 'Tidak ada siswa yang dipilih.' }

  const db = await getDB()

  try {
    const now = new Date().toISOString()
    const chunkSize = 100

    const stmts = siswaIds.map((id) =>
      db
        .prepare('UPDATE siswa SET status = ?, kelas_id = NULL, updated_at = ? WHERE id = ?')
        .bind('lulus', now, id)
    )

    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize))
    }

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
    return { success: `Berhasil meluluskan ${siswaIds.length} siswa kelas 12!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat memproses kelulusan.' }
  }
}
