// Lokasi: app/dashboard/plotting/actions.ts
'use server'

import { getDB, dbUpdate, dbInsert } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. AMBIL TAHUN AJARAN AKTIF
// ============================================================
export async function getTahunAjaranAktif() {
  const db = await getDB()
  let ta = await db
    .prepare(`SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1`)
    .first<any>()

  if (!ta) {
    // Buat tahun ajaran default jika belum ada
    const id = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO tahun_ajaran (id, nama, semester, is_active) VALUES (?, ?, ?, 1)`
      )
      .bind(id, '2024/2025', 1)
      .run()
    ta = { id, nama: '2024/2025', semester: 1 }
  }

  return ta
}

// ============================================================
// 2. SISWA BELUM PUNYA KELAS (Pagination manual)
// ============================================================
export async function getSiswaBelumAdaKelas() {
  const db = await getDB()
  // D1 support query besar, ambil semua sekaligus
  const result = await db
    .prepare(
      `SELECT id, nisn, nama_lengkap, jenis_kelamin FROM siswa
       WHERE kelas_id IS NULL AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .all<any>()
  return result.results
}

// ============================================================
// 3. KELAS BERDASARKAN TINGKAT
// ============================================================
export async function getKelasByTingkat(tingkat: number) {
  const db = await getDB()
  const rows = await db
    .prepare(
      `SELECT k.id, k.tingkat, k.kelompok, k.nomor_kelas, k.kapasitas,
              COUNT(s.id) as jumlah_siswa
       FROM kelas k
       LEFT JOIN siswa s ON s.kelas_id = k.id AND s.status = 'aktif'
       WHERE k.tingkat = ?
       GROUP BY k.id
       ORDER BY k.kelompok ASC, k.nomor_kelas ASC`
    )
    .bind(tingkat)
    .all<any>()

  return rows.results.map((k: any) => ({
    id: k.id,
    nama: `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim(),
    kelompok: k.kelompok,
    kapasitas: k.kapasitas,
    jumlah_siswa: k.jumlah_siswa || 0,
  }))
}

// ============================================================
// 4. SISWA BERDASARKAN TINGKAT (Dengan Minat Jurusan)
// ============================================================
export async function getSiswaByTingkat(tingkat: number) {
  const db = await getDB()
  const rows = await db
    .prepare(
      `SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, s.kelas_id, s.minat_jurusan,
              k.tingkat as k_tingkat, k.kelompok as k_kelompok, k.nomor_kelas as k_nomor
       FROM siswa s
       INNER JOIN kelas k ON s.kelas_id = k.id
       WHERE k.tingkat = ? AND s.status = 'aktif'
       ORDER BY s.nama_lengkap ASC`
    )
    .bind(tingkat)
    .all<any>()

  return rows.results.map((s: any) => ({
    id: s.id,
    nisn: s.nisn,
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
    minat_jurusan: s.minat_jurusan || null,
    kelas_lama: `${s.k_tingkat}-${s.k_nomor} ${s.k_kelompok !== 'UMUM' ? s.k_kelompok : ''}`.trim(),
    kelompok: s.k_kelompok,
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
  const stmts = payload.map(p =>
    db.prepare('UPDATE siswa SET minat_jurusan = ? WHERE id = ?').bind(p.minat_jurusan, p.id)
  )
  await db.batch(stmts)
  revalidatePath('/dashboard/plotting')
  return { success: true }
}

// ============================================================
// 6. SIMPAN PLOTTING MASSAL
// ============================================================
export async function simpanPlottingMassal(
  hasilPlotting: { siswa_id: string; kelas_id: string }[]
) {
  const db = await getDB()
  const ta = await getTahunAjaranAktif()
  if (!ta) return { error: 'Gagal mendapatkan Tahun Ajaran Aktif.' }

  try {
    const now = new Date().toISOString()

    // Update kelas siswa + bersihkan minat_jurusan
    const updateStmts = hasilPlotting.map(plot =>
      db
        .prepare('UPDATE siswa SET kelas_id = ?, minat_jurusan = NULL, updated_at = ? WHERE id = ?')
        .bind(plot.kelas_id, now, plot.siswa_id)
    )

    // Upsert riwayat_kelas (ON CONFLICT siswa_id, tahun_ajaran_id)
    const riwayatStmts = hasilPlotting.map(plot =>
      db
        .prepare(
          `INSERT INTO riwayat_kelas (siswa_id, kelas_id, tahun_ajaran_id)
           VALUES (?, ?, ?)
           ON CONFLICT(siswa_id, tahun_ajaran_id) DO NOTHING`
        )
        .bind(plot.siswa_id, plot.kelas_id, ta.id)
    )

    // D1 batch max ~100, chunking jika besar
    const allStmts = [...updateStmts, ...riwayatStmts]
    const chunkSize = 100
    for (let i = 0; i < allStmts.length; i += chunkSize) {
      await db.batch(allStmts.slice(i, i + chunkSize))
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
  const db = await getDB()
  if (!siswaIds || siswaIds.length === 0) return { error: 'Tidak ada siswa yang dipilih.' }

  try {
    const now = new Date().toISOString()
    const stmts = siswaIds.map(id =>
      db
        .prepare('UPDATE siswa SET status = ?, kelas_id = NULL, updated_at = ? WHERE id = ?')
        .bind('lulus', now, id)
    )

    const chunkSize = 100
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
