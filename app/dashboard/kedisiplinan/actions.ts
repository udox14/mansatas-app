// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kedisiplinan/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// ==========================================
// 1. ACTIONS UNTUK TRANSAKSI PELANGGARAN
// ==========================================
export async function simpanPelanggaran(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Anda belum login', success: null }

  const { data: ta } = await supabase.from('tahun_ajaran').select('id').eq('is_active', true).single()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur sistem.', success: null }

  const id = formData.get('id') as string | null
  const siswa_id = formData.get('siswa_id') as string
  const master_pelanggaran_id = formData.get('master_pelanggaran_id') as string
  const tanggal = formData.get('tanggal') as string
  const keterangan = formData.get('keterangan') as string
  
  if (!siswa_id || !master_pelanggaran_id) return { error: 'Siswa dan Jenis Pelanggaran wajib dipilih dari daftar pencarian.', success: null }

  const file = formData.get('foto') as File | null
  let foto_url = formData.get('existing_foto_url') as string | null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()
    const fileName = `bukti_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
    
    const { error: uploadError } = await supabase.storage.from('pelanggaran').upload(fileName, file)
    if (uploadError) return { error: 'Gagal mengunggah foto bukti: ' + uploadError.message, success: null }
    
    const { data: publicUrl } = supabase.storage.from('pelanggaran').getPublicUrl(fileName)
    foto_url = publicUrl.publicUrl
  }

  const payload = {
    siswa_id,
    master_pelanggaran_id,
    tanggal,
    keterangan,
    foto_url,
    tahun_ajaran_id: ta.id,
    diinput_oleh: user.id,
    updated_at: new Date().toISOString()
  }

  if (id) {
    const { error } = await supabase.from('siswa_pelanggaran').update(payload).eq('id', id)
    if (error) return { error: 'Gagal mengedit: ' + error.message, success: null }
  } else {
    const { error } = await supabase.from('siswa_pelanggaran').insert(payload)
    if (error) return { error: 'Gagal merekam data: ' + error.message, success: null }
  }

  revalidatePath('/dashboard/kedisiplinan')
  return { error: null, success: 'Data pelanggaran berhasil disimpan!' }
}

export async function hapusPelanggaran(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('siswa_pelanggaran').delete().eq('id', id)
  if (error) return { error: 'Akses ditolak atau gagal menghapus: ' + error.message }
  revalidatePath('/dashboard/kedisiplinan')
  return { success: 'Catatan pelanggaran berhasil dihapus permanen.' }
}

// ==========================================
// 2. ACTIONS UNTUK MASTER PELANGGARAN
// ==========================================
export async function simpanMasterPelanggaran(prevState: any, formData: FormData) {
  const supabase = await createClient()
  
  const id = formData.get('id') as string | null
  const kategori = formData.get('kategori') as string
  const nama_pelanggaran = formData.get('nama_pelanggaran') as string
  const poin = parseInt(formData.get('poin') as string)

  if (!kategori || !nama_pelanggaran || isNaN(poin)) return { error: 'Semua field wajib diisi dengan benar.', success: null }

  const payload = { kategori, nama_pelanggaran, poin }

  if (id) {
    const { error } = await supabase.from('master_pelanggaran').update(payload).eq('id', id)
    if (error) return { error: 'Gagal mengupdate master: ' + error.message, success: null }
  } else {
    const { error } = await supabase.from('master_pelanggaran').insert(payload)
    if (error) return { error: 'Gagal menambah master: ' + error.message, success: null }
  }

  revalidatePath('/dashboard/kedisiplinan')
  return { error: null, success: 'Master pelanggaran berhasil disimpan.' }
}

export async function hapusMasterPelanggaran(id: string) {
  const supabase = await createClient()
  
  // Cek apakah master ini sedang dipakai di tabel transaksi
  const { data: kasuses } = await supabase.from('siswa_pelanggaran').select('id').eq('master_pelanggaran_id', id).limit(1)
  if (kasuses && kasuses.length > 0) {
    return { error: 'Tidak bisa menghapus: Jenis pelanggaran ini sudah memiliki riwayat pada data siswa. Silakan edit saja namanya.' }
  }

  const { error } = await supabase.from('master_pelanggaran').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus: ' + error.message }
  
  revalidatePath('/dashboard/kedisiplinan')
  return { success: 'Master pelanggaran berhasil dihapus.' }
}

// FUNGSI BARU: IMPORT MASSAL MASTER PELANGGARAN DARI EXCEL
export async function importMasterPelanggaranMassal(dataExcel: any[]) {
  const supabase = await createClient()

  // Membersihkan dan memvalidasi data Excel
  const sanitizedData = dataExcel.map(item => ({
    nama_pelanggaran: String(item.NAMA_PELANGGARAN || '').trim(),
    kategori: String(item.KATEGORI || 'Ringan').trim(),
    poin: parseInt(item.POIN) || 0
  })).filter(item => item.nama_pelanggaran && item.poin > 0)

  if (sanitizedData.length === 0) return { error: 'Tidak ada data valid yang bisa diimport. Pastikan kolom sesuai format.' }

  const { error } = await supabase.from('master_pelanggaran').insert(sanitizedData)
  
  if (error) return { error: 'Gagal mengimport data: ' + error.message }

  revalidatePath('/dashboard/kedisiplinan')
  return { success: `Berhasil menambahkan ${sanitizedData.length} jenis pelanggaran ke dalam Kamus.` }
}