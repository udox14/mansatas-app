// Lokasi: app/dashboard/kelas/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbSelect, dbBatchInsert } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. CRUD KELAS
// ============================================================
export async function tambahKelas(prevState: any, formData: FormData) {
  const db = await getDB()
  const payload = {
    tingkat: parseInt(formData.get('tingkat') as string),
    kelompok: formData.get('kelompok') as string,
    nomor_kelas: formData.get('nomor_kelas') as string,
    wali_kelas_id: (formData.get('wali_kelas_id') as string) || null,
    kapasitas: parseInt(formData.get('kapasitas') as string) || 36,
  }

  const result = await dbInsert(db, 'kelas', payload)
  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil ditambahkan!' }
}

export async function editKelas(id: string, payload: any) {
  const db = await getDB()
  const result = await dbUpdate(db, 'kelas', payload, { id })
  if (result.error) return { error: result.error, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil diperbarui!' }
}

export async function hapusKelas(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'kelas', { id })
  if (result.error) return { error: result.error, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil dihapus!' }
}

export async function importKelasMassal(dataExcel: any[]) {
  const db = await getDB()

  // Ambil data guru untuk pencocokan nama wali kelas
  const guruRows = await db.prepare('SELECT id, nama_lengkap FROM "user"').all<any>()
  const mapGuru = new Map<string, string>()
  guruRows.results.forEach((g: any) => {
    if (g.nama_lengkap) mapGuru.set(g.nama_lengkap.toLowerCase().trim(), g.id)
  })

  const toInsert: any[] = []
  for (const row of dataExcel) {
    const tingkat = parseInt(row.TINGKAT)
    const kelompok = String(row.KELOMPOK || 'UMUM').trim()
    const nomor_kelas = String(row.NOMOR_KELAS || '').trim()
    const kapasitas = parseInt(row.KAPASITAS) || 36
    const namaGuru = String(row.WALI_KELAS || '').trim().toLowerCase()
    if (!tingkat || !nomor_kelas) continue

    const wali_kelas_id = namaGuru && mapGuru.has(namaGuru) ? mapGuru.get(namaGuru) : null
    toInsert.push({ tingkat, kelompok, nomor_kelas, kapasitas, wali_kelas_id })
  }

  if (toInsert.length > 0) {
    const { error } = await dbBatchInsert(db, 'kelas', toInsert)
    if (error) return { error, success: null }
  }

  revalidatePath('/dashboard/kelas')
  return { error: null, success: `Berhasil mengimport ${toInsert.length} kelas.` }
}

// ============================================================
// 2. INLINE EDIT & BATCH SAVE
// ============================================================
export async function editKelasForm(prevState: any, formData: FormData) {
  const db = await getDB()
  const id = formData.get('id') as string

  const wali_raw = formData.get('wali_kelas_id') as string
  const payload = {
    tingkat: parseInt(formData.get('tingkat') as string),
    kelompok: formData.get('kelompok') as string,
    nomor_kelas: formData.get('nomor_kelas') as string,
    wali_kelas_id: wali_raw === 'none' ? null : wali_raw,
    kapasitas: parseInt(formData.get('kapasitas') as string) || 36,
  }

  const result = await dbUpdate(db, 'kelas', payload, { id })
  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/kelas')
  revalidatePath(`/dashboard/kelas/${id}`)
  return { error: null, success: 'Data Rombongan Belajar berhasil diperbarui!' }
}

export async function setWaliKelas(kelasId: string, guruId: string | null) {
  const db = await getDB()
  const val = guruId === 'none' ? null : guruId
  const result = await dbUpdate(db, 'kelas', { wali_kelas_id: val }, { id: kelasId })
  if (result.error) return { error: result.error, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Wali kelas berhasil ditugaskan!' }
}

export async function batchUpdateKelas(
  updates: { id: string; kelompok?: string; wali_kelas_id?: string | null }[]
) {
  const db = await getDB()

  try {
    const stmts = updates.map(update => {
      const payload: any = {}
      if (update.kelompok !== undefined) payload.kelompok = update.kelompok
      if (update.wali_kelas_id !== undefined) {
        payload.wali_kelas_id = update.wali_kelas_id === 'none' ? null : update.wali_kelas_id
      }
      const keys = Object.keys(payload)
      const sets = keys.map(k => `${k} = ?`).join(', ')
      const vals = keys.map(k => payload[k])
      return db.prepare(`UPDATE kelas SET ${sets} WHERE id = ?`).bind(...vals, update.id)
    })
    await db.batch(stmts)
    revalidatePath('/dashboard/kelas')
    return { error: null, success: `Berhasil menyimpan perubahan pada ${updates.length} kelas!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat menyimpan massal.', success: null }
  }
}

// ============================================================
// 3. DETAIL KELAS: MUTASI & TAMBAH SISWA
// ============================================================
export async function getSiswaTanpaKelas() {
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT id, nama_lengkap, nisn FROM siswa
       WHERE kelas_id IS NULL AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .all<any>()
  return result.results
}

export async function assignSiswaKeKelas(siswaId: string, kelasId: string) {
  const db = await getDB()
  const result = await dbUpdate(db, 'siswa', { kelas_id: kelasId }, { id: siswaId })
  if (result.error) return { error: result.error }
  revalidatePath(`/dashboard/kelas/${kelasId}`)
  revalidatePath('/dashboard/kelas')
  return { success: 'Berhasil memasukkan siswa ke kelas!' }
}

export async function getKelasTujuanMutasi(tingkat: number, currentKelasId: string) {
  const db = await getDB()
  const rows = await db
    .prepare(
      `SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas,
              COUNT(s.id) as jumlah_siswa
       FROM kelas k
       LEFT JOIN siswa s ON s.kelas_id = k.id AND s.status = 'aktif'
       WHERE k.tingkat = ? AND k.id != ?
       GROUP BY k.id
       ORDER BY k.kelompok ASC, k.nomor_kelas ASC`
    )
    .bind(tingkat, currentKelasId)
    .all<any>()

  return rows.results.map((k: any) => ({
    id: k.id,
    nama: `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim(),
    kapasitas: k.kapasitas,
    jumlah_siswa: k.jumlah_siswa || 0,
  }))
}

export async function getSiswaUntukBarter(kelasId: string) {
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT id, nama_lengkap, nisn FROM siswa
       WHERE kelas_id = ? AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .bind(kelasId)
    .all<any>()
  return result.results
}

export async function prosesMutasi(payload: {
  siswaIdLama: string
  kelasIdLama: string
  kelasIdTujuan: string
  siswaIdBarter: string | null
}) {
  const db = await getDB()

  try {
    if (payload.siswaIdBarter) {
      // Atomic swap via D1 batch (pengganti PostgreSQL RPC swap_siswa_kelas)
      await db.batch([
        db
          .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
          .bind(payload.kelasIdTujuan, payload.siswaIdLama),
        db
          .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
          .bind(payload.kelasIdLama, payload.siswaIdBarter),
      ])
    } else {
      await db
        .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
        .bind(payload.kelasIdTujuan, payload.siswaIdLama)
        .run()
    }

    revalidatePath(`/dashboard/kelas/${payload.kelasIdLama}`)
    revalidatePath(`/dashboard/kelas/${payload.kelasIdTujuan}`)
    revalidatePath('/dashboard/kelas')
    return { success: 'Proses mutasi siswa berhasil!' }
  } catch (err: any) {
    return { error: err.message || 'Terjadi kesalahan sistem saat mutasi.' }
  }
}
