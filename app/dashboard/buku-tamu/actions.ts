'use server'

import { getDB, dbInsert } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { revalidatePath } from 'next/cache'
import { nowWIB, todayWIB } from '@/lib/time'

// ============================================================
// TYPES
// ============================================================
export type EntriTamu = {
  id: string
  tanggal: string
  waktu: string
  kategori: 'INDIVIDU' | 'INSTANSI'
  nama: string | null
  instansi: string | null
  maksud_tujuan: string
  foto_url: string | null
  dicatat_oleh: string | null
  pencatat_nama: string | null
  created_at: string
}

export type FilterTamu = {
  tanggal?: string      // YYYY-MM-DD
  bulan?: string        // YYYY-MM
  page?: number
}

// ============================================================
// UPLOAD FOTO KE R2
// ============================================================
async function uploadFotoToR2(
  base64Data: string,
  contentType: string,
  tamuid: string
): Promise<string | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const r2 = env.R2 as R2Bucket
    const r2PublicUrl = env.R2_PUBLIC_URL as string

    // Decode base64 → ArrayBuffer
    const binaryStr = atob(base64Data)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const ext = contentType === 'image/webp' ? 'webp' : 'jpg'
    const key = `buku-tamu/${tamuid}.${ext}`

    await r2.put(key, bytes.buffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
      },
    })

    return `${r2PublicUrl}/${key}`
  } catch (e: any) {
    console.error('[R2 Upload Error]', e.message)
    return null
  }
}

// ============================================================
// 1. SIMPAN ENTRI TAMU (dengan upload foto ke R2)
// ============================================================
export async function simpanEntriTamu(formData: {
  kategori: 'INDIVIDU' | 'INSTANSI'
  nama?: string
  instansi?: string
  maksud_tujuan: string
  foto_base64?: string     // "data:image/jpeg;base64,..."
  foto_content_type?: string
}): Promise<{ error?: string; success?: string; id?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sesi tidak ditemukan. Silakan login ulang.' }

  const { kategori, nama, instansi, maksud_tujuan, foto_base64, foto_content_type } = formData

  // Validasi
  if (!['INDIVIDU', 'INSTANSI'].includes(kategori)) return { error: 'Kategori tidak valid.' }
  if (kategori === 'INDIVIDU' && !nama?.trim()) return { error: 'Nama tamu harus diisi.' }
  if (kategori === 'INSTANSI' && !instansi?.trim()) return { error: 'Nama instansi harus diisi.' }
  if (!maksud_tujuan?.trim()) return { error: 'Maksud dan tujuan harus diisi.' }

  const now = nowWIB()
  const tanggal = todayWIB()
  const waktu = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

  // Generate ID dulu untuk key R2
  const entryId = crypto.randomUUID().replace(/-/g, '')

  // Upload foto ke R2 jika ada
  let foto_url: string | null = null
  if (foto_base64 && foto_content_type) {
    // Strip data URL prefix jika ada
    const rawBase64 = foto_base64.includes(',') ? foto_base64.split(',')[1] : foto_base64
    foto_url = await uploadFotoToR2(rawBase64, foto_content_type, entryId)
  }

  const db = await getDB()
  const res = await dbInsert(db, 'buku_tamu', {
    id: entryId,
    tanggal,
    waktu,
    kategori,
    nama: kategori === 'INDIVIDU' ? nama!.trim() : null,
    instansi: kategori === 'INSTANSI' ? instansi!.trim() : null,
    maksud_tujuan: maksud_tujuan.trim(),
    foto_url,
    dicatat_oleh: user.id,
  })

  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/buku-tamu')
  return { success: 'Data tamu berhasil dicatat.', id: entryId }
}

// ============================================================
// 2. GET DATA TAMU (untuk monitoring admin + riwayat resepsionis)
// ============================================================
export async function getDataTamu(filter: FilterTamu = {}): Promise<{
  data: EntriTamu[]
  total: number
}> {
  const user = await getCurrentUser()
  if (!user) return { data: [], total: 0 }

  const db = await getDB()
  const { tanggal, bulan, page = 1 } = filter
  const limit = 50
  const offset = (page - 1) * limit

  let whereClause = ''
  const params: string[] = []

  if (tanggal) {
    whereClause = 'WHERE bt.tanggal = ?'
    params.push(tanggal)
  } else if (bulan) {
    // bulan format: YYYY-MM
    whereClause = "WHERE strftime('%Y-%m', bt.tanggal) = ?"
    params.push(bulan)
  }

  const [dataRes, countRes] = await Promise.all([
    db.prepare(`
      SELECT bt.id, bt.tanggal, bt.waktu, bt.kategori, bt.nama, bt.instansi,
             bt.maksud_tujuan, bt.foto_url, bt.dicatat_oleh, bt.created_at,
             u.nama_lengkap as pencatat_nama
      FROM buku_tamu bt
      LEFT JOIN "user" u ON bt.dicatat_oleh = u.id
      ${whereClause}
      ORDER BY bt.tanggal DESC, bt.waktu DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<any>(),
    db.prepare(`
      SELECT COUNT(*) as total FROM buku_tamu bt ${whereClause}
    `).bind(...params).first<any>(),
  ])

  return {
    data: dataRes.results || [],
    total: countRes?.total || 0,
  }
}

// ============================================================
// 3. GET TAMU HARI INI (untuk resepsionis — tab riwayat)
// ============================================================
export async function getTamuHariIni(): Promise<EntriTamu[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const db = await getDB()
  const today = todayWIB()

  const { results } = await db.prepare(`
    SELECT bt.id, bt.tanggal, bt.waktu, bt.kategori, bt.nama, bt.instansi,
           bt.maksud_tujuan, bt.foto_url, bt.dicatat_oleh, bt.created_at,
           u.nama_lengkap as pencatat_nama
    FROM buku_tamu bt
    LEFT JOIN "user" u ON bt.dicatat_oleh = u.id
    WHERE bt.tanggal = ?
    ORDER BY bt.waktu DESC
  `).bind(today).all<any>()

  return results || []
}

// ============================================================
// 4. HAPUS ENTRI TAMU (admin only)
// ============================================================
export async function hapusEntriTamu(id: string): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()

  // Hapus foto dari R2 jika ada
  try {
    const entry = await db.prepare('SELECT foto_url FROM buku_tamu WHERE id = ?').bind(id).first<any>()
    if (entry?.foto_url) {
      const { env } = await getCloudflareContext({ async: true })
      const r2 = env.R2 as R2Bucket
      // Ekstrak key dari URL
      const url = new URL(entry.foto_url)
      const key = url.pathname.replace(/^\//, '')
      await r2.delete(key)
    }
  } catch (e) {
    // ignore R2 delete error, tetap hapus dari DB
  }

  await db.prepare('DELETE FROM buku_tamu WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/buku-tamu')
  return { success: 'Data tamu berhasil dihapus.' }
}
