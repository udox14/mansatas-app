'use server'

import { getDB, dbInsert, dbUpdate } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

// ===========================================
// MENDAPATKAN KELAS TAHFIDZ
// ===========================================
export async function getKelasTahfidz() {
  const db = await getDB()
  const { results } = await db.prepare(
    `SELECT id, tingkat, nomor_kelas, kelompok 
     FROM kelas 
     WHERE kelompok LIKE '%TAHFIDZ%' OR kelompok = 'KEAGAMAAN'
     ORDER BY tingkat ASC, nomor_kelas ASC`
  ).all<any>()
  
  return results?.map(r => ({
    id: r.id,
    label: `${r.tingkat}-${r.nomor_kelas} ${r.kelompok}`
  })) || []
}

// ===========================================
// MENDAPATKAN DAFTAR SISWA (BERDASARKAN KELAS ATAU SEARCH)
// ===========================================
export async function getSiswaTahfidz(kelasId?: string, search?: string) {
  const db = await getDB()
  
  let q = `
    SELECT s.id, s.nisn, s.nama_lengkap, s.foto_url, k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN tahfidz_siswa ts ON ts.siswa_id = s.id
    WHERE s.status = 'aktif'
  `
  
  const params: any[] = []
  
  if (kelasId) {
    q += ` AND s.kelas_id = ?`
    params.push(kelasId)
  } else if (search && search.length > 2) {
    q += ` AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  } else {
    // Default: hanya siswa dari kelas tahfidz atau yang sudah terdaftar manual
    q += ` AND (k.kelompok LIKE '%TAHFIDZ%' OR k.kelompok = 'KEAGAMAAN' OR ts.id IS NOT NULL)`
  }
  
  q += ` ORDER BY k.tingkat ASC, k.nomor_kelas ASC, s.nama_lengkap ASC LIMIT 50`
  
  const { results } = await db.prepare(q).bind(...params).all<any>()
  return results || []
}

// ===========================================
// MENDAPATKAN PROGRESS HAFALAN SATU SISWA
// ===========================================
export async function getProgressSiswa(siswaId: string) {
  const db = await getDB()
  const { results } = await db.prepare(
    `SELECT surah_nomor, juz, ayat_hafal FROM tahfidz_progress WHERE siswa_id = ?`
  ).bind(siswaId).all<any>()
  
  // Return as dictionary { [surah_nomor]: [1,2,3...] }
  const progress: Record<number, number[]> = {}
  for (const r of (results || [])) {
    try {
      progress[r.surah_nomor] = JSON.parse(r.ayat_hafal)
    } catch(e) {
      progress[r.surah_nomor] = []
    }
  }
  return progress
}

// ===========================================
// MENDAPATKAN NILAI JUZ SISWA
// ===========================================
export async function getNilaiJuz(siswaId: string) {
  const db = await getDB()
  const { results } = await db.prepare(
    `SELECT juz, nilai, catatan FROM tahfidz_nilai WHERE siswa_id = ?`
  ).bind(siswaId).all<any>()
  
  return results || []
}

// ===========================================
// MENDAPATKAN RIWAYAT SETORAN SISWA
// ===========================================
export async function getRiwayatSetoran(siswaId: string) {
  const db = await getDB()
  const { results } = await db.prepare(
    `SELECT log.id, log.surah_nomor, log.juz, log.ayat_baru, log.keterangan, log.created_at, u.nama_lengkap as guru_nama
     FROM tahfidz_setoran_log log
     LEFT JOIN "user" u ON log.diinput_oleh = u.id
     WHERE log.siswa_id = ?
     ORDER BY log.created_at DESC`
  ).bind(siswaId).all<any>()
  
  return results || []
}

// ===========================================
// MENYIMPAN SETORAN HAFALAN BATCH
// ===========================================
export async function simpanSetoranHafalan(
  siswaId: string, 
  surahNomor: number, 
  juz: number, 
  ayatHafal: number[], // Total subset of ayat that are now green
  keterangan: string = ''
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  
  // Get current progress
  const curr = await db.prepare(`SELECT ayat_hafal FROM tahfidz_progress WHERE siswa_id = ? AND surah_nomor = ?`)
    .bind(siswaId, surahNomor).first<{ayat_hafal: string}>()
    
  let currentAyat: number[] = []
  if (curr?.ayat_hafal) {
    try { currentAyat = JSON.parse(curr.ayat_hafal) } catch(e) {}
  }
  
  // Calculate newly added ayat
  const currentSet = new Set(currentAyat)
  const incomingSet = new Set(ayatHafal)
  const newAyat = ayatHafal.filter(a => !currentSet.has(a)).sort((a,b)=>a-b)
  
  // Tentu saja bisa saja guru menghapus hapalan (ayat_hafal < currentAyat).
  // Jika hanya menghapus (un-check), newAyat akan 0.
  
  // Update the progress state (upsert)
  const mergedAyat = Array.from(new Set([...currentAyat, ...ayatHafal])).sort((a,b)=>a-b)
  // Tapi tunggu, kalau guru uncheck, meaning ayatHafal is the truth.
  // Jadi kita save ayatHafal as is
  const ayatToSave = JSON.stringify(ayatHafal.sort((a,b)=>a-b))
  
  await db.prepare(`
    INSERT INTO tahfidz_progress (id, siswa_id, surah_nomor, juz, ayat_hafal, updated_by, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(siswa_id, surah_nomor) DO UPDATE SET 
      ayat_hafal = excluded.ayat_hafal, 
      updated_by = excluded.updated_by, 
      updated_at = excluded.updated_at
  `).bind(siswaId, surahNomor, juz, ayatToSave, user.id).run()
  
  // If there are newly added ayat, log it!
  if (newAyat.length > 0) {
    await db.prepare(`
      INSERT INTO tahfidz_setoran_log (id, siswa_id, surah_nomor, juz, ayat_baru, keterangan, diinput_oleh, created_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      siswaId, surahNomor, juz, 
      JSON.stringify(newAyat), 
      keterangan, user.id
    ).run()
  }

  revalidatePath('/dashboard/tahfidz')
  return { success: 'Hafalan tersimpan.', newAyatCount: newAyat.length }
}

// ===========================================
// MENYIMPAN NILAI JUZ
// ===========================================
export async function simpanNilaiJuz(siswaId: string, juz: number, nilai: number, catatan: string = '') {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  await db.prepare(`
    INSERT INTO tahfidz_nilai (id, siswa_id, juz, nilai, catatan, updated_by, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(siswa_id, juz) DO UPDATE SET 
      nilai = excluded.nilai, 
      catatan = excluded.catatan,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(siswaId, juz, nilai, catatan, user.id).run()

  revalidatePath('/dashboard/tahfidz')
  return { success: 'Nilai berhasil disimpan.' }
}

// ===========================================
// PENCARIAN GLOBAL & TAMBAH SISWA MANUAL
// ===========================================
export async function searchSiswaGlobal(search: string) {
  if (!search || search.length < 3) return []
  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT s.id, s.nisn, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.status = 'aktif' 
      AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
    ORDER BY s.nama_lengkap ASC LIMIT 10
  `).bind(`%${search}%`, `%${search}%`).all<any>()
  return results || []
}

export async function tambahSiswaTahfidz(siswaId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  await db.prepare(`
    INSERT INTO tahfidz_siswa (id, siswa_id, ditambah_oleh, created_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, datetime('now'))
    ON CONFLICT(siswa_id) DO NOTHING
  `).bind(siswaId, user.id).run()
  
  revalidatePath('/dashboard/tahfidz')
  return { success: 'Siswa berhasil ditambahkan ke program Tahfidz.' }
}
