// Lokasi: app/dashboard/siswa/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbSelectOne, dbBatchInsert, dbUpsert } from '@/utils/db'
import { uploadFotoSiswa } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

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
  const result = await dbUpdate(db, 'siswa', { ...payload, updated_at: new Date().toISOString() }, { id })
  if (result.error) {
    return {
      error: result.error.includes('UNIQUE') ? 'NISN sudah terdaftar untuk siswa lain' : result.error,
    }
  }

  revalidatePath('/dashboard/siswa')
  return { success: 'Data siswa berhasil diperbarui!' }
}

// ============================================================
// 4. EDIT SISWA LENGKAP (Dari Modal)
// ============================================================
export async function editSiswaLengkap(prevState: any, formData: FormData) {
  const db = await getDB()
  const id = formData.get('id') as string

  const payload: any = Object.fromEntries(formData.entries())
  delete payload.id

  Object.keys(payload).forEach(key => {
    if (payload[key] === '' || payload[key] === 'undefined') {
      payload[key] = null
    }
  })

  if (payload.anak_ke) payload.anak_ke = parseInt(payload.anak_ke as string)
  if (payload.jumlah_saudara) payload.jumlah_saudara = parseInt(payload.jumlah_saudara as string)

  payload.updated_at = new Date().toISOString()

  const result = await dbUpdate(db, 'siswa', payload, { id })
  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${id}`)
  return { error: null, success: 'Biodata lengkap berhasil diperbarui!' }
}

// ============================================================
// 5. GET DETAIL SISWA (Lazy Load)
// ============================================================
export async function getDetailSiswaLengkap(id: string) {
  const db = await getDB()
  const data = await dbSelectOne<any>(db, 'siswa', { id })
  if (!data) return { error: 'Data tidak ditemukan', data: null }
  return { error: null, data }
}

// ============================================================
// 6. UPLOAD FOTO SISWA KE R2
// ============================================================
export async function uploadFotoSiswaAction(siswaId: string, formData: FormData) {
  const db = await getDB()
  const file = formData.get('foto') as File
  if (!file) return { error: 'Tidak ada file.' }

  const { url, error: uploadError } = await uploadFotoSiswa(siswaId, file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }

  const result = await dbUpdate(
    db,
    'siswa',
    { foto_url: url, updated_at: new Date().toISOString() },
    { id: siswaId }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/siswa')
  return { success: 'Foto berhasil diperbarui!', url }
}

// ============================================================
// 7. IMPORT MASSAL SISWA
// ============================================================
export async function importSiswaMassal(dataSiswa: any[]) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // A. Ambil data kelas untuk auto-plot
  const kelasDb = await db.prepare('SELECT id, tingkat, kelompok, nomor_kelas FROM kelas').all<any>()
  const kelasMap = new Map<string, string>()
  kelasDb.results.forEach((k: any) => {
    const key = `${k.tingkat}-${k.kelompok}-${k.nomor_kelas}`.toUpperCase()
    kelasMap.set(key, k.id)
  })

  // B. Ambil siswa existing: lookup by nama & by NISN
  const existingDb = await db.prepare('SELECT id, nisn, nama_lengkap FROM siswa').all<any>()
  const existingByNama = new Map<string, { id: string; nisn: string }>()
  const existingByNisn = new Map<string, { id: string; nama_lengkap: string }>()
  existingDb.results.forEach((s: any) => {
    existingByNama.set(s.nama_lengkap.toLowerCase().trim(), { id: s.id, nisn: s.nisn })
    if (s.nisn) existingByNisn.set(s.nisn.trim(), { id: s.id, nama_lengkap: s.nama_lengkap })
  })

  const toInsert: any[] = []
  const toUpdate: any[] = []
  const errorLogs: string[] = []

  const parseExcelDate = (excelDate: any) => {
    if (!excelDate) return null
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000)
      return date.toISOString().split('T')[0]
    }
    return excelDate.toString()
  }

  for (let i = 0; i < dataSiswa.length; i++) {
    const item = dataSiswa[i]
    const namaLengkap = String(item['NAMA LENGKAP'] || item.NAMA_LENGKAP || '').trim()
    const nisn = String(item.NISN || '').trim()
    if (!namaLengkap || !nisn) continue

    // --- CEK DUPLIKAT NISN vs NAMA ---
    const existingByNisnEntry = existingByNisn.get(nisn)
    if (existingByNisnEntry) {
      const namaYangAda = existingByNisnEntry.nama_lengkap.toLowerCase().trim()
      if (namaYangAda !== namaLengkap.toLowerCase()) {
        // NISN sama tapi nama beda — warning, skip
        errorLogs.push(
          `⚠️ Baris ${i + 2}: NISN ${nisn} milik "${namaLengkap}" sudah dipakai oleh "${existingByNisnEntry.nama_lengkap}" — periksa NISN-nya.`
        )
        continue
      }
      // NISN sama + nama sama → true duplicate, skip diam-diam
      continue
    }

    // --- CEK DUPLIKAT DI DALAM FILE EXCEL SENDIRI ---
    // (NISN yang sama muncul dua kali di Excel, belum ada di DB)
    // Ditangani oleh INSERT OR IGNORE di dbBatchInsert nanti

    let kelas_id: string | null = null
    if (item.KELAS_TINGKAT && item.KELAS_NOMOR) {
      const kelompok = String(item.KELAS_KELOMPOK || 'UMUM').toUpperCase().trim()
      const key = `${item.KELAS_TINGKAT}-${kelompok}-${item.KELAS_NOMOR}`.toUpperCase().trim()
      kelas_id = kelasMap.get(key) || null
    }

    const payload: any = {
      nisn,
      nis_lokal: item.NIS_LOKAL ? String(item.NIS_LOKAL).trim() : null,
      nama_lengkap: namaLengkap,
      jenis_kelamin: (item['JENIS KELAMIN'] || item.JK) === 'P' ? 'P' : 'L',
      tempat_tinggal: item.PESANTREN || item.TEMPAT_TINGGAL || 'Non-Pesantren',
      kelas_id,
      status: 'aktif',
      updated_at: new Date().toISOString(),
      nik: item.NIK ? String(item.NIK).trim() : null,
      tempat_lahir: item['TEMPAT LAHIR'] || null,
      tanggal_lahir: parseExcelDate(item['TANGGAL LAHIR']),
      agama: item.AGAMA || null,
      jumlah_saudara: item['JML SAUDARA'] ? parseInt(item['JML SAUDARA']) : null,
      anak_ke: item['ANAK KE'] ? parseInt(item['ANAK KE']) : null,
      status_anak: item['STS ANAK'] || null,
      alamat_lengkap: item['ALAMAT LENGKAP (JL/ KP.)'] || null,
      rt: item.RT ? String(item.RT).trim() : null,
      rw: item.RW ? String(item.RW).trim() : null,
      desa_kelurahan: item['DESA/KELURAHAN'] || null,
      kecamatan: item.KECAMATAN || null,
      kabupaten_kota: item['KAB./KOTA'] || null,
      provinsi: item.PROV || null,
      kode_pos: item['KD POS'] ? String(item['KD POS']).trim() : null,
      nomor_whatsapp: item['NOMOR WHATSAPP'] ? String(item['NOMOR WHATSAPP']).trim() : null,
      nomor_kk: item['No. KK'] || item['NO KK'] ? String(item['No. KK'] || item['NO KK']).trim() : null,
      nama_ayah: item['NAMA AYAH'] || null,
      nik_ayah: item['NIK AYAH'] ? String(item['NIK AYAH']).trim() : null,
      tempat_lahir_ayah: item['TMP LHR AYAH'] || null,
      tanggal_lahir_ayah: parseExcelDate(item['TGL LHR AYAH']),
      status_ayah: item['STATUS AYAH'] || null,
      pendidikan_ayah: item['PENDIDIKAN AYAH'] || null,
      pekerjaan_ayah: item['PEKERJAAN AYAH'] || null,
      penghasilan_ayah: item['PENGHASILAN AYAH'] || null,
      nama_ibu: item['NAMA IBU'] || null,
      nik_ibu: item['NIK IBU'] ? String(item['NIK IBU']).trim() : null,
      tempat_lahir_ibu: item['TMP LHR IBU'] || null,
      tanggal_lahir_ibu: parseExcelDate(item['TGL LHR IBU']),
      status_ibu: item['STATUS IBU'] || null,
      pendidikan_ibu: item['PENDIDIKAN IBU'] || null,
      pekerjaan_ibu: item['PEKERJAAN IBU'] || null,
      penghasilan_ibu: item['PENGHASILAN IBU'] || null,
    }

    // Buang null agar tidak overwrite data lama
    Object.keys(payload).forEach(key => {
      if (payload[key] === null) delete payload[key]
    })

    // Cek apakah nama sudah ada di DB (untuk UPDATE)
    const existingByNamaEntry = existingByNama.get(namaLengkap.toLowerCase())
    if (existingByNamaEntry) {
      toUpdate.push({ ...payload, id: existingByNamaEntry.id })
    } else {
      toInsert.push(payload)
    }
  }

  let successCount = 0

  // INSERT baru
  if (toInsert.length > 0) {
    const { successCount: inserted, error } = await dbBatchInsert(db, 'siswa', toInsert)
    if (error) errorLogs.push(`Gagal membuat data baru: ${error}`)
    else successCount += inserted
  }

  // UPDATE yang sudah ada — D1 batch update
  if (toUpdate.length > 0) {
    const stmts = toUpdate.map((row: any) => {
      const { id, nisn, nis_lokal, ...data } = row // nisn & nis_lokal jangan di-overwrite
      const keys = Object.keys(data)
      const sets = keys.map(k => `${k} = ?`).join(', ')
      const vals = keys.map(k => data[k] ?? null)
      return db.prepare(`UPDATE siswa SET ${sets} WHERE id = ?`).bind(...vals, id)
    })
    try {
      await db.batch(stmts)
      successCount += toUpdate.length
    } catch (e: any) {
      errorLogs.push(`Gagal menimpa data: ${e.message}`)
    }
  }

  revalidatePath('/dashboard/siswa')

  const nisnWarnings = errorLogs.filter(l => l.startsWith('⚠️')).length
  const otherErrors = errorLogs.filter(l => !l.startsWith('⚠️')).length

  let successMsg = `Berhasil menyimpan biodata ${successCount} siswa.`
  if (nisnWarnings > 0) successMsg += ` ${nisnWarnings} siswa dilewati karena konflik NISN (lihat log).`
  if (otherErrors > 0) successMsg += ` ${otherErrors} error lainnya.`

  return { success: successMsg, logs: errorLogs }
}