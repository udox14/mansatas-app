// Lokasi: app/dashboard/siswa/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbSelectOne, dbBatchInsert, serializeValue } from '@/utils/db'
import { uploadFotoSiswa, deleteFromR2, validateImageFile } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

const FK_FIELDS = ['kelas_id', 'wali_murid_id']

// ============================================================
// 1. TAMBAH SISWA MANUAL
// ============================================================
export async function tambahSiswa(prevState: any, formData: FormData) {
  const db = await getDB()
  const payload = {
    nisn: formData.get('nisn') as string,
    nis_lokal: (formData.get('nis_lokal') as string) || null,
    nama_lengkap: formData.get('nama_lengkap') as string,
    jenis_kelamin: formData.get('jenis_kelamin') as string,
    tempat_tinggal: formData.get('tempat_tinggal') as string,
  }

  if (!payload.nisn || !payload.nama_lengkap) {
    return { error: 'NISN dan Nama wajib diisi', success: null }
  }

  const result = await dbInsert(db, 'siswa', payload)
  if (result.error) {
    return {
      error: result.error.includes('UNIQUE') ? 'NISN sudah terdaftar' : result.error,
      success: null,
    }
  }

  revalidatePath('/dashboard/siswa')
  return { error: null, success: 'Siswa berhasil ditambahkan' }
}

// ============================================================
// 2. HAPUS SISWA
// ============================================================
export async function hapusSiswa(id: string) {
  const db = await getDB()

  // Hapus foto R2 jika ada sebelum hapus record
  const siswa = await db
    .prepare('SELECT foto_url FROM siswa WHERE id = ?')
    .bind(id)
    .first<{ foto_url: string | null }>()

  if (siswa?.foto_url) {
    await deleteFromR2(siswa.foto_url)
  }

  const result = await dbDelete(db, 'siswa', { id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/siswa')
  return { success: 'Data siswa berhasil dihapus permanen.' }
}

// ============================================================
// 3. EDIT SISWA (Basic)
// ============================================================
export async function editSiswa(id: string, payload: any) {
  const db = await getDB()

  // Bersihkan FK kosong agar tidak simpan string kosong
  for (const field of FK_FIELDS) {
    if (payload[field] === '' || payload[field] === 'none') {
      payload[field] = null
    }
  }

  const result = await dbUpdate(
    db,
    'siswa',
    { ...payload, updated_at: new Date().toISOString() },
    { id }
  )

  if (result.error) {
    return {
      error: result.error.includes('UNIQUE') ? 'NISN sudah terdaftar pada siswa lain.' : result.error,
      success: null,
    }
  }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${id}`)
  return { error: null, success: 'Data siswa berhasil diperbarui.' }
}

// ============================================================
// 4. EDIT DETAIL LENGKAP SISWA (Buku Induk)
// ============================================================
export async function editDetailSiswa(id: string, payload: any) {
  const db = await getDB()

  for (const field of FK_FIELDS) {
    if (payload[field] === '' || payload[field] === 'none') {
      payload[field] = null
    }
  }

  const result = await dbUpdate(
    db,
    'siswa',
    { ...payload, updated_at: new Date().toISOString() },
    { id }
  )

  if (result.error) return { error: result.error, success: null }

  revalidatePath(`/dashboard/siswa/${id}`)
  revalidatePath('/dashboard/siswa')
  return { error: null, success: 'Data lengkap siswa berhasil diperbarui.' }
}

// ============================================================
// 5. UBAH STATUS SISWA
// ============================================================
export async function ubahStatusSiswa(id: string, status: string) {
  const db = await getDB()
  const result = await dbUpdate(
    db,
    'siswa',
    { status, updated_at: new Date().toISOString() },
    { id }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/siswa')
  return { success: `Status siswa berhasil diubah menjadi ${status}.` }
}

// ============================================================
// 6. UPLOAD FOTO SISWA KE R2
// Nama file tetap per siswa (overwrite otomatis), tidak perlu hapus lama
// ============================================================
export async function uploadFotoSiswaAction(siswaId: string, formData: FormData) {
  const file = formData.get('foto') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file.' }

  // Validasi sebelum upload
  const validationError = validateImageFile(file)
  if (validationError) return { error: validationError }

  const { url, error: uploadError } = await uploadFotoSiswa(siswaId, file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }

  const db = await getDB()
  const result = await dbUpdate(
    db,
    'siswa',
    { foto_url: url, updated_at: new Date().toISOString() },
    { id: siswaId }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${siswaId}`)
  return { success: 'Foto berhasil diperbarui!', url }
}

// ============================================================
// 7. IMPORT MASSAL SISWA
// ============================================================
export async function importSiswaMassal(dataSiswa: any[]) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // Ambil data kelas dan siswa existing dalam 1 query masing-masing
  const [kelasDb, existingDb] = await Promise.all([
    db.prepare('SELECT id, tingkat, kelompok, nomor_kelas FROM kelas').all<any>(),
    db.prepare('SELECT id, nisn, nama_lengkap FROM siswa').all<any>(),
  ])

  const kelasMap = new Map<string, string>()
  kelasDb.results.forEach((k: any) => {
    const key = `${k.tingkat}-${k.kelompok}-${k.nomor_kelas}`.toUpperCase()
    kelasMap.set(key, k.id)
  })

  const existingByNama = new Map<string, { id: string; nisn: string }>()
  const existingByNisn = new Map<string, { id: string; nama_lengkap: string }>()
  existingDb.results.forEach((s: any) => {
    existingByNama.set(s.nama_lengkap.toLowerCase().trim(), { id: s.id, nisn: s.nisn })
    if (s.nisn) existingByNisn.set(s.nisn.trim(), { id: s.id, nama_lengkap: s.nama_lengkap })
  })

  const toInsert: any[] = []
  const toUpdate: any[] = []
  const errors: string[] = []

  for (const row of dataSiswa) {
    const nisn = row.NISN ? String(row.NISN).trim() : ''
    const nama_lengkap = row.NAMA_LENGKAP ? String(row.NAMA_LENGKAP).trim() : ''

    if (!nama_lengkap) { errors.push(`Baris kosong nama dilewati`); continue }

    const tingkat = row.TINGKAT ? parseInt(row.TINGKAT) : null
    const kelompok = row.KELOMPOK ? String(row.KELOMPOK).trim().toUpperCase() : 'UMUM'
    const nomor_kelas = row.NOMOR_KELAS ? String(row.NOMOR_KELAS).trim() : null
    const kelasKey = tingkat && nomor_kelas ? `${tingkat}-${kelompok}-${nomor_kelas}` : null
    const kelas_id = kelasKey ? (kelasMap.get(kelasKey) ?? null) : null

    const payload: any = {
      nisn: nisn || null,
      nama_lengkap,
      jenis_kelamin: row.JENIS_KELAMIN === 'P' ? 'P' : 'L',
      tempat_tinggal: row.TEMPAT_TINGGAL === 'Pesantren' ? 'Pesantren' : 'Non-Pesantren',
      kelas_id,
      status: 'aktif',
    }

    const existBySisn = nisn ? existingByNisn.get(nisn) : null
    const existByNama = existingByNama.get(nama_lengkap.toLowerCase())
    const existing = existBySisn || existByNama

    if (existing) {
      toUpdate.push({ id: existing.id, ...payload })
    } else {
      toInsert.push(payload)
    }
  }

  let insertCount = 0
  let updateCount = 0

  if (toInsert.length > 0) {
    const { successCount } = await dbBatchInsert(db, 'siswa', toInsert)
    insertCount = successCount
  }

  if (toUpdate.length > 0) {
    const chunkSize = 100
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize)
      const stmts = chunk.map((s: any) => {
        const { id, ...data } = s
        const keys = Object.keys(data)
        const sets = keys.map((k) => `${k} = ?`).join(', ')
        const vals = keys.map((k) => serializeValue(data[k]))
        return db.prepare(`UPDATE siswa SET ${sets}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, id)
      })
      await db.batch(stmts)
      updateCount += chunk.length
    }
  }

  revalidatePath('/dashboard/siswa')
  return {
    error: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    success: `Import selesai: ${insertCount} ditambahkan, ${updateCount} diperbarui.`,
  }
}

// ============================================================
// FUNGSI YANG DIBUTUHKAN OLEH CLIENT COMPONENTS
// (tetap ada dari versi original, tidak dihapus)
// ============================================================

// editSiswaLengkap — dipakai oleh edit-modal.tsx
export async function editSiswaLengkap(prevState: any, formData: FormData) {
  const db = await getDB()
  const id = formData.get('id') as string
  if (!id) return { error: 'ID siswa tidak ditemukan', success: null }

  const payload: any = Object.fromEntries(formData.entries())
  delete payload.id

  // Sanitasi menyeluruh:
  // 1. Field FK (kelas_id, wali_murid_id): string kosong / "none" → null
  // 2. Semua field lain: string kosong / "undefined" / "null" → null
  // Ini mencegah FOREIGN KEY constraint failed karena string kosong dikirim sebagai value
  Object.keys(payload).forEach(key => {
    const val = payload[key]
    if (FK_FIELDS.includes(key)) {
      // FK field: hanya boleh null atau UUID valid — "none", "", dll → null
      if (!val || val === 'none' || val === 'null' || val === 'undefined') {
        payload[key] = null
      }
    } else {
      // Non-FK field: kosong → null agar tidak simpan string kosong
      if (val === '' || val === 'undefined' || val === 'null') {
        payload[key] = null
      }
    }
  })

  // Konversi field numerik
  if (payload.anak_ke !== null) payload.anak_ke = payload.anak_ke ? parseInt(payload.anak_ke) : null
  if (payload.jumlah_saudara !== null) payload.jumlah_saudara = payload.jumlah_saudara ? parseInt(payload.jumlah_saudara) : null

  payload.updated_at = new Date().toISOString()

  const result = await dbUpdate(db, 'siswa', payload, { id })
  if (result.error) {
    return {
      error: result.error.includes('FOREIGN KEY')
        ? 'Gagal: Kelas yang dipilih tidak valid. Coba pilih ulang atau pilih "Tanpa Kelas".'
        : result.error.includes('UNIQUE')
        ? 'NISN sudah terdaftar pada siswa lain.'
        : result.error,
      success: null,
    }
  }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${id}`)
  return { error: null, success: 'Biodata lengkap berhasil diperbarui!' }
}

// getDetailSiswaLengkap — dipakai oleh siswa-client.tsx (lazy load detail)
export async function getDetailSiswaLengkap(id: string) {
  const db = await getDB()
  const data = await dbSelectOne<any>(db, 'siswa', { id })
  if (!data) return { error: 'Data tidak ditemukan', data: null }
  return { error: null, data }
}
