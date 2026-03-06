// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/siswa/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. Tambah Siswa Manual ---
export async function tambahSiswa(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const payload = {
    nisn: formData.get('nisn') as string,
    nis_lokal: formData.get('nis_lokal') as string || null,
    nama_lengkap: formData.get('nama_lengkap') as string,
    jenis_kelamin: formData.get('jenis_kelamin') as string,
    tempat_tinggal: formData.get('tempat_tinggal') as string,
  }
  
  if (!payload.nisn || !payload.nama_lengkap) return { error: 'NISN dan Nama wajib diisi', success: null }

  const { error } = await supabase.from('siswa').insert(payload)
  if (error) return { error: error.message.includes('unique') ? 'NISN sudah terdaftar' : error.message, success: null }

  revalidatePath('/dashboard/siswa')
  return { error: null, success: 'Siswa berhasil ditambahkan' }
}

// --- 2. Hapus Siswa ---
export async function hapusSiswa(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('siswa').delete().eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/siswa')
  return { success: 'Data siswa berhasil dihapus permanen.' }
}

// --- 3. Edit Siswa Manual (Basic) ---
export async function editSiswa(id: string, payload: any) {
  const supabase = await createClient()
  
  const { error } = await supabase.from('siswa').update(payload).eq('id', id)
  
  if (error) return { error: error.message.includes('unique') ? 'NISN sudah terdaftar untuk siswa lain' : error.message }

  revalidatePath('/dashboard/siswa')
  return { success: 'Data siswa berhasil diperbarui!' }
}

// --- 4. Edit Siswa Super Lengkap (Dari Modal) ---
export async function editSiswaLengkap(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  
  // PERBAIKAN: Menambahkan casting ": any" agar TypeScript tidak komplain saat kita memasukkan tipe Number (angka)
  const payload: any = Object.fromEntries(formData.entries())
  delete payload.id // Buang ID dari payload

  // Bersihkan data kosong menjadi null agar database rapi
  Object.keys(payload).forEach(key => {
    if (payload[key] === '' || payload[key] === 'undefined') {
      payload[key] = null
    }
  })

  // Pastikan angka benar-benar angka
  if (payload.anak_ke) payload.anak_ke = parseInt(payload.anak_ke as string)
  if (payload.jumlah_saudara) payload.jumlah_saudara = parseInt(payload.jumlah_saudara as string)

  const { error } = await supabase.from('siswa').update(payload).eq('id', id)
  if (error) return { error: error.message, success: null }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${id}`)
  return { error: null, success: 'Biodata lengkap berhasil diperbarui!' }
}

// --- FUNGSI BARU: Ambil Detail Lengkap (Lazy Load) ---
export async function getDetailSiswaLengkap(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('siswa').select('*').eq('id', id).single()
  if (error) return { error: error.message, data: null }
  return { error: null, data }
}

// --- 5. Upload Foto Cepat dari Mode Galeri ---
export async function uploadFotoSiswa(siswaId: string, formData: FormData) {
  const supabase = await createClient()
  const file = formData.get('foto') as File
  if (!file) return { error: 'Tidak ada file.' }

  const ext = file.name.split('.').pop()
  const fileName = `${siswaId}_${Date.now()}.${ext}`

  // Upload ke bucket 'foto_siswa'
  const { error: uploadError } = await supabase.storage.from('foto_siswa').upload(fileName, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data: publicUrl } = supabase.storage.from('foto_siswa').getPublicUrl(fileName)

  // Update kolom foto_url di tabel siswa
  const { error: dbError } = await supabase.from('siswa').update({ foto_url: publicUrl.publicUrl }).eq('id', siswaId)
  if (dbError) return { error: dbError.message }

  revalidatePath('/dashboard/siswa')
  return { success: 'Foto berhasil diperbarui!', url: publicUrl.publicUrl }
}

// --- 6. Import Siswa Massal (DENGAN BIODATA SUPER LENGKAP) ---
export async function importSiswaMassal(dataSiswa: any[]) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // A. Ambil data kelas untuk auto-plot
  const { data: kelasDb } = await supabase.from('kelas').select('id, tingkat, kelompok, nomor_kelas')
  const kelasMap = new Map()
  if (kelasDb) {
    kelasDb.forEach(k => {
      const key = `${k.tingkat}-${k.kelompok}-${k.nomor_kelas}`.toUpperCase()
      kelasMap.set(key, k.id)
    })
  }

  // B. Ambil data siswa yang SUDAH ADA untuk dicocokkan Namanya
  const { data: existingSiswa } = await supabase.from('siswa').select('id, nama_lengkap')
  const existingMap = new Map()
  if (existingSiswa) {
    existingSiswa.forEach(s => {
      existingMap.set(s.nama_lengkap.toLowerCase().trim(), s.id)
    })
  }

  let toInsert = []
  let toUpdate = []
  let errorLogs: string[] = []

  // Helper function: Excel date (serial number) to YYYY-MM-DD
  const parseExcelDate = (excelDate: any) => {
    if (!excelDate) return null;
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    // Jika formatnya sudah string tanggal (misal YYYY-MM-DD atau DD/MM/YYYY)
    return excelDate.toString();
  }

  // C. Proses Data dari Excel (Sesuai dengan kolom PPDB yang diminta)
  for (let i = 0; i < dataSiswa.length; i++) {
    const item = dataSiswa[i]
    const namaLengkap = String(item['NAMA LENGKAP'] || item.NAMA_LENGKAP || '').trim()
    const nisn = String(item.NISN || '').trim()

    // Lewati baris kosong
    if (!namaLengkap || !nisn) continue

    // Cari ID Kelas
    let kelas_id = null
    if (item.KELAS_TINGKAT && item.KELAS_NOMOR) {
      const kelompok = String(item.KELAS_KELOMPOK || 'UMUM').toUpperCase().trim()
      const key = `${item.KELAS_TINGKAT}-${kelompok}-${item.KELAS_NOMOR}`.toUpperCase().trim()
      kelas_id = kelasMap.get(key) || null
    }

    // Payload Raksasa
    const payload = {
      nisn: nisn,
      nis_lokal: item.NIS_LOKAL ? String(item.NIS_LOKAL).trim() : null,
      nama_lengkap: namaLengkap,
      jenis_kelamin: (item['JENIS KELAMIN'] || item.JK) === 'P' ? 'P' : 'L',
      tempat_tinggal: item.PESANTREN || item.TEMPAT_TINGGAL || 'Non-Pesantren',
      kelas_id: kelas_id,
      status: 'aktif',
      updated_at: new Date().toISOString(),

      // BIODATA DIRI
      nik: item.NIK ? String(item.NIK).trim() : null,
      tempat_lahir: item['TEMPAT LAHIR'] || null,
      tanggal_lahir: parseExcelDate(item['TANGGAL LAHIR']),
      agama: item.AGAMA || null,
      jumlah_saudara: item['JML SAUDARA'] ? parseInt(item['JML SAUDARA']) : null,
      anak_ke: item['ANAK KE'] ? parseInt(item['ANAK KE']) : null,
      status_anak: item['STS ANAK'] || null,

      // ALAMAT
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

      // DATA AYAH
      nama_ayah: item['NAMA AYAH'] || null,
      nik_ayah: item['NIK AYAH'] ? String(item['NIK AYAH']).trim() : null,
      tempat_lahir_ayah: item['TMP LHR AYAH'] || null,
      tanggal_lahir_ayah: parseExcelDate(item['TGL LHR AYAH']),
      status_ayah: item['STATUS AYAH'] || null,
      pendidikan_ayah: item['PENDIDIKAN AYAH'] || null,
      pekerjaan_ayah: item['PEKERJAAN AYAH'] || null,
      penghasilan_ayah: item['PENGHASILAN AYAH'] || null,

      // DATA IBU
      nama_ibu: item['NAMA IBU'] || null,
      nik_ibu: item['NIK IBU'] ? String(item['NIK IBU']).trim() : null,
      tempat_lahir_ibu: item['TMP LHR IBU'] || null,
      tanggal_lahir_ibu: parseExcelDate(item['TGL LHR IBU']),
      status_ibu: item['STATUS IBU'] || null,
      pendidikan_ibu: item['PENDIDIKAN IBU'] || null,
      pekerjaan_ibu: item['PEKERJAAN IBU'] || null,
      penghasilan_ibu: item['PENGHASILAN IBU'] || null,
    }

    // Buang properti bernilai null agar tidak menimpa data yang sudah ada menjadi kosong (saat update)
    Object.keys(payload).forEach(key => {
      if ((payload as any)[key] === null) {
        delete (payload as any)[key];
      }
    });

    const existingSiswaId = existingMap.get(namaLengkap.toLowerCase())
    
    if (existingSiswaId) {
      toUpdate.push({ ...payload, id: existingSiswaId })
    } else {
      toInsert.push(payload)
    }
  }

  let successCount = 0

  // D. Eksekusi ke Database
  if (toUpdate.length > 0) {
    const { error } = await supabase.from('siswa').upsert(toUpdate, { onConflict: 'id' })
    if (error) errorLogs.push(`Gagal menimpa data: ${error.message}`)
    else successCount += toUpdate.length
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('siswa').insert(toInsert)
    if (error) errorLogs.push(`Gagal membuat data baru: ${error.message}`)
    else successCount += toInsert.length
  }

  revalidatePath('/dashboard/siswa')
  
  if (errorLogs.length > 0) return { success: `Selesai. ${successCount} biodata berhasil di-import/ditimpa.`, logs: errorLogs }
  return { success: `Luar Biasa! Berhasil menyimpan biodata super lengkap untuk ${successCount} siswa!`, logs: [] }
}