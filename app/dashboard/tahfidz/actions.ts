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
     ORDER BY tingkat ASC, CAST(nomor_kelas AS INTEGER) ASC, nomor_kelas ASC`
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
  if (!kelasId && !search) return []

  const db = await getDB()
  
  let q = `
    SELECT s.id, s.nisn, s.nama_lengkap, s.foto_url, k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.status = 'aktif'
  `
  
  const params: any[] = []
  
  if (kelasId) {
    q += ` AND s.kelas_id = ?`
    params.push(kelasId)
  } else if (search && search.length > 2) {
    q += ` AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  }
  
  q += ` ORDER BY k.tingkat ASC, CAST(k.nomor_kelas AS INTEGER) ASC, k.nomor_kelas ASC, s.nama_lengkap ASC LIMIT 50`
  
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
// TANDAI HAFAL SELURUH JUZ SEKALIGUS
// ===========================================
export async function simpanHafalanJuzPenuh(
  siswaId: string,
  juz: number,
  surahList: { nomor: number; jumlahAyat: number }[]
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()

  for (const surah of surahList) {
    const allAyat = Array.from({ length: surah.jumlahAyat }, (_, i) => i + 1)
    const ayatToSave = JSON.stringify(allAyat)

    const curr = await db.prepare(`SELECT ayat_hafal FROM tahfidz_progress WHERE siswa_id = ? AND surah_nomor = ?`)
      .bind(siswaId, surah.nomor).first<{ ayat_hafal: string }>()

    let currentAyat: number[] = []
    if (curr?.ayat_hafal) {
      try { currentAyat = JSON.parse(curr.ayat_hafal) } catch (e) {}
    }

    const currentSet = new Set(currentAyat)
    const newAyat = allAyat.filter(a => !currentSet.has(a))

    await db.prepare(`
      INSERT INTO tahfidz_progress (id, siswa_id, surah_nomor, juz, ayat_hafal, updated_by, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(siswa_id, surah_nomor) DO UPDATE SET
        ayat_hafal = excluded.ayat_hafal,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).bind(siswaId, surah.nomor, juz, ayatToSave, user.id).run()

    if (newAyat.length > 0) {
      await db.prepare(`
        INSERT INTO tahfidz_setoran_log (id, siswa_id, surah_nomor, juz, ayat_baru, keterangan, diinput_oleh, created_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(siswaId, surah.nomor, juz, JSON.stringify(newAyat), 'Tandai Hafal Seluruh Juz', user.id).run()
    }
  }

  revalidatePath('/dashboard/tahfidz')
  return { success: `Seluruh hafalan Juz ${juz} telah ditandai.` }
}

// ===========================================
// DATA LAPORAN CETAK
// ===========================================
export async function getDataLaporanSiswa(siswaId: string) {
  const db = await getDB()

  const siswa = await db.prepare(`
    SELECT s.id, s.nisn, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()

  if (!siswa) return null

  const [progress, riwayat, nilai] = await Promise.all([
    getProgressSiswa(siswaId),
    getRiwayatSetoran(siswaId),
    getNilaiJuz(siswaId),
  ])

  const filteredProgress: Record<number, number[]> = {}
  for (const [key, ayat] of Object.entries(progress)) {
    if ((ayat as number[]).length > 0) filteredProgress[Number(key)] = ayat as number[]
  }

  return { siswa, progress: filteredProgress, riwayat, nilai }
}

export async function getDataLaporanKelas(kelasId?: string) {
  const db = await getDB()

  let siswaQuery = `
    SELECT s.id, s.nisn, s.nama_lengkap, k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.status = 'aktif'`

  const siswaParams: any[] = []
  if (kelasId) {
    siswaQuery += ` AND s.kelas_id = ?`
    siswaParams.push(kelasId)
  }
  siswaQuery += ` ORDER BY k.tingkat ASC, CAST(k.nomor_kelas AS INTEGER) ASC, k.nomor_kelas ASC, s.nama_lengkap ASC`

  const { results: siswaResults } = await db.prepare(siswaQuery).bind(...siswaParams).all<any>()
  const siswaList = siswaResults || []

  if (siswaList.length === 0) return { siswaList: [], kelas: null }

  let progQuery = `
    SELECT tp.siswa_id, tp.surah_nomor, tp.ayat_hafal
    FROM tahfidz_progress tp
    INNER JOIN siswa s ON tp.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.status = 'aktif'`
  const progParams: any[] = []
  if (kelasId) {
    progQuery += ` AND s.kelas_id = ?`
    progParams.push(kelasId)
  }

  const { results: progResults } = await db.prepare(progQuery).bind(...progParams).all<any>()

  const progressMap: Record<string, Record<number, number[]>> = {}
  for (const r of (progResults || [])) {
    if (!progressMap[r.siswa_id]) progressMap[r.siswa_id] = {}
    try {
      const ayat: number[] = JSON.parse(r.ayat_hafal)
      if (ayat.length > 0) progressMap[r.siswa_id][r.surah_nomor] = ayat
    } catch {}
  }

  const result = siswaList.map((s: any) => {
    const prog = progressMap[s.id] || {}
    const totalAyat = Object.values(prog).reduce((sum: number, a: any) => sum + a.length, 0)
    return { ...s, progress: prog, totalAyat }
  })

  const kelas = kelasId && siswaList.length > 0
    ? { tingkat: siswaList[0].tingkat, nomor_kelas: siswaList[0].nomor_kelas, kelompok: siswaList[0].kelompok }
    : null

  return { siswaList: result, kelas }
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
