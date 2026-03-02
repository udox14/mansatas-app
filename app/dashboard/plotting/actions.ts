'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Tahun Ajaran Aktif (Otomatis buat jika belum ada agar sistem tidak error)
export async function getTahunAjaranAktif() {
  const supabase = createClient()
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

// 2. Ambil Siswa yang BELUM punya kelas (Untuk Tab 1)
export async function getSiswaBelumAdaKelas() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('siswa')
    .select('id, nisn, nama_lengkap, jenis_kelamin')
    .is('kelas_id', null)
    .eq('status', 'aktif')
    .order('nama_lengkap')
  
  if (error) return []
  return data
}

// 3. Ambil daftar kelas berdasarkan Tingkat (10, 11, atau 12)
export async function getKelasByTingkat(tingkat: number) {
  const supabase = createClient()
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

// 4. Ambil Siswa yang SEDANG berada di tingkat tertentu (Untuk Tab 2 & 3)
export async function getSiswaByTingkat(tingkat: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('siswa')
    .select(`
      id, nisn, nama_lengkap, jenis_kelamin, kelas_id,
      kelas!inner(id, tingkat, kelompok, nomor_kelas)
    `)
    .eq('kelas.tingkat', tingkat)
    .eq('status', 'aktif')
    .order('nama_lengkap')
  
  if (error) return []

  // Format data agar mudah dibaca oleh Client Component
  return data.map(s => {
    const k = s.kelas as any
    return {
      id: s.id,
      nisn: s.nisn,
      nama_lengkap: s.nama_lengkap,
      jenis_kelamin: s.jenis_kelamin,
      kelas_lama: k ? `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim() : 'Tidak diketahui',
      kelompok: k ? k.kelompok : 'UMUM'
    }
  })
}

// 5. Eksekusi Simpan Plotting Massal & Catat Riwayat
export async function simpanPlottingMassal(hasilPlotting: { siswa_id: string, kelas_id: string }[]) {
  const supabase = createClient()
  const ta = await getTahunAjaranAktif()
  
  if (!ta) return { error: 'Gagal mendapatkan Tahun Ajaran Aktif.' }

  try {
    // A. Update kelas_id di tabel siswa
    const updatePromises = hasilPlotting.map(plot => 
      supabase.from('siswa').update({ kelas_id: plot.kelas_id, updated_at: new Date().toISOString() }).eq('id', plot.siswa_id)
    )
    await Promise.all(updatePromises)

    // B. Insert massal ke tabel riwayat_kelas
    const riwayatData = hasilPlotting.map(plot => ({
      siswa_id: plot.siswa_id,
      kelas_id: plot.kelas_id,
      tahun_ajaran_id: ta.id
    }))
    
    // ON CONFLICT DO NOTHING agar aman dari double insertion di tahun ajaran yang sama
    const { error: riwayatError } = await supabase.from('riwayat_kelas').upsert(riwayatData, { onConflict: 'siswa_id, tahun_ajaran_id', ignoreDuplicates: true })
    if (riwayatError) console.error("Error Riwayat:", riwayatError)

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
    
    return { success: `Berhasil memploting ${hasilPlotting.length} siswa secara permanen!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat menyimpan plotting.' }
  }
}

// 6. ACTION BARU: Proses Kelulusan Massal Kelas 12
export async function prosesKelulusanMassal(siswaIds: string[]) {
  const supabase = createClient()
  
  if (!siswaIds || siswaIds.length === 0) {
    return { error: 'Tidak ada siswa yang dipilih.' }
  }

  try {
    // Update status menjadi 'lulus' dan lepaskan mereka dari kelas (agar wadah kosong)
    const { error } = await supabase
      .from('siswa')
      .update({ 
        status: 'lulus', 
        kelas_id: null,
        updated_at: new Date().toISOString()
      })
      .in('id', siswaIds)

    if (error) throw error

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
    
    return { success: `Berhasil meluluskan ${siswaIds.length} siswa kelas 12!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat memproses kelulusan.' }
  }
}