'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. Tambah Kelas Manual ---
export async function tambahKelas(prevState: any, formData: FormData) {
  const supabase = createClient()
  
  const tingkat = parseInt(formData.get('tingkat') as string)
  const kelompok = formData.get('kelompok') as string
  const nomor_kelas = formData.get('nomor_kelas') as string
  const wali_kelas_id = formData.get('wali_kelas_id') as string
  const kapasitas = parseInt(formData.get('kapasitas') as string) || 36

  if (!tingkat || !kelompok || !nomor_kelas) return { error: 'Data wajib diisi.', success: null }

  const payload: any = { tingkat, kelompok, nomor_kelas, kapasitas }
  if (wali_kelas_id && wali_kelas_id !== 'none') payload.wali_kelas_id = wali_kelas_id

  const { error } = await supabase.from('kelas').insert(payload)
  if (error) return { error: error.message, success: null }

  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil ditambahkan' }
}

// --- 2. Hapus Kelas ---
export async function hapusKelas(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('kelas').delete().eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/kelas')
  return { success: 'Kelas berhasil dihapus' }
}

// --- 3. Import Kelas Massal ---
export async function importKelasMassal(dataKelas: any[]) {
  const supabase = createClient()
  
  // PERBAIKAN: Kita HAPUS blok getUser() manual di sini.
  // Database Supabase sudah dilindungi oleh RLS, jadi kalau user tidak berhak,
  // proses upsert di bawah akan otomatis ditolak oleh database.

  const sanitizedData = dataKelas.map(item => ({
    tingkat: parseInt(item.TINGKAT),
    kelompok: String(item.KELOMPOK || 'UMUM').toUpperCase().trim(),
    nomor_kelas: String(item.NOMOR_KELAS || '').trim(),
    kapasitas: parseInt(item.KAPASITAS) || 36
  })).filter(item => item.tingkat && item.nomor_kelas && [10, 11, 12].includes(item.tingkat))

  if (sanitizedData.length === 0) return { error: 'Tidak ada data valid.' }

  const { error } = await supabase.from('kelas').upsert(sanitizedData, { onConflict: 'id', ignoreDuplicates: true })
  
  if (error) return { error: error.message }

  revalidatePath('/dashboard/kelas')
  return { success: `Berhasil mengimport ${sanitizedData.length} data kelas.` }
}