// Lokasi: app/dashboard/kehadiran/actions.ts
'use server'

import { getDB, dbUpsert } from '@/utils/db'
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
      `SELECT * FROM rekap_kehadiran_bulanan
       WHERE kelas_id = ? AND bulan = ? AND tahun_ajaran_id = ?`
    )
    .bind(kelas_id, bulan, ta_id)
    .all<any>()

  if (result.error) return { error: String(result.error), data: null }
  return { error: null, data: result.results }
}

export async function simpanRekapBulanan(
  kelas_id: string,
  bulan: number,
  ta_id: string,
  rekapData: any[]
) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // D1 tidak support multi-column conflict target di ON CONFLICT
  // Kita upsert manual: delete lama lalu insert baru (dalam batch)
  const deleteStmt = db
    .prepare(
      `DELETE FROM rekap_kehadiran_bulanan
       WHERE kelas_id = ? AND bulan = ? AND tahun_ajaran_id = ?`
    )
    .bind(kelas_id, bulan, ta_id)

  const insertStmts = rekapData.map(item =>
    db
      .prepare(
        `INSERT INTO rekap_kehadiran_bulanan
         (siswa_id, kelas_id, tahun_ajaran_id, bulan, sakit, izin, alpa, diinput_oleh, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        new Date().toISOString()
      )
  )

  try {
    await db.batch([deleteStmt, ...insertStmts])
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/dashboard/kehadiran')
  return { success: 'Rekap kehadiran bulanan berhasil disimpan!' }
}

// ============================================================
// 3. JURNAL HARIAN GURU (Sparse Data)
// ============================================================
export async function simpanJurnalHarian(
  penugasan_id: string,
  tanggal: string,
  jurnalData: any[]
) {
  const db = await getDB()

  // Hanya simpan yang statusnya bukan 'Aman' atau punya catatan
  const toInsert = jurnalData.filter(
    item => item.status !== 'Aman' || (item.catatan && item.catatan.trim() !== '')
  )

  const deleteStmt = db
    .prepare(
      `DELETE FROM jurnal_guru_harian
       WHERE penugasan_id = ? AND tanggal = ?`
    )
    .bind(penugasan_id, tanggal)

  const insertStmts = toInsert.map(item =>
    db
      .prepare(
        `INSERT INTO jurnal_guru_harian
         (penugasan_id, siswa_id, tanggal, status_kehadiran, catatan)
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
