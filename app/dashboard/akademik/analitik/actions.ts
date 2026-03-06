// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/akademik/analitik/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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

// --- 2. Mesin Import Cerdas dengan Kamus Translasi & Pembersih Noise ---
export async function importNilaiDariExcel(dataExcel: any[], targetKolom: string) {
  const supabase = await createClient()
  
  const { data: dbSiswa } = await supabase.from('siswa').select('id, nisn, nama_lengkap')
  if (!dbSiswa) return { error: 'Gagal memuat database siswa' }

  // Buat Kamus Translasi (Cth: IPAT -> IPA Terpadu)
  const { data: dbMapel } = await supabase.from('mata_pelajaran').select('nama_mapel, kode_mapel')
  const kamusMapel = new Map()
  if (dbMapel) {
    dbMapel.forEach(m => {
      kamusMapel.set(m.nama_mapel.toLowerCase().trim(), m.nama_mapel)
      if (m.kode_mapel) {
        kamusMapel.set(m.kode_mapel.toLowerCase().trim(), m.nama_mapel)
      }
    })
  }

  const nisnMap = new Map(dbSiswa.map(s => [s.nisn, s.id]))

  let toUpsert = []
  let errorLogs: string[] = []
  let successCount = 0

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    
    // Cari key NISN secara dinamis (tidak peduli uppercase/lowercase)
    const nisnKey = Object.keys(row).find(k => k.toUpperCase().trim() === 'NISN')
    const nisn = nisnKey ? String(row[nisnKey]).trim() : ''
    
    // PERBAIKAN: Cari key Nama Siswa agar bisa dimunculkan di log
    const namaKey = Object.keys(row).find(k => {
      const upper = k.toUpperCase().trim()
      return upper === 'NAMA' || upper === 'NAMA LENGKAP' || upper === 'NAMA_LENGKAP'
    })
    const namaSiswa = namaKey ? String(row[namaKey]).trim() : 'Nama Tidak Tersedia'

    if (!nisn) {
        errorLogs.push(`Baris Excel ke-${i+1}: Dilewati (Tidak terdeteksi angka NISN untuk siswa ${namaSiswa}).`)
        continue
    }

    const siswa_id = nisnMap.get(nisn)
    if (!siswa_id) {
        errorLogs.push(`Siswa bernama "${namaSiswa}" (NISN: ${nisn}) tidak ditemukan di database Madrasah. Pastikan data siswa ini sudah ditambahkan di menu Data Siswa.`)
        continue
    }

    const nilaiMapelTerjemahan: any = {}
    
    Object.keys(row).forEach(kolomExcel => {
      const upperKey = kolomExcel.toUpperCase().trim()
      
      // Blacklist semua kolom yang bukan mata pelajaran
      const blacklist = ['NO', 'NIS', 'NISN', 'NAMA', 'JK', 'L/P', 'JUMLAH', 'RATA', 'RATA-RATA', 'KELAS']
      if (blacklist.includes(upperKey)) return

      const cleanCol = kolomExcel.toLowerCase().trim()
      
      // Terjemahkan kode RDM ke Nama Mapel Asli
      const namaMapelStandar = kamusMapel.get(cleanCol) || kolomExcel.trim()

      // Pastikan yang diinput adalah angka
      const nilaiAngka = Number(row[kolomExcel])
      if (!isNaN(nilaiAngka)) {
        nilaiMapelTerjemahan[namaMapelStandar] = nilaiAngka
      }
    })

    const payload: any = {
        siswa_id: siswa_id,
        updated_at: new Date().toISOString()
    }
    
    payload[targetKolom] = nilaiMapelTerjemahan
    toUpsert.push(payload)
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase.from('rekap_nilai_akademik').upsert(toUpsert, { onConflict: 'siswa_id' })
    if (error) return { error: error.message }
    successCount = toUpsert.length
  }

  revalidatePath('/dashboard/akademik/analitik')
  return { 
    success: `Selesai! Berhasil memploting nilai RDM untuk ${successCount} Siswa.`, 
    logs: errorLogs 
  }
}