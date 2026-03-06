// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// 1. MANAJEMEN KELAS UTAMA (CRUD)
// ============================================================================
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
  if (error) return { error: error.message, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil diperbarui!' }
}

export async function hapusKelas(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('kelas').delete().eq('id', id)
  if (error) return { error: error.message, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil dihapus!' }
}

export async function importKelasMassal(dataExcel: any[]) {
  const supabase = await createClient()

  // Ambil data guru untuk pencocokan nama wali kelas
  const { data: dbGuru } = await supabase.from('profiles').select('id, nama_lengkap').neq('role', 'wali_murid')
  const mapGuru = new Map()
  dbGuru?.forEach(g => mapGuru.set(g.nama_lengkap.toLowerCase().trim(), g.id))

  let toInsert = []
  for (const row of dataExcel) {
    const tingkat = parseInt(row.TINGKAT)
    const kelompok = String(row.KELOMPOK || 'UMUM').trim()
    const nomor_kelas = String(row.NOMOR_KELAS || '').trim()
    const kapasitas = parseInt(row.KAPASITAS) || 36
    const namaGuru = String(row.WALI_KELAS || '').trim().toLowerCase()

    if (!tingkat || !nomor_kelas) continue

    let wali_kelas_id = null
    if (namaGuru && mapGuru.has(namaGuru)) {
      wali_kelas_id = mapGuru.get(namaGuru)
    }

    toInsert.push({ tingkat, kelompok, nomor_kelas, kapasitas, wali_kelas_id })
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('kelas').insert(toInsert)
    if (error) return { error: error.message, success: null }
  }

  revalidatePath('/dashboard/kelas')
  return { error: null, success: `Berhasil mengimport ${toInsert.length} kelas.` }
}

// ============================================================================
// 2. INLINE EDIT & BATCH SAVE
// ============================================================================
export async function editKelasForm(prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  const id = formData.get('id') as string
  const payload = {
    tingkat: parseInt(formData.get('tingkat') as string),
    kelompok: formData.get('kelompok') as string,
    nomor_kelas: formData.get('nomor_kelas') as string,
    wali_kelas_id: formData.get('wali_kelas_id') as string,
    kapasitas: parseInt(formData.get('kapasitas') as string) || 36,
  }

  if (payload.wali_kelas_id === 'none') {
    payload.wali_kelas_id = null as any
  }

  const { error } = await supabase.from('kelas').update(payload).eq('id', id)
  if (error) return { error: error.message, success: null }

  revalidatePath('/dashboard/kelas')
  revalidatePath(`/dashboard/kelas/${id}`)
  return { error: null, success: 'Data Rombongan Belajar berhasil diperbarui!' }
}

export async function setWaliKelas(kelasId: string, guruId: string | null) {
  const supabase = await createClient()
  const val = guruId === 'none' ? null : guruId
  const { error } = await supabase.from('kelas').update({ wali_kelas_id: val }).eq('id', kelasId)
  if (error) return { error: error.message, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Wali kelas berhasil ditugaskan!' }
}

export async function batchUpdateKelas(updates: { id: string, kelompok?: string, wali_kelas_id?: string | null }[]) {
  const supabase = await createClient()
  
  try {
    const updatePromises = updates.map(update => {
      const payload: any = {}
      if (update.kelompok !== undefined) payload.kelompok = update.kelompok
      if (update.wali_kelas_id !== undefined) payload.wali_kelas_id = update.wali_kelas_id === 'none' ? null : update.wali_kelas_id
      
      return supabase.from('kelas').update(payload).eq('id', update.id)
    })

    await Promise.all(updatePromises)
    
    revalidatePath('/dashboard/kelas')
    return { error: null, success: `Berhasil menyimpan perubahan pada ${updates.length} kelas!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat menyimpan massal.', success: null }
  }
}

// ============================================================================
// 3. MANAJEMEN DETAIL KELAS (MUTASI & TAMBAH SISWA) -> FUNGSI YANG HILANG
// ============================================================================
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

export async function assignSiswaKeKelas(siswaId: string, kelasId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('siswa')
    .update({ kelas_id: kelasId })
    .eq('id', siswaId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/kelas/${kelasId}`)
  revalidatePath('/dashboard/kelas')
  return { success: 'Berhasil memasukkan siswa ke kelas!' }
}

export async function getKelasTujuanMutasi(tingkat: number, currentKelasId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('kelas')
    .select('id, tingkat, nomor_kelas, kelompok, kapasitas, siswa(count)')
    .eq('tingkat', tingkat)
    .neq('id', currentKelasId)
    .order('kelompok', { ascending: true })
    .order('nomor_kelas', { ascending: true })

  if (error) return []
  return data.map(k => ({
    id: k.id,
    nama: `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim(),
    kapasitas: k.kapasitas,
    jumlah_siswa: k.siswa && k.siswa.length > 0 ? (k.siswa[0] as any).count : 0
  }))
}

export async function getSiswaUntukBarter(kelasId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('siswa')
    .select('id, nama_lengkap, nisn')
    .eq('kelas_id', kelasId)
    .eq('status', 'aktif')
    .order('nama_lengkap', { ascending: true })

  if (error) return []
  return data || []
}

export async function prosesMutasi(payload: {siswaIdLama: string, kelasIdLama: string, kelasIdTujuan: string, siswaIdBarter: string | null}) {
  const supabase = await createClient()
  
  try {
    if (payload.siswaIdBarter) {
      // Barter Siswa (Atomic Swap menggunakan PostgreSQL RPC)
      const { data, error } = await supabase.rpc('swap_siswa_kelas', {
        p_siswa1_id: payload.siswaIdLama,
        p_kelas1_id: payload.kelasIdLama,
        p_siswa2_id: payload.siswaIdBarter,
        p_kelas2_id: payload.kelasIdTujuan
      })
      if (error) throw error
      if (!data) throw new Error('Gagal mengeksekusi barter siswa.')
    } else {
      // Pindah kelas 1 arah
      const { error } = await supabase
        .from('siswa')
        .update({ kelas_id: payload.kelasIdTujuan })
        .eq('id', payload.siswaIdLama)
      if (error) throw error
    }

    revalidatePath(`/dashboard/kelas/${payload.kelasIdLama}`)
    revalidatePath(`/dashboard/kelas/${payload.kelasIdTujuan}`)
    revalidatePath('/dashboard/kelas')
    
    return { success: 'Proses mutasi siswa berhasil!' }
  } catch (err: any) {
    return { error: err.message || 'Terjadi kesalahan sistem saat mutasi.' }
  }
}