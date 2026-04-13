'use server'

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

// ============================================================
// TYPES
// ============================================================
export type SarprasKategori = {
  id: string
  nama: string
  created_at: string
}

export type SarprasAset = {
  id: string
  tanggal_pembukuan: string
  kategori_id: string
  nama_barang: string
  merek: string | null
  kuantitas: number
  tahun_pembuatan: string | null
  asal_anggaran: string | null
  keadaan_barang: string | null
  harga: number | null
  foto_url: string | null
  keterangan: string | null
  diinput_oleh: string | null
  created_at: string
  updated_at: string
  
  // Joined fields
  kategori_nama?: string
}

// ============================================================
// KATEGORI ACTIONS
// ============================================================

export async function getKategoriList() {
  const db = await getDB()
  const result = await db.prepare('SELECT * FROM sarpras_kategori ORDER BY nama ASC').all<SarprasKategori>()
  return { data: result.results || [], error: null }
}

export async function saveKategori(id: string | null, nama: string) {
  const db = await getDB()
  try {
    if (id) {
      await db.prepare('UPDATE sarpras_kategori SET nama = ? WHERE id = ?').bind(nama, id).run()
    } else {
      await db.prepare('INSERT INTO sarpras_kategori (nama) VALUES (?)').bind(nama).run()
    }
    revalidatePath('/dashboard/sarpras')
    return { success: true, error: null }
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint')) {
      return { success: false, error: 'Kategori dengan nama ini sudah ada' }
    }
    return { success: false, error: e.message }
  }
}

export async function deleteKategori(id: string) {
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM sarpras_kategori WHERE id = ?').bind(id).run()
    revalidatePath('/dashboard/sarpras')
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: 'Gagal menghapus kategori. Pastikan tidak ada barang yang terkait dengan kategori ini.' }
  }
}

// ============================================================
// ASET ACTIONS
// ============================================================

export async function getAsetList(filters?: { kategoriId?: string, keadaan?: string, start_date?: string, end_date?: string }) {
  const db = await getDB()
  
  let baseQuery = `
    SELECT a.*, k.nama as kategori_nama 
    FROM sarpras_aset a
    LEFT JOIN sarpras_kategori k ON a.kategori_id = k.id
    WHERE 1=1
  `
  const params: any[] = []

  if (filters?.kategoriId) {
    baseQuery += ` AND a.kategori_id = ?`
    params.push(filters.kategoriId)
  }
  if (filters?.keadaan) {
    baseQuery += ` AND a.keadaan_barang = ?`
    params.push(filters.keadaan)
  }
  if (filters?.start_date && filters?.end_date) {
    baseQuery += ` AND a.tanggal_pembukuan BETWEEN ? AND ?`
    params.push(filters.start_date, filters.end_date)
  }

  baseQuery += ` ORDER BY a.created_at DESC`

  const result = await db.prepare(baseQuery).bind(...params).all<SarprasAset>()
  return { data: result.results || [], error: null }
}

export async function saveAset(data: Partial<SarprasAset>) {
  const db = await getDB()
  try {
    const userId = data.diinput_oleh || null // Biasanya di supply dari frontend jika perlu diset, karena kita mock getUser server side tidak full jika auth di client. Di sistem ini biasanya dikirim dari client atau diambil dari session
    
    // Convert undefined to null for DB binding
    const fields = [
      data.tanggal_pembukuan,
      data.kategori_id,
      data.nama_barang,
      data.merek || null,
      data.kuantitas || 1,
      data.tahun_pembuatan || null,
      data.asal_anggaran || null,
      data.keadaan_barang || null,
      data.harga || null,
      data.foto_url || null,
      data.keterangan || null,
      userId
    ]

    if (data.id) {
      await db.prepare(`
        UPDATE sarpras_aset 
        SET tanggal_pembukuan = ?, kategori_id = ?, nama_barang = ?, merek = ?, kuantitas = ?, tahun_pembuatan = ?, asal_anggaran = ?, keadaan_barang = ?, harga = ?, foto_url = ?, keterangan = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        data.tanggal_pembukuan, data.kategori_id, data.nama_barang, data.merek || null, data.kuantitas || 1, 
        data.tahun_pembuatan || null, data.asal_anggaran || null, data.keadaan_barang || null, 
        data.harga || null, data.foto_url || null, data.keterangan || null, data.id
      ).run()
    } else {
      await db.prepare(`
        INSERT INTO sarpras_aset (tanggal_pembukuan, kategori_id, nama_barang, merek, kuantitas, tahun_pembuatan, asal_anggaran, keadaan_barang, harga, foto_url, keterangan, diinput_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(...fields).run()
    }
    
    revalidatePath('/dashboard/sarpras')
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function deleteAset(id: string) {
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM sarpras_aset WHERE id = ?').bind(id).run()
    revalidatePath('/dashboard/sarpras')
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ============================================================
// OPTIONS & SUGGESTIONS
// ============================================================

export async function getSarprasOptions() {
  const db = await getDB()
  const rows = await db.prepare(`
    SELECT DISTINCT merek, asal_anggaran, keadaan_barang, keterangan FROM sarpras_aset
  `).all<{ merek: string | null, asal_anggaran: string | null, keadaan_barang: string | null, keterangan: string | null }>()

  const merek = new Set<string>()
  const asal_anggaran = new Set<string>(['ANGGARAN', 'HIBAH'])
  const keadaan_barang = new Set<string>(['BAIK', 'KURANG BAIK', 'RUSAK'])
  const keterangan = new Set<string>(['BERFUNGSI', 'TIDAK BERFUNGSI'])

  rows.results?.forEach(r => {
    if (r.merek) merek.add(r.merek)
    if (r.asal_anggaran) asal_anggaran.add(r.asal_anggaran)
    if (r.keadaan_barang) keadaan_barang.add(r.keadaan_barang)
    if (r.keterangan) keterangan.add(r.keterangan)
  })

  return {
    merek: Array.from(merek).filter(Boolean).sort(),
    asal_anggaran: Array.from(asal_anggaran).filter(Boolean).sort(),
    keadaan_barang: Array.from(keadaan_barang).filter(Boolean).sort(),
    keterangan: Array.from(keterangan).filter(Boolean).sort(),
  }
}

// ============================================================
// UPLOAD FOTO ASET
// ============================================================
import { uploadFotoSarpras } from '@/utils/r2'

export async function uploadFotoAsetAction(formData: FormData) {
  const file = formData.get('foto') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file.' }

  const { url, error: uploadError } = await uploadFotoSarpras(file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }

  return { success: 'Foto berhasil diupload!', url }
}
