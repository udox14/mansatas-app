// Lokasi: app/dashboard/psikotes/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// TYPES
// ============================================================
export type RekomMapping = {
  id: string
  label_excel: string
  jurusan_db: string
  keterangan: string | null
}

export type PsikotesRow = {
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string
  foto_url: string | null
  kelas_id: string | null
  tingkat: number | null
  nomor_kelas: string | null
  kelas_kelompok: string | null
  iq_score: number | null
  iq_klasifikasi: string | null
  bakat_ver: number | null; bakat_num: number | null; bakat_skl: number | null
  bakat_abs: number | null; bakat_mek: number | null; bakat_rr: number | null
  bakat_kkk: number | null
  minat_ps: number | null; minat_nat: number | null; minat_mek: number | null
  minat_bis: number | null; minat_art: number | null; minat_si: number | null
  minat_v: number | null; minat_m: number | null; minat_k: number | null
  riasec: string | null
  mapel_pilihan: string | null
  rekom_raw: string | null
  rekom_jurusan: string | null
  mbti: string | null
  gaya_belajar: string | null
  usia_thn: number | null
  usia_bln: number | null
  updated_at: string
}

// ============================================================
// 1. INITIAL DATA (1 batch query)
// ============================================================
export async function getInitialDataPsikotes(userRole: string, userId: string) {
  const db = await getDB()

  // Kelas yang boleh dilihat berdasarkan role
  const isAdmin = ['super_admin', 'kepsek'].includes(userRole)
  const isWaliKelas = userRole === 'wali_kelas' || userRole === 'guru'

  // Ambil mapping + kelas list + stats dalam 1 batch
  const [mappingRes, kelasRes, statsRes] = await Promise.all([
    db.prepare('SELECT id, label_excel, jurusan_db, keterangan FROM psikotes_rekom_mapping ORDER BY label_excel ASC').all<RekomMapping>(),
    db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat ASC, kelompok ASC, nomor_kelas ASC').all<any>(),
    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN iq_klasifikasi = 'Superior' THEN 1 ELSE 0 END) as superior,
        SUM(CASE WHEN iq_klasifikasi LIKE '%atas%' THEN 1 ELSE 0 END) as diatas,
        SUM(CASE WHEN iq_klasifikasi = 'Rata-rata' THEN 1 ELSE 0 END) as rata,
        SUM(CASE WHEN gaya_belajar = 'VISUAL' THEN 1 ELSE 0 END) as visual,
        SUM(CASE WHEN gaya_belajar = 'AUDITORI' THEN 1 ELSE 0 END) as auditori,
        SUM(CASE WHEN gaya_belajar = 'KINESTETIK' THEN 1 ELSE 0 END) as kinestetik
      FROM siswa_psikotes
    `).first<any>(),
  ])

  return {
    mappingList: mappingRes.results || [],
    kelasList: kelasRes.results || [],
    stats: statsRes,
  }
}

// ============================================================
// 2. LIST SISWA PSIKOTES (paginated, lazy load)
// ============================================================
export async function getListPsikotes(filter: {
  kelas_id?: string
  rekom_jurusan?: string
  gaya_belajar?: string
  mbti?: string
  iq_klasifikasi?: string
  search?: string
}, page: number = 1, pageSize: number = 20) {
  const db = await getDB()

  const conditions: string[] = ['sp.id IS NOT NULL']
  const params: any[] = []

  if (filter.kelas_id) {
    conditions.push('s.kelas_id = ?')
    params.push(filter.kelas_id)
  }
  if (filter.rekom_jurusan) {
    conditions.push('sp.rekom_jurusan = ?')
    params.push(filter.rekom_jurusan)
  }
  if (filter.gaya_belajar) {
    conditions.push('sp.gaya_belajar = ?')
    params.push(filter.gaya_belajar)
  }
  if (filter.mbti) {
    conditions.push('sp.mbti = ?')
    params.push(filter.mbti)
  }
  if (filter.iq_klasifikasi) {
    conditions.push('sp.iq_klasifikasi = ?')
    params.push(filter.iq_klasifikasi)
  }
  if (filter.search) {
    conditions.push('(LOWER(s.nama_lengkap) LIKE LOWER(?) OR s.nisn LIKE ?)')
    params.push(`%${filter.search}%`, `%${filter.search}%`)
  }

  const where = conditions.join(' AND ')

  // Count + data dalam 2 query (tidak bisa 1 karena butuh LIMIT/OFFSET)
  const [countRes, dataRes] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as total
      FROM siswa_psikotes sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE ${where}
    `).bind(...params).first<{ total: number }>(),
    db.prepare(`
      SELECT
        sp.id, sp.siswa_id, s.nama_lengkap, s.nisn, s.foto_url,
        k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok,
        sp.iq_score, sp.iq_klasifikasi,
        sp.riasec, sp.rekom_raw, sp.rekom_jurusan,
        sp.mbti, sp.gaya_belajar,
        sp.updated_at
      FROM siswa_psikotes sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE ${where}
      ORDER BY s.nama_lengkap ASC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, (page - 1) * pageSize).all<any>(),
  ])

  return {
    rows: dataRes.results || [],
    total: countRes?.total ?? 0,
  }
}

// ============================================================
// 3. DETAIL SATU SISWA (lazy load saat klik)
// ============================================================
export async function getDetailPsikotes(siswa_id: string) {
  const db = await getDB()
  const row = await db.prepare(`
    SELECT sp.*,
      s.nama_lengkap, s.nisn, s.foto_url, s.jenis_kelamin,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM siswa_psikotes sp
    JOIN siswa s ON sp.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE sp.siswa_id = ?
  `).bind(siswa_id).first<any>()
  return row ?? null
}

// ============================================================
// 4. ANALITIK (1 query agregasi)
// ============================================================
export async function getAnalitikPsikotes(kelas_id?: string) {
  const db = await getDB()

  // Semua query dibangun dengan WHERE clause eksplisit
  // Saat filter kelas: JOIN siswa + WHERE s.kelas_id = ?
  // Saat semua kelas: tidak ada JOIN/WHERE tambahan
  const makeQuery = (selectClause: string, extraWhere?: string) => {
    if (kelas_id) {
      const w = extraWhere ? `AND ${extraWhere}` : ''
      return `${selectClause} FROM siswa_psikotes sp JOIN siswa s ON sp.siswa_id = s.id WHERE s.kelas_id = ? ${w}`
    } else {
      const w = extraWhere ? `WHERE ${extraWhere}` : ''
      return `${selectClause} FROM siswa_psikotes sp ${w}`
    }
  }
  const params = kelas_id ? [kelas_id] : []

  const [iqDist, gayaDist, rekomDist, riasecDist, mbtiDist, bakatAvg, minatAvg] = await Promise.all([
    db.prepare(makeQuery('SELECT iq_klasifikasi, COUNT(*) as n') + ' GROUP BY iq_klasifikasi ORDER BY n DESC')
      .bind(...params).all<any>(),
    db.prepare(makeQuery(
      `SELECT CASE WHEN UPPER(gaya_belajar) = 'AUDITORY' THEN 'AUDITORI' ELSE gaya_belajar END as gaya_belajar, COUNT(*) as n`
    ) + ' GROUP BY 1 ORDER BY n DESC')
      .bind(...params).all<any>(),
    db.prepare(makeQuery('SELECT rekom_jurusan, COUNT(*) as n', 'rekom_jurusan IS NOT NULL') + ' GROUP BY rekom_jurusan ORDER BY n DESC')
      .bind(...params).all<any>(),
    db.prepare(makeQuery("SELECT TRIM(SUBSTR(riasec, 1, INSTR(riasec||',', ',')-1)) as tipe, COUNT(*) as n", 'riasec IS NOT NULL') + ' GROUP BY tipe ORDER BY n DESC')
      .bind(...params).all<any>(),
    db.prepare(makeQuery('SELECT mbti, COUNT(*) as n', 'mbti IS NOT NULL') + ' GROUP BY mbti ORDER BY n DESC')
      .bind(...params).all<any>(),
    db.prepare(makeQuery('SELECT ROUND(AVG(bakat_ver),1) as ver, ROUND(AVG(bakat_num),1) as num, ROUND(AVG(bakat_skl),1) as skl, ROUND(AVG(bakat_abs),1) as abs, ROUND(AVG(bakat_mek),1) as mek, ROUND(AVG(bakat_rr),1) as rr, ROUND(AVG(bakat_kkk),1) as kkk'))
      .bind(...params).first<any>(),
    db.prepare(makeQuery('SELECT ROUND(AVG(minat_ps),1) as ps, ROUND(AVG(minat_nat),1) as nat, ROUND(AVG(minat_mek),1) as mek, ROUND(AVG(minat_bis),1) as bis, ROUND(AVG(minat_art),1) as art, ROUND(AVG(minat_si),1) as si, ROUND(AVG(minat_v),1) as v, ROUND(AVG(minat_m),1) as m, ROUND(AVG(minat_k),1) as k'))
      .bind(...params).first<any>(),
  ])

  return {
    iqDist: iqDist.results || [],
    gayaDist: gayaDist.results || [],
    rekomDist: rekomDist.results || [],
    riasecDist: riasecDist.results || [],
    mbtiDist: mbtiDist.results || [],
    bakatAvg: bakatAvg,
    minatAvg: minatAvg,
  }
}

// ============================================================
// 5. MAPPING JURUSAN CRUD
// ============================================================
export async function tambahMapping(label_excel: string, jurusan_db: string, keterangan: string) {
  const db = await getDB()
  const result = await dbInsert(db, 'psikotes_rekom_mapping', {
    label_excel: label_excel.trim().toUpperCase(),
    jurusan_db: jurusan_db.trim(),
    keterangan: keterangan.trim() || null,
  })
  if (result.error) return { error: result.error.includes('UNIQUE') ? 'Label ini sudah ada.' : result.error }
  revalidatePath('/dashboard/psikotes')
  return { success: 'Mapping berhasil ditambahkan.' }
}

export async function editMapping(id: string, jurusan_db: string, keterangan: string) {
  const db = await getDB()
  const result = await dbUpdate(db, 'psikotes_rekom_mapping', {
    jurusan_db: jurusan_db.trim(),
    keterangan: keterangan.trim() || null,
    updated_at: new Date().toISOString(),
  }, { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/psikotes')
  return { success: 'Mapping berhasil diperbarui.' }
}

export async function hapusMapping(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'psikotes_rekom_mapping', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/psikotes')
  return { success: 'Mapping berhasil dihapus.' }
}

// ============================================================
// 6. FUZZY MATCH (untuk preview sebelum import)
// ============================================================
export async function fuzzyMatchNama(namaList: string[]): Promise<{
  nama: string
  matched: { siswa_id: string; nama_lengkap: string; nisn: string; kelas: string } | null
  candidates: { siswa_id: string; nama_lengkap: string; nisn: string; kelas: string }[]
  status: 'matched' | 'ambiguous' | 'notfound'
}[]> {
  if (namaList.length === 0) return []
  const db = await getDB()

  // 1 query untuk SEMUA nama — tidak peduli berapa chunk yang dikirim client
  // Fungsi ini dirancang untuk menerima semua nama sekaligus
  const allSiswa = await db.prepare(`
    SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.status = 'aktif'
  `).all<any>()

  const siswaList = (allSiswa.results || []).map((s: any) => ({
    siswa_id: s.id,
    nama_lengkap: s.nama_lengkap,
    nama_normalized: s.nama_lengkap.toUpperCase().trim().replace(/\s+/g, ' '),
    nisn: s.nisn,
    kelas: s.tingkat ? `${s.tingkat}-${s.nomor_kelas} ${s.kelompok}` : '-',
  }))

  return namaList.map(nama => {
    const namaNorm = nama.toUpperCase().trim().replace(/\s+/g, ' ')

    // 1. Exact match
    const exact = siswaList.filter(s => s.nama_normalized === namaNorm)
    if (exact.length === 1) return { nama, matched: exact[0], candidates: [], status: 'matched' }

    // 2. Contains match
    const contains = siswaList.filter(s =>
      s.nama_normalized.includes(namaNorm) || namaNorm.includes(s.nama_normalized)
    )
    if (contains.length === 1) return { nama, matched: contains[0], candidates: [], status: 'matched' }
    if (contains.length > 1 && contains.length <= 5) return { nama, matched: null, candidates: contains, status: 'ambiguous' }

    // 3. Word overlap (setidaknya 2 kata sama)
    const words = namaNorm.split(' ').filter(w => w.length > 2)
    const overlap = siswaList.filter(s => {
      const sWords = s.nama_normalized.split(' ')
      const common = words.filter(w => sWords.includes(w))
      return common.length >= 2
    })
    if (overlap.length === 1) return { nama, matched: overlap[0], candidates: [], status: 'matched' }
    if (overlap.length > 1 && overlap.length <= 5) return { nama, matched: null, candidates: overlap, status: 'ambiguous' }

    return { nama, matched: null, candidates: [], status: 'notfound' }
  })
}

// ============================================================
// 7. IMPORT CHUNK (dipanggil per chunk dari client)
// ============================================================
export async function importPsikotesChunk(rows: {
  siswa_id: string
  iq_score?: number | null; iq_klasifikasi?: string | null
  bakat_ver?: number | null; bakat_num?: number | null; bakat_skl?: number | null
  bakat_abs?: number | null; bakat_mek?: number | null; bakat_rr?: number | null
  bakat_kkk?: number | null
  minat_ps?: number | null; minat_nat?: number | null; minat_mek?: number | null
  minat_bis?: number | null; minat_art?: number | null; minat_si?: number | null
  minat_v?: number | null; minat_m?: number | null; minat_k?: number | null
  riasec?: string | null; mapel_pilihan?: string | null; rekom_raw?: string | null
  mbti?: string | null; gaya_belajar?: string | null
  usia_thn?: number | null; usia_bln?: number | null
}[]): Promise<{ success: number; error: number; errors: string[] }> {
  if (rows.length === 0) return { success: 0, error: 0, errors: [] }

  const db = await getDB()
  const errors: string[] = []
  let successCount = 0

  // Ambil mapping jurusan sekali per chunk
  const mappingRes = await db.prepare('SELECT label_excel, jurusan_db FROM psikotes_rekom_mapping').all<any>()
  const mappingMap = new Map<string, string>()
  for (const m of mappingRes.results || []) {
    mappingMap.set(m.label_excel.toUpperCase(), m.jurusan_db)
  }

  // Build statements
  const statements = rows.map(row => {
    const normalizeGaya = (g: string | null | undefined) => {
      if (!g) return null
      const up = g.toUpperCase().trim()
      // Normalisasi typo umum
      if (up === 'AUDITORY') return 'AUDITORI'
      if (up === 'KINESTHETIC' || up === 'KINESTETIS') return 'KINESTETIK'
      return up
    }
    const rekom_jurusan = row.rekom_raw
      ? (mappingMap.get(row.rekom_raw.toUpperCase().trim()) ?? null)
      : null

    return db.prepare(`
      INSERT INTO siswa_psikotes (
        id, siswa_id,
        iq_score, iq_klasifikasi,
        bakat_ver, bakat_num, bakat_skl, bakat_abs, bakat_mek, bakat_rr, bakat_kkk,
        minat_ps, minat_nat, minat_mek, minat_bis, minat_art, minat_si, minat_v, minat_m, minat_k,
        riasec, mapel_pilihan, rekom_raw, rekom_jurusan,
        mbti, gaya_belajar, usia_thn, usia_bln, updated_at
      ) VALUES (
        lower(hex(randomblob(16))), ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      )
      ON CONFLICT(siswa_id) DO UPDATE SET
        iq_score        = COALESCE(excluded.iq_score, iq_score),
        iq_klasifikasi  = COALESCE(excluded.iq_klasifikasi, iq_klasifikasi),
        bakat_ver       = COALESCE(excluded.bakat_ver, bakat_ver),
        bakat_num       = COALESCE(excluded.bakat_num, bakat_num),
        bakat_skl       = COALESCE(excluded.bakat_skl, bakat_skl),
        bakat_abs       = COALESCE(excluded.bakat_abs, bakat_abs),
        bakat_mek       = COALESCE(excluded.bakat_mek, bakat_mek),
        bakat_rr        = COALESCE(excluded.bakat_rr, bakat_rr),
        bakat_kkk       = COALESCE(excluded.bakat_kkk, bakat_kkk),
        minat_ps        = COALESCE(excluded.minat_ps, minat_ps),
        minat_nat       = COALESCE(excluded.minat_nat, minat_nat),
        minat_mek       = COALESCE(excluded.minat_mek, minat_mek),
        minat_bis       = COALESCE(excluded.minat_bis, minat_bis),
        minat_art       = COALESCE(excluded.minat_art, minat_art),
        minat_si        = COALESCE(excluded.minat_si, minat_si),
        minat_v         = COALESCE(excluded.minat_v, minat_v),
        minat_m         = COALESCE(excluded.minat_m, minat_m),
        minat_k         = COALESCE(excluded.minat_k, minat_k),
        riasec          = COALESCE(excluded.riasec, riasec),
        mapel_pilihan   = COALESCE(excluded.mapel_pilihan, mapel_pilihan),
        rekom_raw       = COALESCE(excluded.rekom_raw, rekom_raw),
        rekom_jurusan   = COALESCE(excluded.rekom_jurusan, rekom_jurusan),
        mbti            = COALESCE(excluded.mbti, mbti),
        gaya_belajar    = COALESCE(excluded.gaya_belajar, gaya_belajar),
        usia_thn        = COALESCE(excluded.usia_thn, usia_thn),
        usia_bln        = COALESCE(excluded.usia_bln, usia_bln),
        updated_at      = datetime('now')
    `).bind(
      row.siswa_id,
      row.iq_score ?? null, row.iq_klasifikasi ?? null,
      row.bakat_ver ?? null, row.bakat_num ?? null, row.bakat_skl ?? null,
      row.bakat_abs ?? null, row.bakat_mek ?? null, row.bakat_rr ?? null, row.bakat_kkk ?? null,
      row.minat_ps ?? null, row.minat_nat ?? null, row.minat_mek ?? null,
      row.minat_bis ?? null, row.minat_art ?? null, row.minat_si ?? null,
      row.minat_v ?? null, row.minat_m ?? null, row.minat_k ?? null,
      row.riasec ?? null, row.mapel_pilihan ?? null, row.rekom_raw ?? null, rekom_jurusan,
      row.mbti ?? null, row.gaya_belajar ?? null,
      row.usia_thn ?? null, row.usia_bln ?? null,
    )
  })

  // D1 batch — 10 per batch (banyak kolom)
  const BATCH_SIZE = 10
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const batch = statements.slice(i, i + BATCH_SIZE)
    try {
      const results = await db.batch(batch)
      successCount += results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      if (failed > 0) errors.push(`Batch ${Math.floor(i/BATCH_SIZE)+1}: ${failed} baris gagal`)
    } catch (e: any) {
      errors.push(`Batch ${Math.floor(i/BATCH_SIZE)+1}: ${e?.message ?? 'unknown error'}`)
    }
  }

  revalidatePath('/dashboard/psikotes')
  return { success: successCount, error: rows.length - successCount, errors }
}


// Hapus data psikotes satu siswa
export async function hapusPsikotes(siswa_id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'siswa_psikotes', { siswa_id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/psikotes')
  return { success: 'Data psikotes berhasil dihapus.' }
}

// ============================================================
// NORMALIZE: perbaiki typo gaya_belajar di data yang sudah ada
// ============================================================
export async function normalizeGayaBelajar() {
  const db = await getDB()
  const res = await db.prepare(`
    UPDATE siswa_psikotes
    SET gaya_belajar = CASE
      WHEN UPPER(gaya_belajar) = 'AUDITORY'   THEN 'AUDITORI'
      WHEN UPPER(gaya_belajar) = 'KINESTETIS'  THEN 'KINESTETIK'
      WHEN UPPER(gaya_belajar) = 'KINESTHETIC' THEN 'KINESTETIK'
      ELSE gaya_belajar
    END
    WHERE UPPER(gaya_belajar) IN ('AUDITORY', 'KINESTETIS', 'KINESTHETIC')
  `).run()
  revalidatePath('/dashboard/psikotes')
  return { success: `Normalisasi selesai.` }
}
