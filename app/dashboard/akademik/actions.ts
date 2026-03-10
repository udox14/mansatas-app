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
    .map(row => ({
      nama_mapel: String(row.NAMA_MAPEL).trim(),
      kode_mapel: row.KODE_RDM ? String(row.KODE_RDM).trim() : null,
      kelompok: String(row.KELOMPOK || 'UMUM').trim(),
      tingkat: String(row.TINGKAT || 'Semua').trim(),
      kategori: String(row.KATEGORI || 'Umum').trim(),
    }))
    .filter(item => item.nama_mapel && item.nama_mapel !== 'undefined')

  if (toInsert.length === 0) return { error: 'Data Excel kosong atau format tidak sesuai.' }

  // Batch insert 50 per chunk
  const chunkSize = 50
  let totalInserted = 0
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize)
    const placeholders = chunk.map(() => '(lower(hex(randomblob(16))), ?, ?, ?, ?, ?)').join(', ')
    const values = chunk.flatMap(r => [r.nama_mapel, r.kode_mapel, r.kelompok, r.tingkat, r.kategori])
    await db.prepare(
      `INSERT OR IGNORE INTO mata_pelajaran (id, nama_mapel, kode_mapel, kelompok, tingkat, kategori) VALUES ${placeholders}`
    ).bind(...values).run()
    totalInserted += chunk.length
  }

  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil mengimport ${totalInserted} data mata pelajaran.` }
}

// ============================================================
// 2. PENUGASAN MENGAJAR
// ============================================================
export async function hapusPenugasan(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'penugasan_mengajar', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan mengajar berhasil dihapus' }
}

export async function resetPenugasanSemesterIni(tahun_ajaran_id: string) {
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM penugasan_mengajar WHERE tahun_ajaran_id = ?')
      .bind(tahun_ajaran_id).run()
    revalidatePath('/dashboard/akademik')
    return { success: 'Semua penugasan semester ini berhasil dihapus.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function importPenugasanASC(dataExcel: any[]) {
  const db = await getDB()

  // Ambil tahun ajaran aktif
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1').first<{ id: string }>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.', success: null, logs: [] }

  // Ambil SEMUA data sekali — tidak ada loop query lagi
  const [guruAll, mapelAll, kelasAll] = await Promise.all([
    db.prepare('SELECT id, LOWER(nama_lengkap) as nama FROM "user" WHERE nama_lengkap IS NOT NULL').all<any>(),
    db.prepare('SELECT id, LOWER(nama_mapel) as nama FROM mata_pelajaran').all<any>(),
    db.prepare('SELECT id, tingkat, CAST(nomor_kelas AS TEXT) as nomor_kelas, UPPER(kelompok) as kelompok FROM kelas').all<any>(),
  ])

  // Buat lookup map di memory (jauh lebih cepat)
  const guruMap = new Map<string, string>()
  for (const g of guruAll.results || []) {
    guruMap.set(g.nama.trim(), g.id)
  }

  const mapelMap = new Map<string, string>()
  for (const m of mapelAll.results || []) {
    mapelMap.set(m.nama.trim(), m.id)
  }

  const kelasMap = new Map<string, string>()
  for (const k of kelasAll.results || []) {
    const key = `${k.tingkat}-${k.nomor_kelas}-${k.kelompok}`
    kelasMap.set(key, k.id)
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

    // Cari guru (exact match dulu, lalu fuzzy)
    let guruId = guruMap.get(namaGuru)
    if (!guruId) {
      for (const [nama, id] of guruMap) {
        if (nama.includes(namaGuru) || namaGuru.includes(nama)) { guruId = id; break }
      }
    }
    if (!guruId) { errorLogs.push(`Baris ${i + 2}: Guru "${row.NAMA_GURU}" tidak ditemukan.`); continue }

    // Cari mapel (exact match dulu, lalu fuzzy)
    let mapelId = mapelMap.get(namaMapel)
    if (!mapelId) {
      for (const [nama, id] of mapelMap) {
        if (nama.includes(namaMapel) || namaMapel.includes(nama)) { mapelId = id; break }
      }
    }
    if (!mapelId) { errorLogs.push(`Baris ${i + 2}: Mapel "${row.NAMA_MAPEL}" tidak ditemukan.`); continue }

    // Parse kelas: "12-1", "12-1 MIPA", "11-2 IPS"
    const kelasParts = namaKelas.split(/[-\s]+/)
    const tingkat = parseInt(kelasParts[0]) || 0
    const nomor_kelas = String(parseInt(kelasParts[1]) || 0)
    const kelompokRaw = (kelasParts[2] || 'UMUM').toUpperCase()
    const kelompok = ['MIPA', 'IPS', 'BAHASA', 'AGAMA', 'SOSHUM', 'KEAGAMAAN'].includes(kelompokRaw)
      ? kelompokRaw : 'UMUM'

    if (!tingkat || nomor_kelas === '0') {
      errorLogs.push(`Baris ${i + 2}: Format kelas "${namaKelas}" tidak valid.`)
      continue
    }

    const kelasId = kelasMap.get(`${tingkat}-${nomor_kelas}-${kelompok}`)
    if (!kelasId) { errorLogs.push(`Baris ${i + 2}: Kelas "${namaKelas}" tidak ditemukan.`); continue }

    // Deduplicate
    const key = `${guruId}-${mapelId}-${kelasId}`
    if (seen.has(key)) continue
    seen.add(key)

    toInsert.push({ guru_id: guruId, mapel_id: mapelId, kelas_id: kelasId })
  }

  if (toInsert.length === 0) {
    return { error: 'Tidak ada data yang berhasil diproses.', success: null, logs: errorLogs }
  }

  // Batch insert 25 per chunk (tiap row = 1 query, hemat API calls)
  const chunkSize = 25
  let successCount = 0
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize)
    const placeholders = chunk.map(() =>
      `(lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))`
    ).join(', ')
    const values = chunk.flatMap(r => [r.guru_id, r.mapel_id, r.kelas_id, ta.id])
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO penugasan_mengajar (id, guru_id, mapel_id, kelas_id, tahun_ajaran_id, created_at) VALUES ${placeholders}`
      ).bind(...values).run()
      successCount += chunk.length
    } catch (e: any) {
      errorLogs.push(`Chunk ${Math.floor(i/chunkSize)+1}: ${e.message}`)
    }
  }

  revalidatePath('/dashboard/akademik')
  return {
    success: `Berhasil mengimport ${successCount} dari ${dataExcel.length} penugasan.`,
    error: successCount === 0 ? 'Tidak ada data yang berhasil diimport.' : null,
    logs: errorLogs,
  }
}