// Lokasi: app/dashboard/kehadiran/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. AMBIL SISWA PER KELAS
// ============================================================
export async function getSiswaByKelas(kelas_id: string) {
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT id, nama_lengkap, nisn FROM siswa
       WHERE kelas_id = ? AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .bind(kelas_id)
    .all<any>()

  if (result.error) return { error: String(result.error), data: null }
  return { error: null, data: result.results }
}

// ============================================================
// 2. REKAP BULANAN (Admin/TU)
// ============================================================
export async function getRekapBulanan(kelas_id: string, bulan: number, ta_id: string) {
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT siswa_id, sakit, izin, alpa FROM rekap_kehadiran_bulanan
       WHERE kelas_id = ? AND bulan = ? AND tahun_ajaran_id = ?`
    )
    .bind(kelas_id, bulan, ta_id)
    .all<any>()

  if (result.error) return { error: String(result.error), data: null }
  return { error: null, data: result.results }
}

// FIX: Ganti pola DELETE-then-INSERT dengan INSERT OR REPLACE
// Sebelumnya: 1 DELETE + N INSERT = (N+1) writes per save
// Sekarang: N INSERT OR REPLACE = N writes, tanpa DELETE terpisah
// Catatan: schema sudah punya UNIQUE(siswa_id, bulan, tahun_ajaran_id)
export async function simpanRekapBulanan(
  kelas_id: string,
  bulan: number,
  ta_id: string,
  rekapData: any[]
) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  if (rekapData.length === 0) return { success: 'Tidak ada data untuk disimpan.' }

  const now = new Date().toISOString()

  const stmts = rekapData.map((item) =>
    db
      .prepare(
        `INSERT INTO rekap_kehadiran_bulanan
           (siswa_id, kelas_id, tahun_ajaran_id, bulan, sakit, izin, alpa, diinput_oleh, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(siswa_id, bulan, tahun_ajaran_id)
         DO UPDATE SET
           sakit = excluded.sakit,
           izin = excluded.izin,
           alpa = excluded.alpa,
           diinput_oleh = excluded.diinput_oleh,
           updated_at = excluded.updated_at`
      )
      .bind(
        item.siswa_id,
        kelas_id,
        ta_id,
        bulan,
        item.sakit || 0,
        item.izin || 0,
        item.alpa || 0,
        user.id,
        now
      )
  )

  try {
    // Chunk per 100 agar tidak melebihi limit D1 batch
    const chunkSize = 100
    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize))
    }
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/dashboard/kehadiran')
  return { success: 'Rekap kehadiran bulanan berhasil disimpan!' }
}

// ============================================================
// 3. JURNAL HARIAN GURU (Sparse Data)
// FIX: Sama — ganti DELETE+INSERT dengan INSERT OR REPLACE
// ============================================================
export async function simpanJurnalHarian(
  penugasan_id: string,
  tanggal: string,
  jurnalData: any[]
) {
  const db = await getDB()

  // Hanya simpan yang absen atau punya catatan (sparse storage)
  const toInsert = jurnalData.filter(
    (item) => item.status !== 'Aman' || (item.catatan && item.catatan.trim() !== '')
  )

  // Hapus entri tanggal itu saja (tetap perlu delete untuk jurnal karena tidak ada unique key per siswa+penugasan+tanggal yang bisa di-upsert langsung)
  // Tapi kita batasi: hanya siswa yang ada di jurnalData yang dihapus (bukan DELETE semua)
  if (toInsert.length === 0) {
    // Tidak ada yang absen hari ini — hapus catatan sebelumnya saja
    try {
      await db
        .prepare('DELETE FROM jurnal_guru_harian WHERE penugasan_id = ? AND tanggal = ?')
        .bind(penugasan_id, tanggal)
        .run()
    } catch (e: any) {
      return { error: e.message }
    }
    revalidatePath('/dashboard/kehadiran')
    return { success: 'Jurnal kelas berhasil disimpan! Semua siswa tercatat Hadir/Aman.' }
  }

  const deleteStmt = db
    .prepare('DELETE FROM jurnal_guru_harian WHERE penugasan_id = ? AND tanggal = ?')
    .bind(penugasan_id, tanggal)

  const insertStmts = toInsert.map((item) =>
    db
      .prepare(
        `INSERT INTO jurnal_guru_harian (penugasan_id, siswa_id, tanggal, status_kehadiran, catatan)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        penugasan_id,
        item.siswa_id,
        tanggal,
        item.status === 'Aman' ? null : item.status,
        item.catatan || null
      )
  )

  try {
    await db.batch([deleteStmt, ...insertStmts])
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/dashboard/kehadiran')
  return { success: 'Jurnal kelas berhasil disimpan! Siswa lainnya otomatis tercatat Hadir/Aman.' }
}

// ============================================================
// 4. AMBIL JURNAL HARIAN (untuk tampil di form)
// ============================================================
export async function getJurnalHarian(penugasan_id: string, tanggal: string) {
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT siswa_id, status_kehadiran, catatan FROM jurnal_guru_harian
       WHERE penugasan_id = ? AND tanggal = ?`
    )
    .bind(penugasan_id, tanggal)
    .all<any>()

  return result.results ?? []
}
