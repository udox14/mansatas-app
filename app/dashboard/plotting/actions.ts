// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/plotting/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Tahun Ajaran Aktif
export async function getTahunAjaranAktif() {
  const supabase = await createClient()
  let { data: ta } = await supabase.from('tahun_ajaran').select('id, nama, semester').eq('is_active', true).single()
  
  if (!ta) {
    const { data: newTa } = await supabase
      .from('tahun_ajaran')
      .insert({ nama: '2024/2025', semester: 1, is_active: true })
      .select('id, nama, semester')
      .single()
    ta = newTa
  }
  return ta
}

// 2. Ambil Siswa yang BELUM punya kelas
export async function getSiswaBelumAdaKelas() {
  const supabase = await createClient()
  let allData: any[] = []
  let hasMore = true
  let page = 0
  const limit = 1000
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('siswa')
      .select('id, nisn, nama_lengkap, jenis_kelamin')
      .is('kelas_id', null)
      .eq('status', 'aktif')
      .order('nama_lengkap')
      .range(page * limit, (page + 1) * limit - 1)
    
    if (error) break
    
    allData = [...allData, ...data]
    if (data.length < limit) hasMore = false
    page++
  }
  return allData
}

// 3. Ambil daftar kelas berdasarkan Tingkat
export async function getKelasByTingkat(tingkat: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('kelas')
    .select('id, tingkat, kelompok, nomor_kelas, kapasitas, siswa(count)')
    .eq('tingkat', tingkat)
    .order('kelompok')
    .order('nomor_kelas')

  if (error) return []
  return data.map(k => ({
    id: k.id,
    nama: `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim(),
    kelompok: k.kelompok,
    kapasitas: k.kapasitas,
    jumlah_siswa: k.siswa && k.siswa.length > 0 ? (k.siswa[0] as any).count : 0
  }))
}

// 4. Ambil Siswa yang SEDANG berada di tingkat tertentu (Ditambah Minat Jurusan)
export async function getSiswaByTingkat(tingkat: number) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('siswa')
    .select(`
      id, nisn, nama_lengkap, jenis_kelamin, kelas_id, minat_jurusan,
      kelas!inner(id, tingkat, kelompok, nomor_kelas)
    `)
    .eq('kelas.tingkat', tingkat)
    .eq('status', 'aktif')
    .order('nama_lengkap')
  
  if (error) return []

  return data.map(s => {
    const k = s.kelas as any
    return {
      id: s.id,
      nisn: s.nisn,
      nama_lengkap: s.nama_lengkap,
      jenis_kelamin: s.jenis_kelamin,
      minat_jurusan: s.minat_jurusan || null,
      kelas_lama: k ? `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim() : 'Tidak diketahui',
      kelompok: k ? k.kelompok : 'UMUM'
    }
  })
}

// ======================================================================
// FUNGSI BARU: AUTO-SAVE DRAFT PENJURUSAN
// ======================================================================
export async function setDraftPenjurusan(siswa_id: string, minat_jurusan: string | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('siswa').update({ minat_jurusan }).eq('id', siswa_id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/plotting')
  return { success: true }
}

export async function setDraftPenjurusanMassal(payload: {id: string, minat_jurusan: string}[]) {
  const supabase = await createClient()
  const updatePromises = payload.map(p => supabase.from('siswa').update({ minat_jurusan: p.minat_jurusan }).eq('id', p.id))
  await Promise.all(updatePromises)
  revalidatePath('/dashboard/plotting')
  return { success: true }
}

// 5. Eksekusi Simpan Plotting Massal & Catat Riwayat
export async function simpanPlottingMassal(hasilPlotting: { siswa_id: string, kelas_id: string }[]) {
  const supabase = await createClient()
  const ta = await getTahunAjaranAktif()
  
  if (!ta) return { error: 'Gagal mendapatkan Tahun Ajaran Aktif.' }

  try {
    // Update kelas & BERSIHKAN tiket yang sudah dipakai agar kosong untuk tahun depan
    const updatePromises = hasilPlotting.map(plot => 
      supabase.from('siswa').update({ 
        kelas_id: plot.kelas_id, 
        minat_jurusan: null, 
        updated_at: new Date().toISOString() 
      }).eq('id', plot.siswa_id)
    )
    await Promise.all(updatePromises)

    const riwayatData = hasilPlotting.map(plot => ({
      siswa_id: plot.siswa_id, kelas_id: plot.kelas_id, tahun_ajaran_id: ta.id
    }))
    
    await supabase.from('riwayat_kelas').upsert(riwayatData, { onConflict: 'siswa_id, tahun_ajaran_id', ignoreDuplicates: true })

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
    
    return { success: `Berhasil memploting ${hasilPlotting.length} siswa secara permanen!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat menyimpan plotting.' }
  }
}

// 6. Proses Kelulusan Massal Kelas 12
export async function prosesKelulusanMassal(siswaIds: string[]) {
  const supabase = await createClient()
  if (!siswaIds || siswaIds.length === 0) return { error: 'Tidak ada siswa yang dipilih.' }

  try {
    const { error } = await supabase.from('siswa').update({ status: 'lulus', kelas_id: null, updated_at: new Date().toISOString() }).in('id', siswaIds)
    if (error) throw error

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
    return { success: `Berhasil meluluskan ${siswaIds.length} siswa kelas 12!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat memproses kelulusan.' }
  }
}