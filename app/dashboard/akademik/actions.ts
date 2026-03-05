// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/akademik/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. MAPEL ACTIONS ---
export async function tambahMapel(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }
  
  const { error } = await supabase.from('mata_pelajaran').insert(payload)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil ditambahkan' }
}

export async function editMapel(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }
  
  const { error } = await supabase.from('mata_pelajaran').update(payload).eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil diperbarui' }
}

export async function hapusMapel(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('mata_pelajaran').delete().eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil dihapus' }
}

export async function importMapelMassal(dataExcel: any[]) {
  const supabase = await createClient()
  const toInsert = dataExcel.map(row => ({
    nama_mapel: String(row.NAMA_MAPEL).trim(),
    kelompok: String(row.KELOMPOK || 'UMUM').trim(),
    tingkat: String(row.TINGKAT || 'Semua').trim(),
    kategori: String(row.KATEGORI || 'Umum').trim()
  })).filter(item => item.nama_mapel && item.nama_mapel !== 'undefined')

  if(toInsert.length === 0) return { error: 'Data Excel kosong atau format tidak sesuai.' }
  
  const { error } = await supabase.from('mata_pelajaran').upsert(toInsert, { onConflict: 'nama_mapel', ignoreDuplicates: true })
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil mengimport ${toInsert.length} data mata pelajaran.` }
}

// --- 2. PENUGASAN MENGAJAR (ASC IMPORT) ACTIONS ---
export async function hapusPenugasan(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('penugasan_mengajar').delete().eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan mengajar berhasil dihapus' }
}

// FUNGSI BARU: Menghapus semua penugasan sekaligus di semester aktif
export async function resetPenugasanSemesterIni(tahun_ajaran_id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('penugasan_mengajar').delete().eq('tahun_ajaran_id', tahun_ajaran_id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik')
  return { success: 'Seluruh jadwal mengajar di semester ini berhasil direset/dikosongkan!' }
}

export async function importPenugasanASC(dataExcel: any[]) {
  const supabase = await createClient()
  
  // 1. Ambil Tahun Ajaran Aktif (Syarat wajib untuk penugasan)
  const { data: taAktif } = await supabase.from('tahun_ajaran').select('id').eq('is_active', true).single()
  if (!taAktif) return { error: 'Tahun ajaran aktif belum diatur di sistem. Silakan atur di menu Dashboard/Settings.' }

  // 2. Ambil data master untuk pencocokan
  const { data: dbGuru } = await supabase.from('profiles').select('id, nama_lengkap').neq('role', 'wali_murid')
  const { data: dbMapel } = await supabase.from('mata_pelajaran').select('id, nama_mapel')
  const { data: dbKelas } = await supabase.from('kelas').select('id, tingkat, nomor_kelas')

  if (!dbGuru || !dbMapel || !dbKelas) return { error: 'Gagal memuat data referensi dari database.' }

  // 3. Buat Fungsi Normalisasi Nama (Sangat Cerdas)
  // Menghilangkan gelar seperti S.Pd, M.Ag, Drs., dll untuk toleransi pencocokan dengan ASC
  const normalizeName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/drs\./gi, '') // Hapus awalan Drs.
      .replace(/dra\./gi, '') // Hapus awalan Dra.
      .replace(/[,.]\s*[a-zA-Z.]+/g, '') // Hapus gelar di belakang (setelah koma)
      .trim()
  }

  // 4. Buat Kamus (Map) agar pencarian super cepat O(1)
  const mapGuru = new Map()
  dbGuru.forEach(g => {
    mapGuru.set(g.nama_lengkap.toLowerCase().trim(), g.id) // Pencocokan Persis
    mapGuru.set(normalizeName(g.nama_lengkap), g.id)       // Pencocokan Tanpa Gelar
  })

  const mapMapel = new Map(dbMapel.map(m => [m.nama_mapel.toLowerCase().trim(), m.id]))
  
  const mapKelas = new Map()
  dbKelas.forEach(k => {
    mapKelas.set(`${k.tingkat}-${k.nomor_kelas}`, k.id) // Format "12-1"
    mapKelas.set(`${k.tingkat} ${k.nomor_kelas}`, k.id) // Format "12 1"
  })

  let toInsert = []
  let logs = []
  let successCount = 0

  // 5. Proses Baris per Baris (Sesuai format ASC yang diulang-ulang)
  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    
    // Fleksibilitas nama kolom Excel (Mendukung "NAMA_GURU" atau sekadar "Guru")
    const namaGuru = String(row.NAMA_GURU || row.Guru || row.GURU || '').trim()
    const namaKelas = String(row.NAMA_KELAS || row.Kelas || row.KELAS || '').trim()
    const namaMapel = String(row.NAMA_MAPEL || row.Mapel || row.Mata_Pelajaran || '').trim()

    if (!namaGuru || !namaMapel || !namaKelas) continue // Lewati baris kosong

    // Coba cari ID Guru
    const guruId = mapGuru.get(namaGuru.toLowerCase()) || mapGuru.get(normalizeName(namaGuru))
    if (!guruId) {
      logs.push(`Baris ${i+2}: Guru "${namaGuru}" tidak ditemukan di database.`)
      continue
    }

    // Coba cari ID Mapel
    const mapelId = mapMapel.get(namaMapel.toLowerCase())
    if (!mapelId) {
      logs.push(`Baris ${i+2}: Mapel "${namaMapel}" belum terdaftar di Master.`)
      continue
    }

    // Coba cari ID Kelas
    const kelasId = mapKelas.get(namaKelas.toLowerCase())
    if (!kelasId) {
      logs.push(`Baris ${i+2}: Kelas "${namaKelas}" tidak dikenali di sistem.`)
      continue
    }

    toInsert.push({
      guru_id: guruId,
      mapel_id: mapelId,
      kelas_id: kelasId,
      tahun_ajaran_id: taAktif.id
    })
  }

  // 6. Eksekusi ke Database (Upsert: Hindari dobel data jika di-import ulang)
  if (toInsert.length > 0) {
    const { error } = await supabase.from('penugasan_mengajar').upsert(toInsert, { 
      onConflict: 'guru_id,mapel_id,kelas_id,tahun_ajaran_id', 
      ignoreDuplicates: true 
    })
    if (error) return { error: error.message }
    successCount = toInsert.length
  }

  revalidatePath('/dashboard/akademik')
  return { success: `Selesai! Berhasil memploting ${successCount} baris jadwal dari ASC.`, logs }
}