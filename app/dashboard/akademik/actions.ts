'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. Fungsi Master Mata Pelajaran ---
export async function tambahMapel(prevState: any, formData: FormData) {
  const supabase = createClient()
  const nama_mapel = (formData.get('nama_mapel') as string).trim()
  const kelompok = formData.get('kelompok') as string
  const tingkat = formData.get('tingkat') as string // Ubah dari fase ke tingkat
  const kategori = formData.get('kategori') as string

  if (!nama_mapel) return { error: 'Nama Mapel wajib diisi.', success: null }

  const { error } = await supabase.from('mata_pelajaran').insert({ nama_mapel, kelompok, tingkat, kategori })
  if (error) return { error: error.message.includes('unique') ? 'Mata Pelajaran ini sudah ada!' : error.message, success: null }

  revalidatePath('/dashboard/akademik')
  return { error: null, success: 'Mata pelajaran berhasil ditambahkan.' }
}

export async function editMapel(prevState: any, formData: FormData) {
  const supabase = createClient()
  const id = formData.get('id') as string
  const nama_mapel = (formData.get('nama_mapel') as string).trim()
  const kelompok = formData.get('kelompok') as string
  const tingkat = formData.get('tingkat') as string
  const kategori = formData.get('kategori') as string

  if (!id || !nama_mapel) return { error: 'ID dan Nama Mapel wajib diisi.', success: null }

  const { error } = await supabase.from('mata_pelajaran').update({ nama_mapel, kelompok, tingkat, kategori }).eq('id', id)
  
  if (error) return { error: error.message.includes('unique') ? 'Nama Mata Pelajaran sudah ada!' : error.message, success: null }

  revalidatePath('/dashboard/akademik')
  return { error: null, success: 'Mata pelajaran berhasil diupdate.' }
}

export async function hapusMapel(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('mata_pelajaran').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus: Mapel ini mungkin sedang digunakan.' }
  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil dihapus.' }
}

export async function importMapelMassal(dataExcel: any[]) {
  const supabase = createClient()
  const sanitizedData = dataExcel.map(item => ({
    nama_mapel: String(item.NAMA_MAPEL || '').trim(),
    kelompok: String(item.KELOMPOK || 'UMUM').toUpperCase().trim(),
    tingkat: String(item.TINGKAT || 'Semua').trim(),
    kategori: String(item.KATEGORI || 'Kelompok Mata Pelajaran Umum').trim() 
  })).filter(item => item.nama_mapel)

  if (sanitizedData.length === 0) return { error: 'Tidak ada data valid.' }

  const { error } = await supabase.from('mata_pelajaran').upsert(sanitizedData, { onConflict: 'nama_mapel', ignoreDuplicates: true })
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil mengimport data mata pelajaran.` }
}

// --- 2. Fungsi Import Penugasan dari ASC Timetables ---
export async function importPenugasanASC(dataExcel: any[]) {
  const supabase = createClient()
  
  const { data: ta } = await supabase.from('tahun_ajaran').select('id').eq('is_active', true).single()
  if (!ta) return { error: 'Tidak ada Tahun Ajaran yang aktif!' }

  const [resGuru, resMapel, resKelas] = await Promise.all([
    supabase.from('profiles').select('id, nama_lengkap').eq('role', 'guru'),
    supabase.from('mata_pelajaran').select('id, nama_mapel'),
    supabase.from('kelas').select('id, tingkat, nomor_kelas')
  ])

  const guruList = resGuru.data || []
  const mapelList = resMapel.data || []
  const kelasList = resKelas.data || []

  let errorLogs: string[] = []
  let toInsert = []

  for (let i = 0; i < dataExcel.length; i++) {
    const baris = dataExcel[i]
    const excelNamaGuru = String(baris.NAMA_GURU || '').trim().toLowerCase()
    const excelNamaMapel = String(baris.NAMA_MAPEL || '').trim().toLowerCase()
    const excelNamaKelas = String(baris.NAMA_KELAS || '').trim()

    if (!excelNamaGuru || !excelNamaMapel || !excelNamaKelas) continue

    const guru = guruList.find(g => g.nama_lengkap.toLowerCase().includes(excelNamaGuru))
    if (!guru) { errorLogs.push(`Baris ${i+2}: Guru '${baris.NAMA_GURU}' tidak ditemukan.`); continue; }

    const mapel = mapelList.find(m => m.nama_mapel.toLowerCase() === excelNamaMapel)
    if (!mapel) { errorLogs.push(`Baris ${i+2}: Mapel '${baris.NAMA_MAPEL}' tidak terdaftar di Master Mapel.`); continue; }

    const kelas = kelasList.find(k => `${k.tingkat}-${k.nomor_kelas}` === excelNamaKelas || `${k.tingkat} ${k.nomor_kelas}` === excelNamaKelas)
    if (!kelas) { errorLogs.push(`Baris ${i+2}: Kelas '${excelNamaKelas}' tidak cocok formatnya.`); continue; }

    toInsert.push({ guru_id: guru.id, mapel_id: mapel.id, kelas_id: kelas.id, tahun_ajaran_id: ta.id })
  }

  if (toInsert.length === 0) return { error: 'Tidak ada data yang valid untuk di-import. Cek error log.', logs: errorLogs }

  const { error } = await supabase.from('penugasan_mengajar').upsert(toInsert, { onConflict: 'guru_id, mapel_id, kelas_id, tahun_ajaran_id', ignoreDuplicates: true })
  if (error) return { error: error.message, logs: errorLogs }

  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil memproses & mencocokkan ${toInsert.length} penugasan!`, logs: errorLogs }
}

export async function hapusPenugasan(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('penugasan_mengajar').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan berhasil dihapus.' }
}