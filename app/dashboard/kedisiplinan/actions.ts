// Lokasi: app/dashboard/kedisiplinan/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbSelect, dbBatchInsert } from '@/utils/db'
import { uploadBuktiFoto } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. TRANSAKSI PELANGGARAN
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
    return { error: 'Siswa dan Jenis Pelanggaran wajib dipilih dari daftar pencarian.', success: null }
  }

  const file = formData.get('foto') as File | null
  let foto_url = formData.get('existing_foto_url') as string | null

  // Upload bukti foto ke R2
  if (file && file.size > 0) {
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

export async function hapusPelanggaran(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'siswa_pelanggaran', { id })
  if (result.error) return { error: 'Akses ditolak atau gagal menghapus: ' + result.error }
  revalidatePath('/dashboard/kedisiplinan')
  return { success: 'Catatan pelanggaran berhasil dihapus permanen.' }
}

// ============================================================
// 2. MASTER PELANGGARAN
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

  const payload = { kategori, nama_pelanggaran, poin }

  if (id) {
    const result = await dbUpdate(db, 'master_pelanggaran', payload, { id })
    if (result.error) return { error: 'Gagal mengupdate master: ' + result.error, success: null }
  } else {
    const result = await dbInsert(db, 'master_pelanggaran', payload)
    if (result.error) return { error: 'Gagal menambah master: ' + result.error, success: null }
  }

  revalidatePath('/dashboard/kedisiplinan')
  return { error: null, success: 'Master pelanggaran berhasil disimpan.' }
}

export async function hapusMasterPelanggaran(id: string) {
  const db = await getDB()

  // Cek apakah sudah dipakai
  const existing = await db
    .prepare('SELECT id FROM siswa_pelanggaran WHERE master_pelanggaran_id = ? LIMIT 1')
    .bind(id)
    .first<any>()

  if (existing) {
    return {
      error: 'Tidak bisa menghapus: Jenis pelanggaran ini sudah memiliki riwayat pada data siswa. Silakan edit saja namanya.',
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
    .map(item => ({
      nama_pelanggaran: String(item.NAMA_PELANGGARAN || '').trim(),
      kategori: String(item.KATEGORI || 'Ringan').trim(),
      poin: parseInt(item.POIN) || 0,
    }))
    .filter(item => item.nama_pelanggaran && item.poin > 0)

  if (sanitizedData.length === 0) {
    return { error: 'Tidak ada data valid yang bisa diimport. Pastikan kolom sesuai format.' }
  }

  const { successCount, error } = await dbBatchInsert(db, 'master_pelanggaran', sanitizedData)
  if (error) return { error: 'Gagal mengimport data: ' + error }

  revalidatePath('/dashboard/kedisiplinan')
  return { success: `Berhasil menambahkan ${successCount} jenis pelanggaran ke dalam Kamus.` }
}
