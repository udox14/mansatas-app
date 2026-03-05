// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- 1. Manajemen Kelas (CRUD) ---
export async function tambahKelas(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const payload = {
    tingkat: parseInt(formData.get('tingkat') as string),
    kelompok: formData.get('kelompok') as string,
    nomor_kelas: formData.get('nomor_kelas') as string,
    wali_kelas_id: formData.get('wali_kelas_id') as string || null,
    kapasitas: parseInt(formData.get('kapasitas') as string) || 36,
  }

  const { error } = await supabase.from('kelas').insert(payload)
  if (error) return { error: error.message, success: null }

  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil ditambahkan!' }
}

export async function editKelas(id: string, payload: any) {
  const supabase = await createClient()
  const { error } = await supabase.from('kelas').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/kelas')
  return { success: 'Kelas berhasil diperbarui!' }
}

// FUNGSI BARU: Set Wali Kelas Langsung dari Dropdown
export async function setWaliKelas(kelasId: string, guruId: string | null) {
  const supabase = await createClient()
  
  // Jika string "none" yang dikirim, ubah jadi null di database
  const targetId = guruId === 'none' ? null : guruId

  const { error } = await supabase.from('kelas').update({ wali_kelas_id: targetId }).eq('id', kelasId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/kelas')
  return { success: 'Wali Kelas berhasil diupdate!' }
}

export async function hapusKelas(id: string) {
  const supabase = await createClient()
  
  // Cek dulu apakah kelas masih ada siswanya
  const { count } = await supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('kelas_id', id)
  if (count && count > 0) return { error: `Tidak bisa dihapus! Masih ada ${count} siswa di dalam kelas ini.` }

  const { error } = await supabase.from('kelas').delete().eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/kelas')
  return { success: 'Kelas berhasil dihapus!' }
}

// --- 2. Fitur Memasukkan & Mengeluarkan Siswa ---
export async function getSiswaTanpaKelas() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('siswa')
    .select('id, nama_lengkap, nisn')
    .is('kelas_id', null)
    .eq('status', 'aktif')
    .order('nama_lengkap', { ascending: true })

  if (error) return []
  return data || []
}

export async function assignSiswaKeKelas(kelas_id: string, siswa_ids: string | string[]) {
  const supabase = await createClient()
  const ids = Array.isArray(siswa_ids) ? siswa_ids : [siswa_ids]
  if (!ids || ids.length === 0) return { error: 'Pilih minimal 1 siswa terlebih dahulu!' }

  const { error } = await supabase.from('siswa').update({ kelas_id }).in('id', ids)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/kelas/${kelas_id}`)
  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/siswa')
  return { success: `${ids.length} siswa berhasil dimasukkan ke kelas!` }
}

export async function keluarkanSiswa(siswa_id: string, kelas_id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('siswa').update({ kelas_id: null }).eq('id', siswa_id)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/kelas/${kelas_id}`)
  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/siswa')
  return { success: 'Siswa berhasil dikeluarkan dari kelas.' }
}

// --- 3. Fitur Import Massal Kelas ---
export async function importKelasMassal(dataExcel: any[]) {
  const supabase = await createClient()
  let toInsert = []
  
  // Ambil database guru untuk pencocokan nama wali kelas
  const { data: dbGuru } = await supabase.from('profiles').select('id, nama_lengkap').in('role', ['guru', 'guru_bk'])
  const mapGuru = new Map()
  if (dbGuru) {
    dbGuru.forEach(g => mapGuru.set(g.nama_lengkap.toLowerCase().trim(), g.id))
  }

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    if (!row.TINGKAT || !row.KELOMPOK || !row.NOMOR_KELAS) continue
    
    // Coba cocokkan nama wali kelas jika ada
    let wali_kelas_id = null
    const namaWali = String(row.WALI_KELAS || '').trim()
    if (namaWali) {
      wali_kelas_id = mapGuru.get(namaWali.toLowerCase()) || null
    }

    toInsert.push({
      tingkat: parseInt(row.TINGKAT),
      kelompok: String(row.KELOMPOK).toUpperCase(),
      nomor_kelas: String(row.NOMOR_KELAS),
      kapasitas: parseInt(row.KAPASITAS) || 36,
      wali_kelas_id: wali_kelas_id // Otomatis terisi jika nama cocok
    })
  }

  if (toInsert.length === 0) return { error: 'Tidak ada data valid yang bisa diimport.' }

  const { error } = await supabase.from('kelas').insert(toInsert)
  if (error) return { error: 'Gagal mengimport: ' + error.message }

  revalidatePath('/dashboard/kelas')
  return { success: `Berhasil mengimport ${toInsert.length} data kelas baru.` }
}

// --- 4. Fitur Mutasi & Barter ---
export async function getKelasTujuanMutasi(tingkat: number, currentKelasId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('kelas').select('id, tingkat, kelompok, nomor_kelas, kapasitas, siswa(count)').eq('tingkat', tingkat).neq('id', currentKelasId).order('kelompok').order('nomor_kelas')
  if (error) return []
  return data.map(k => ({
    id: k.id, nama: `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim(), kapasitas: k.kapasitas || 36, jumlah_siswa: k.siswa && k.siswa.length > 0 ? (k.siswa[0] as any).count : 0
  }))
}

export async function getSiswaUntukBarter(kelasId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('siswa').select('id, nama_lengkap, nisn').eq('kelas_id', kelasId).eq('status', 'aktif').order('nama_lengkap')
  if (error) return []
  return data
}

export async function prosesMutasi(payload: { siswaIdLama: string, kelasIdLama: string, kelasIdTujuan: string, siswaIdBarter: string | null }) {
  const supabase = await createClient()
  try {
    if (payload.siswaIdBarter) {
      const { data, error } = await supabase.rpc('swap_siswa_kelas', {
        p_siswa1_id: payload.siswaIdLama, p_kelas1_id: payload.kelasIdLama, p_siswa2_id: payload.siswaIdBarter, p_kelas2_id: payload.kelasIdTujuan
      })
      if (error || !data) throw new Error('Gagal melakukan barter siswa di database.')
    } else {
      const { error } = await supabase.from('siswa').update({ kelas_id: payload.kelasIdTujuan }).eq('id', payload.siswaIdLama)
      if (error) throw error
    }
    revalidatePath('/dashboard/kelas')
    revalidatePath(`/dashboard/kelas/${payload.kelasIdLama}`)
    revalidatePath(`/dashboard/kelas/${payload.kelasIdTujuan}`)
    return { success: 'Proses mutasi/barter berhasil dilakukan!' }
  } catch (err: any) {
    return { error: err.message || 'Terjadi kesalahan sistem saat mutasi.' }
  }
}