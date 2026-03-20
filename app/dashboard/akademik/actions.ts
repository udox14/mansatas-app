// Lokasi: app/dashboard/akademik/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. MAPEL ACTIONS
// ============================================================
export async function tambahMapel(prevState: any, formData: FormData) {
  const db = await getDB()
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kode_mapel: (formData.get('kode_mapel') as string) || null,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }
  const result = await dbInsert(db, 'mata_pelajaran', payload)
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil ditambahkan' }
}

export async function editMapel(prevState: any, formData: FormData) {
  const db = await getDB()
  const id = formData.get('id') as string
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kode_mapel: (formData.get('kode_mapel') as string) || null,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }
  const result = await dbUpdate(db, 'mata_pelajaran', payload, { id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil diperbarui' }
}

export async function hapusMapel(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'mata_pelajaran', { id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil dihapus' }
}

export async function importMapelMassal(dataExcel: any[]) {
  const db = await getDB()
  const toInsert = dataExcel
    .map((row) => ({
      nama_mapel: String(row.NAMA_MAPEL).trim(),
      kode_mapel: row.KODE_RDM ? String(row.KODE_RDM).trim() : null,
      kelompok: String(row.KELOMPOK || 'UMUM').trim(),
      tingkat: String(row.TINGKAT || 'Semua').trim(),
      kategori: String(row.KATEGORI || 'Umum').trim(),
    }))
    .filter((item) => item.nama_mapel && item.nama_mapel !== 'undefined')

  if (toInsert.length === 0) return { error: 'Tidak ada data valid untuk diimport.' }

  const { successCount, error } = await (await import('@/utils/db')).dbBatchInsert(
    db,
    'mata_pelajaran',
    toInsert
  )

  if (error) return { error }

  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil mengimport ${successCount} mata pelajaran.` }
}

// ============================================================
// 2. PENUGASAN MENGAJAR ACTIONS
// ============================================================
export async function tambahPenugasan(prevState: any, formData: FormData) {
  const db = await getDB()

  const ta = await db
    .prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.' }

  const payload = {
    guru_id: formData.get('guru_id') as string,
    mapel_id: formData.get('mapel_id') as string,
    kelas_id: formData.get('kelas_id') as string,
    tahun_ajaran_id: ta.id,
  }

  if (!payload.guru_id || !payload.mapel_id || !payload.kelas_id) {
    return { error: 'Semua field wajib diisi.' }
  }

  const result = await dbInsert(db, 'penugasan_mengajar', payload)
  if (result.error) {
    return {
      error: result.error.includes('UNIQUE')
        ? 'Penugasan ini sudah ada untuk tahun ajaran yang sama.'
        : result.error,
    }
  }

  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan berhasil ditambahkan.' }
}

export async function hapusPenugasan(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'penugasan_mengajar', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan berhasil dihapus.' }
}

// ============================================================
// FUNGSI YANG DIBUTUHKAN OLEH akademik-client.tsx
// (tetap ada dari versi original, tidak dihapus)
// ============================================================

// resetPenugasanSemesterIni — reset semua penugasan TA aktif
export async function resetPenugasanSemesterIni(tahun_ajaran_id: string) {
  const db = await getDB()
  try {
    await db
      .prepare('DELETE FROM penugasan_mengajar WHERE tahun_ajaran_id = ?')
      .bind(tahun_ajaran_id)
      .run()
    revalidatePath('/dashboard/akademik')
    return { success: 'Semua penugasan semester ini berhasil dihapus.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// importPenugasanASC — import penugasan dari file ASC/Excel
export async function importPenugasanASC(dataExcel: any[]) {
  const db = await getDB()

  const ta = await db
    .prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1')
    .first<{ id: string }>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.', success: null, logs: [] }

  const [guruAll, mapelAll, kelasAll] = await Promise.all([
    db.prepare('SELECT id, LOWER(TRIM(nama_lengkap)) as nama FROM "user" WHERE nama_lengkap IS NOT NULL').all<any>(),
    db.prepare('SELECT id, LOWER(TRIM(nama_mapel)) as nama FROM mata_pelajaran').all<any>(),
    db.prepare('SELECT id, CAST(tingkat AS INTEGER) as tingkat, TRIM(nomor_kelas) as nomor_kelas, UPPER(TRIM(kelompok)) as kelompok FROM kelas').all<any>(),
  ])

  const guruMap = new Map<string, string>()
  for (const g of guruAll.results || []) guruMap.set(g.nama, g.id)

  const mapelMap = new Map<string, string>()
  for (const m of mapelAll.results || []) mapelMap.set(m.nama, m.id)

  const kelasExactMap = new Map<string, string>()
  const kelasFallbackMap = new Map<string, string[]>()
  for (const k of kelasAll.results || []) {
    const tingkat = String(k.tingkat)
    const nomor = String(k.nomor_kelas).trim()
    const kelompok = String(k.kelompok || 'UMUM').trim()
    kelasExactMap.set(`${tingkat}-${nomor}-${kelompok}`, k.id)
    const fbKey = `${tingkat}-${nomor}`
    if (!kelasFallbackMap.has(fbKey)) kelasFallbackMap.set(fbKey, [])
    kelasFallbackMap.get(fbKey)!.push(k.id)
  }

  const errorLogs: string[] = []
  const toInsert: Array<{ guru_id: string; mapel_id: string; kelas_id: string }> = []
  const seen = new Set<string>()

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const namaGuru = String(row.NAMA_GURU || '').trim().toLowerCase()
    const namaKelas = String(row.NAMA_KELAS || '').trim()
    const namaMapel = String(row.NAMA_MAPEL || '').trim().toLowerCase()
    if (!namaGuru || !namaKelas || !namaMapel) continue

    let guruId = guruMap.get(namaGuru)
    if (!guruId) {
      for (const [nama, id] of guruMap) {
        if (nama.includes(namaGuru) || namaGuru.includes(nama)) { guruId = id; break }
      }
    }
    if (!guruId) { errorLogs.push(`Baris ${i + 2}: Guru "${row.NAMA_GURU}" tidak ditemukan.`); continue }

    let mapelId = mapelMap.get(namaMapel)
    if (!mapelId) {
      for (const [nama, id] of mapelMap) {
        if (nama.includes(namaMapel) || namaMapel.includes(nama)) { mapelId = id; break }
      }
    }
    if (!mapelId) { errorLogs.push(`Baris ${i + 2}: Mapel "${row.NAMA_MAPEL}" tidak ditemukan.`); continue }

    const namaKelasUpper = namaKelas.toUpperCase()
    const KELOMPOK_LIST = ['MIPA', 'IPA', 'IPS', 'BAHASA', 'AGAMA', 'SOSHUM', 'KEAGAMAAN']
    let kelompokExcel = 'UMUM'
    for (const k of KELOMPOK_LIST) {
      if (namaKelasUpper.includes(k)) { kelompokExcel = k === 'IPA' ? 'MIPA' : k; break }
    }

    const angka = namaKelas.match(/\d+/g) || []
    const tingkat = parseInt(angka[0] || '0')
    const nomor_kelas = String(parseInt(angka[1] || '0'))
    if (!tingkat || nomor_kelas === '0') {
      errorLogs.push(`Baris ${i + 2}: Format kelas "${namaKelas}" tidak valid.`)
      continue
    }

    let kelasId = kelasExactMap.get(`${tingkat}-${nomor_kelas}-${kelompokExcel}`)
    if (!kelasId) {
      const candidates = kelasFallbackMap.get(`${tingkat}-${nomor_kelas}`) || []
      if (candidates.length === 1) kelasId = candidates[0]
      else if (candidates.length > 1) {
        errorLogs.push(`Baris ${i + 2}: Kelas "${namaKelas}" ambigu (${candidates.length} kelas ditemukan).`)
        continue
      }
    }
    if (!kelasId) {
      errorLogs.push(`Baris ${i + 2}: Kelas "${namaKelas}" tidak ditemukan.`)
      continue
    }

    const key = `${guruId}-${mapelId}-${kelasId}`
    if (seen.has(key)) continue
    seen.add(key)
    toInsert.push({ guru_id: guruId, mapel_id: mapelId, kelas_id: kelasId })
  }

  if (toInsert.length === 0) {
    return { error: 'Tidak ada data yang berhasil diproses.', success: null, logs: errorLogs }
  }

  const chunkSize = 25
  let successCount = 0
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize)
    const placeholders = chunk.map(() => `(lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))`).join(', ')
    const values = chunk.flatMap(r => [r.guru_id, r.mapel_id, r.kelas_id, ta.id])
    try {
      await db
        .prepare(`INSERT OR IGNORE INTO penugasan_mengajar (id, guru_id, mapel_id, kelas_id, tahun_ajaran_id, created_at) VALUES ${placeholders}`)
        .bind(...values)
        .run()
      successCount += chunk.length
    } catch (e: any) {
      errorLogs.push(`Chunk ${Math.floor(i / chunkSize) + 1}: ${e.message}`)
    }
  }

  revalidatePath('/dashboard/akademik')
  return {
    success: `Berhasil mengimport ${successCount} dari ${dataExcel.length} penugasan.`,
    error: successCount === 0 ? 'Tidak ada data yang berhasil diimport.' : null,
    logs: errorLogs,
  }
}
