// Lokasi: app/dashboard/kedisiplinan/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { uploadBuktiFoto, deleteFromR2, validateImageFile } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
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
      ? `${s.tingkat}-${s.nomor_kelas} ${s.kelompok !== 'UMUM' ? s.kelompok : ''}`.trim()
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
