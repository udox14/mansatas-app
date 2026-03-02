'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. Fungsi Ambil Data Siswa per Kelas ---
export async function getSiswaByKelas(kelas_id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('siswa')
    .select('id, nama_lengkap, nisn')
    .eq('kelas_id', kelas_id)
    .eq('status', 'Aktif')
    .order('nama_lengkap', { ascending: true })

  if (error) return { error: error.message, data: null }
  return { error: null, data }
}

// --- 2. Fungsi REKAP BULANAN (Untuk Admin/TU) ---
export async function getRekapBulanan(kelas_id: string, bulan: number, ta_id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rekap_kehadiran_bulanan')
    .select('*')
    .eq('kelas_id', kelas_id)
    .eq('bulan', bulan)
    .eq('tahun_ajaran_id', ta_id)

  if (error) return { error: error.message, data: null }
  return { error: null, data }
}

export async function simpanRekapBulanan(kelas_id: string, bulan: number, ta_id: string, rekapData: any[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Siapkan data untuk di-upsert
  const payload = rekapData.map(item => ({
    siswa_id: item.siswa_id,
    kelas_id,
    tahun_ajaran_id: ta_id,
    bulan,
    sakit: item.sakit || 0,
    izin: item.izin || 0,
    alpa: item.alpa || 0,
    diinput_oleh: user.id,
    updated_at: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('rekap_kehadiran_bulanan')
    .upsert(payload, { onConflict: 'siswa_id, bulan, tahun_ajaran_id' })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/kehadiran')
  return { success: 'Rekap kehadiran bulanan berhasil disimpan!' }
}

// --- 3. Fungsi JURNAL HARIAN GURU (Sparse Data) ---
export async function simpanJurnalHarian(penugasan_id: string, tanggal: string, jurnalData: any[]) {
  const supabase = createClient()
  
  // Karena sparse data, kita HANYA menyimpan yang statusnya BUKAN 'Hadir/Aman' ATAU yang punya catatan
  const payloadToInsert = jurnalData
    .filter(item => item.status !== 'Aman' || (item.catatan && item.catatan.trim() !== ''))
    .map(item => ({
      penugasan_id,
      siswa_id: item.siswa_id,
      tanggal,
      status_kehadiran: item.status === 'Aman' ? null : item.status,
      catatan: item.catatan || null
    }))

  // 1. Hapus dulu jurnal hari ini untuk penugasan tersebut (agar bersih jika ada perubahan)
  await supabase
    .from('jurnal_guru_harian')
    .delete()
    .eq('penugasan_id', penugasan_id)
    .eq('tanggal', tanggal)

  // 2. Insert data baru (jika ada yang bermasalah)
  if (payloadToInsert.length > 0) {
    const { error } = await supabase.from('jurnal_guru_harian').insert(payloadToInsert)
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/kehadiran')
  return { success: 'Jurnal kelas berhasil disimpan! Siswa lainnya otomatis tercatat Hadir/Aman.' }
}