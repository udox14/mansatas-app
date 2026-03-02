'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. Tambah Siswa Manual ---
export async function tambahSiswa(prevState: any, formData: FormData) {
  const supabase = createClient()
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
  const supabase = createClient()
  const { error } = await supabase.from('siswa').delete().eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/siswa')
  return { success: 'Data siswa berhasil dihapus permanen.' }
}

// --- 3. Import Siswa Massal (Smart Upsert by Nama Lengkap) ---
export async function importSiswaMassal(dataSiswa: any[]) {
  const supabase = createClient()
  
  // Pastikan user memiliki akses
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
      // Ubah ke huruf kecil semua agar tidak sensitif huruf besar/kecil
      existingMap.set(s.nama_lengkap.toLowerCase().trim(), s.id)
    })
  }

  let toInsert = []
  let toUpdate = []
  let errorLogs: string[] = []

  // C. Proses Data dari Excel
  for (let i = 0; i < dataSiswa.length; i++) {
    const item = dataSiswa[i]
    const namaLengkap = String(item.NAMA_LENGKAP || '').trim()
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

    const payload = {
      nisn: nisn,
      nis_lokal: item.NIS_LOKAL ? String(item.NIS_LOKAL).trim() : null,
      nama_lengkap: namaLengkap,
      jenis_kelamin: item.JK === 'P' ? 'P' : 'L',
      tempat_tinggal: item.TEMPAT_TINGGAL || 'Non-Pesantren',
      kelas_id: kelas_id,
      status: 'aktif',
      updated_at: new Date().toISOString()
    }

    // CEK APAKAH NAMA SUDAH ADA DI DATABASE?
    const existingSiswaId = existingMap.get(namaLengkap.toLowerCase())
    
    if (existingSiswaId) {
      // Jika sudah ada, masukkan ke antrean UPDATE (Timpa data lamanya, termasuk NISN)
      toUpdate.push({ ...payload, id: existingSiswaId })
    } else {
      // Jika belum ada, masukkan ke antrean INSERT (Buat data baru)
      toInsert.push(payload)
    }
  }

  let successCount = 0

  // D. Eksekusi ke Database
  if (toUpdate.length > 0) {
    const { error } = await supabase.from('siswa').upsert(toUpdate, { onConflict: 'id' })
    if (error) errorLogs.push(`Gagal update/menimpa data: ${error.message}`)
    else successCount += toUpdate.length
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('siswa').insert(toInsert)
    if (error) errorLogs.push(`Gagal insert data baru: ${error.message}`)
    else successCount += toInsert.length
  }

  revalidatePath('/dashboard/siswa')
  
  if (errorLogs.length > 0) return { success: `Selesai memproses. ${successCount} berhasil di-plot/ditimpa.`, logs: errorLogs }
  return { success: `Luar Biasa! Berhasil menyimpan dan menimpa ${successCount} data siswa!`, logs: [] }
}