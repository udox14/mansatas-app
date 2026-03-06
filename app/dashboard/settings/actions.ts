// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/settings/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function tambahTahunAjaran(prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  // Tangkap data array jurusan dari hidden input modal
  const rawJurusan = formData.get('daftar_jurusan') as string
  let daftar_jurusan = ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
  
  if (rawJurusan) {
    try {
      daftar_jurusan = JSON.parse(rawJurusan)
    } catch (e) {
      console.error("Gagal parse daftar jurusan")
    }
  }

  // Pastikan UMUM selalu ada
  if (!daftar_jurusan.includes('UMUM')) {
    daftar_jurusan.push('UMUM')
  }

  const payload = {
    nama: formData.get('nama') as string,
    semester: parseInt(formData.get('semester') as string),
    is_active: false,
    daftar_jurusan: daftar_jurusan 
  }
  
  const { error } = await supabase.from('tahun_ajaran').insert(payload)
  if (error) return { error: error.message, success: null }
  
  revalidatePath('/dashboard/settings')
  return { error: null, success: 'Tahun Ajaran & Daftar Jurusan berhasil ditambahkan' }
}

export async function setAktifTahunAjaran(id: string) {
  const supabase = await createClient()
  await supabase.from('tahun_ajaran').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
  const { error } = await supabase.from('tahun_ajaran').update({ is_active: true }).eq('id', id)
  
  if (error) return { error: error.message }
  revalidatePath('/', 'layout') 
  return { success: 'Tahun Ajaran berhasil diaktifkan!' }
}

export async function hapusTahunAjaran(id: string, isActive: boolean) {
  if (isActive) return { error: 'Tidak bisa menghapus Tahun Ajaran yang sedang aktif. Aktifkan tahun ajaran lain terlebih dahulu.' }

  const supabase = await createClient()
  const { error } = await supabase.from('tahun_ajaran').delete().eq('id', id)
  
  if (error) return { error: 'Gagal menghapus: ' + error.message }
  
  revalidatePath('/dashboard/settings')
  return { success: 'Tahun Ajaran berhasil dihapus.' }
}

export async function simpanDaftarJurusan(tahun_ajaran_id: string, daftar_jurusan: string[]) {
  const supabase = await createClient()
  
  if (!daftar_jurusan.includes('UMUM')) {
    daftar_jurusan.push('UMUM')
  }

  const { error } = await supabase.from('tahun_ajaran').update({ daftar_jurusan }).eq('id', tahun_ajaran_id)
  
  if (error) return { error: error.message }
  
  revalidatePath('/', 'layout') 
  return { success: 'Daftar Master Jurusan berhasil diperbarui!' }
}