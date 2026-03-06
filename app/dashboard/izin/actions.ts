// BUAT FILE BARU
// Lokasi: app/dashboard/izin/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. IZIN KELUAR KOMPLEK ---
export async function tambahIzinKeluar(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }

  const payload = {
    siswa_id,
    keterangan,
    diinput_oleh: user.id
  }

  const { error } = await supabase.from('izin_keluar_komplek').insert(payload)
  if (error) return { error: error.message, success: null }

  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Berhasil mencatat izin keluar komplek!' }
}

export async function tandaiSudahKembali(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('izin_keluar_komplek')
    .update({ 
      waktu_kembali: new Date().toISOString(),
      status: 'SUDAH KEMBALI' 
    })
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/izin')
  return { success: 'Status siswa diperbarui menjadi SUDAH KEMBALI.' }
}

export async function hapusIzinKeluar(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('izin_keluar_komplek').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/izin')
  return { success: 'Riwayat izin berhasil dihapus.' }
}

// --- 2. IZIN TIDAK MASUK KELAS ---
export async function tambahIzinKelas(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string
  
  // Mengambil semua nilai checkbox yang dicentang
  const jamRaw = formData.getAll('jam_pelajaran')
  const jam_pelajaran = jamRaw.map(j => parseInt(j as string)).sort((a,b) => a - b)

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }
  if (jam_pelajaran.length === 0) return { error: 'Pilih minimal 1 jam pelajaran!', success: null }
  if (!alasan) return { error: 'Alasan wajib dipilih!', success: null }

  const payload = {
    siswa_id,
    jam_pelajaran,
    alasan,
    keterangan,
    diinput_oleh: user.id
  }

  const { error } = await supabase.from('izin_tidak_masuk_kelas').insert(payload)
  if (error) return { error: error.message, success: null }

  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Berhasil mencatat izin tidak masuk kelas!' }
}

export async function hapusIzinKelas(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('izin_tidak_masuk_kelas').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/izin')
  return { success: 'Riwayat izin kelas berhasil dihapus.' }
}