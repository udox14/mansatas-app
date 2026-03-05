'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. Ambil Pengaturan (Rumus & Mapel Pilihan) ---
export async function getPengaturanAkademik() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('pengaturan_akademik').select('*').eq('id', 'global').single()
  if (error) return null
  return data
}

export async function simpanPengaturanAkademik(payload: any) {
  const supabase = await createClient()
  const { error } = await supabase.from('pengaturan_akademik').update({
    mapel_snbp: payload.mapel_snbp,
    mapel_span: payload.mapel_span,
    bobot_rapor: payload.bobot_rapor,
    bobot_um: payload.bobot_um,
    updated_at: new Date().toISOString()
  }).eq('id', 'global')

  if (error) return { error: error.message }
  revalidatePath('/dashboard/akademik/analitik')
  return { success: 'Pengaturan rumus dan mata pelajaran berhasil disimpan!' }
}

// --- 2. Mesin Import Cerdas (Anti Duplikat, Berdasarkan NISN) ---
export async function importNilaiDariExcel(dataExcel: any[], targetKolom: string) {
  // targetKolom isinya: 'nilai_smt1', 'nilai_smt2', ..., atau 'nilai_um'
  const supabase = await createClient()
  
  // 1. Ambil semua siswa untuk dicocokkan NISN-nya
  const { data: dbSiswa } = await supabase.from('siswa').select('id, nisn, nama_lengkap')
  if (!dbSiswa) return { error: 'Gagal memuat database siswa' }

  // Buat mapping NISN ke ID Siswa untuk pencarian super cepat
  const nisnMap = new Map(dbSiswa.map(s => [s.nisn, s.id]))

  let toUpsert = []
  let errorLogs: string[] = []
  let successCount = 0

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const nisn = String(row.NISN || '').trim()
    
    // Kalau tidak ada NISN, coba cari by Nama (opsional, tapi NISN lebih akurat)
    if (!nisn) {
        errorLogs.push(`Baris ${i+2}: Dilewati karena tidak ada NISN.`)
        continue
    }

    const siswa_id = nisnMap.get(nisn)
    if (!siswa_id) {
        errorLogs.push(`Baris ${i+2} (NISN: ${nisn}): Siswa tidak ditemukan di database. Pastikan siswa sudah diinput di Menu Siswa.`)
        continue
    }

    // Bersihkan data row: hapus kolom identitas (NISN, NAMA, KELAS) agar yang tersisa HANYA nilai mapel saja
    const nilaiMapel = { ...row }
    delete nilaiMapel['NISN']
    delete nilaiMapel['NAMA']
    delete nilaiMapel['NAMA_LENGKAP']
    delete nilaiMapel['KELAS']
    delete nilaiMapel['NO']

    // Siapkan payload Upsert
    const payload: any = {
        siswa_id: siswa_id,
        updated_at: new Date().toISOString()
    }
    // Masukkan data JSON ke kolom yang dituju (misal: nilai_smt1)
    payload[targetKolom] = nilaiMapel

    toUpsert.push(payload)
  }

  // Lakukan Upsert (Menimpa jika sudah ada, membuat baru jika belum)
  // Karena kita upsert berdasarkan 'siswa_id', nilai semester lain TIDAK AKAN HILANG!
  if (toUpsert.length > 0) {
    const { error } = await supabase.from('rekap_nilai_akademik').upsert(toUpsert, { onConflict: 'siswa_id' })
    if (error) return { error: error.message }
    successCount = toUpsert.length
  }

  revalidatePath('/dashboard/akademik/analitik')
  return { 
    success: `Berhasil mengimport dan mencocokkan nilai untuk ${successCount} siswa ke dalam ${targetKolom.replace('nilai_', '').toUpperCase()}.`, 
    logs: errorLogs 
  }
}