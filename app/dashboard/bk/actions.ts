// Lokasi: app/dashboard/bk/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// TYPES
// ============================================================
export type BidangBK = 'Pribadi' | 'Karir' | 'Sosial' | 'Akademik'
export type TipePenanganan = 'KONSELING' | 'KONSELING_KELOMPOK' | 'HOME_VISIT'
export type TindakLanjut = string

export type SesiPenanganan = {
  id: string
  tipe: TipePenanganan
  tanggal: string
  catatan: string
}

export type GuruBKSignature = {
  id: string
  nama_lengkap: string
  nip: string | null
  signature_url: string | null
}

export type RekamanBKLaporan = {
  id: string
  siswa_id: string
  bidang: BidangBK
  topik_nama: string | null
  deskripsi: string
  penanganan: SesiPenanganan[]
  tindak_lanjut: string
  catatan_tindak_lanjut: string | null
  created_at: string
  updated_at: string
  guru_nama: string | null
}

export type LaporanBKSiswa = {
  siswa: {
    id: string
    nama_lengkap: string
    nisn: string | null
    tingkat: number | null
    nomor_kelas: string | null
    kelas_kelompok: string | null
  }
  ta: { id: string; nama: string; semester: number }
  guru_bk: GuruBKSignature
  rekaman: RekamanBKLaporan[]
}

export type LaporanBKKelas = {
  kelas: {
    id: string
    tingkat: number
    nomor_kelas: string
    kelompok: string
  }
  ta: { id: string; nama: string; semester: number }
  guru_bk: GuruBKSignature
  siswa: Array<{
    id: string
    nama_lengkap: string
    nisn: string | null
    jumlah_rekaman: number
    bidang_list: string
    rekaman_terakhir: string | null
    tindak_lanjut_count: number
    sesi_count: number
    ringkasan_terakhir: string | null
    topik_terakhir: string | null
  }>
}

// ============================================================
// HELPER: Ambil TA aktif
// ============================================================
async function getTaAktif(db: D1Database) {
  return db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string; nama: string; semester: number }>()
}

function parsePenanganan(value: string | null | undefined): SesiPenanganan[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function isKelasBinaan(db: D1Database, guru_bk_id: string, tahun_ajaran_id: string, kelas_id: string) {
  const row = await db.prepare(`
    SELECT 1 as ok
    FROM kelas_binaan_bk
    WHERE guru_bk_id = ? AND tahun_ajaran_id = ? AND kelas_id = ?
    LIMIT 1
  `).bind(guru_bk_id, tahun_ajaran_id, kelas_id).first<{ ok: number }>()
  return Boolean(row)
}

async function getGuruBKPenandaTangan(
  db: D1Database,
  guru_bk_id: string,
  tahun_ajaran_id: string,
  is_admin: boolean,
  kelas_id?: string | null
): Promise<GuruBKSignature | null> {
  if (is_admin && kelas_id) {
    const assigned = await db.prepare(`
      SELECT u.id, COALESCE(u.nama_lengkap, u.name) as nama_lengkap, u.nip, u.signature_url
      FROM kelas_binaan_bk kb
      JOIN "user" u ON kb.guru_bk_id = u.id
      WHERE kb.kelas_id = ? AND kb.tahun_ajaran_id = ?
      ORDER BY u.nama_lengkap ASC, u.name ASC
      LIMIT 1
    `).bind(kelas_id, tahun_ajaran_id).first<GuruBKSignature>()
    if (assigned) return assigned
  }

  return db.prepare(`
    SELECT id, COALESCE(nama_lengkap, name) as nama_lengkap, nip, signature_url
    FROM "user"
    WHERE id = ?
    LIMIT 1
  `).bind(guru_bk_id).first<GuruBKSignature>()
}

// ============================================================
// 1. KELAS BINAAN (per TA)
// ============================================================

export async function getKelasBinaanGurubk(guru_bk_id: string, tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT kb.kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM kelas_binaan_bk kb
    JOIN kelas k ON kb.kelas_id = k.id
    WHERE kb.guru_bk_id = ? AND kb.tahun_ajaran_id = ?
    ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC
  `).bind(guru_bk_id, tahun_ajaran_id).all<any>()
  return res.results || []
}

export async function setKelasBinaanBK(guru_bk_id: string, kelas_ids: string[], tahun_ajaran_id: string) {
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM kelas_binaan_bk WHERE guru_bk_id = ? AND tahun_ajaran_id = ?').bind(guru_bk_id, tahun_ajaran_id).run()
    if (kelas_ids.length > 0) {
      const CHUNK = 10
      for (let i = 0; i < kelas_ids.length; i += CHUNK) {
        const chunk = kelas_ids.slice(i, i + CHUNK)
        const placeholders = chunk.map(() => `(lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))`).join(', ')
        const values = chunk.flatMap(kid => [guru_bk_id, kid, tahun_ajaran_id])
        await db.prepare(
          `INSERT OR IGNORE INTO kelas_binaan_bk (id, guru_bk_id, kelas_id, tahun_ajaran_id, created_at) VALUES ${placeholders}`
        ).bind(...values).run()
      }
    }
    revalidatePath('/', 'layout')
    return { success: 'Kelas binaan berhasil diperbarui.' }
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal memperbarui kelas binaan.' }
  }
}

// ============================================================
// 2. TOPIK PERMASALAHAN
// ============================================================

export async function tambahTopikBK(bidang: BidangBK, nama: string, guru_bk_id: string) {
  if (!nama.trim()) return { error: 'Nama topik tidak boleh kosong.' }
  const db = await getDB()
  const result = await dbInsert(db, 'bk_topik', { bidang, nama: nama.trim(), created_by: guru_bk_id })
  if (result.error) return { error: result.error.includes('UNIQUE') ? 'Topik ini sudah ada.' : result.error }
  revalidatePath('/dashboard/bk')
  return { success: 'Topik berhasil ditambahkan.' }
}

export async function editTopikBK(id: string, nama: string) {
  if (!nama.trim()) return { error: 'Nama topik tidak boleh kosong.' }
  const db = await getDB()
  const result = await dbUpdate(db, 'bk_topik', { nama: nama.trim() }, { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/bk')
  return { success: 'Topik berhasil diperbarui.' }
}

export async function hapusTopikBK(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'bk_topik', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/bk')
  return { success: 'Topik berhasil dihapus.' }
}

// ============================================================
// 3. REKAMAN BK
// ============================================================

export async function searchSiswaBinaan(guru_bk_id: string, query: string, tahun_ajaran_id: string) {
  if (query.trim().length < 2) return []
  const db = await getDB()
  const binaanRes = await db.prepare(
    'SELECT kelas_id FROM kelas_binaan_bk WHERE guru_bk_id = ? AND tahun_ajaran_id = ?'
  ).bind(guru_bk_id, tahun_ajaran_id).all<{ kelas_id: string }>()
  const kelasIds = (binaanRes.results || []).map(r => r.kelas_id)
  if (kelasIds.length === 0) return []
  const placeholders = kelasIds.map(() => '?').join(',')
  const res = await db.prepare(`
    SELECT s.id, s.nisn, s.nama_lengkap, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM siswa s
    JOIN kelas k ON s.kelas_id = k.id
    WHERE s.kelas_id IN (${placeholders})
      AND s.status = 'aktif'
      AND (LOWER(s.nama_lengkap) LIKE LOWER(?) OR s.nisn LIKE ?)
    ORDER BY s.nama_lengkap ASC
    LIMIT 15
  `).bind(...kelasIds, `%${query}%`, `%${query}%`).all<any>()
  return res.results || []
}

export async function getRekamanSiswa(siswa_id: string, tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT r.id, r.bidang, r.topik_id, r.deskripsi, r.penanganan, r.tindak_lanjut, r.catatan_tindak_lanjut,
      r.created_at, r.updated_at,
      t.nama as topik_nama,
      u.nama_lengkap as guru_nama
    FROM bk_rekaman r
    LEFT JOIN bk_topik t ON r.topik_id = t.id
    LEFT JOIN "user" u ON r.guru_bk_id = u.id
    WHERE r.siswa_id = ? AND r.tahun_ajaran_id = ?
    ORDER BY r.created_at DESC
  `).bind(siswa_id, tahun_ajaran_id).all<any>()
  return (res.results || []).map((r: any) => ({
    ...r,
    penanganan: (() => { try { return JSON.parse(r.penanganan || '[]') } catch { return [] } })(),
  }))
}

export async function tambahRekamanBK(payload: {
  siswa_id: string; guru_bk_id: string; tahun_ajaran_id: string
  bidang: BidangBK; topik_id: string | null; deskripsi: string
  tindak_lanjut: TindakLanjut; catatan_tindak_lanjut?: string
}) {
  const db = await getDB()
  // Validasi akses: siswa harus dari kelas binaan guru BK di TA ini
  const binaanRes = await db.prepare(
    'SELECT kelas_id FROM kelas_binaan_bk WHERE guru_bk_id = ? AND tahun_ajaran_id = ?'
  ).bind(payload.guru_bk_id, payload.tahun_ajaran_id).all<{ kelas_id: string }>()
  const kelasIds = new Set((binaanRes.results || []).map(r => r.kelas_id))
  const siswa = await db.prepare('SELECT kelas_id FROM siswa WHERE id = ?').bind(payload.siswa_id).first<{ kelas_id: string }>()
  if (!siswa || !kelasIds.has(siswa.kelas_id)) return { error: 'Siswa ini bukan dari kelas binaan Anda.' }
  const result = await dbInsert(db, 'bk_rekaman', {
    siswa_id: payload.siswa_id, guru_bk_id: payload.guru_bk_id,
    tahun_ajaran_id: payload.tahun_ajaran_id, bidang: payload.bidang,
    topik_id: payload.topik_id || null, deskripsi: payload.deskripsi || '',
    penanganan: '[]', tindak_lanjut: payload.tindak_lanjut || '',
    catatan_tindak_lanjut: payload.catatan_tindak_lanjut || '',
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/bk')
  return { success: 'Rekaman BK berhasil disimpan.', id: (result.data as any)?.id }
}

export async function editRekamanBK(id: string, payload: {
  topik_id?: string | null; deskripsi?: string; tindak_lanjut?: TindakLanjut; catatan_tindak_lanjut?: string
}) {
  const db = await getDB()
  const result = await dbUpdate(db, 'bk_rekaman', { ...payload, updated_at: new Date().toISOString() }, { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/bk')
  return { success: 'Rekaman berhasil diperbarui.' }
}

export async function hapusRekamanBK(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'bk_rekaman', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/bk')
  return { success: 'Rekaman berhasil dihapus.' }
}

export async function tambahSesiPenanganan(rekaman_id: string, tipe: TipePenanganan, tanggal: string, catatan: string) {
  const db = await getDB()
  const row = await db.prepare('SELECT penanganan FROM bk_rekaman WHERE id = ?').bind(rekaman_id).first<{ penanganan: string }>()
  if (!row) return { error: 'Rekaman tidak ditemukan.' }
  let sesiList: SesiPenanganan[] = []
  try { sesiList = JSON.parse(row.penanganan || '[]') } catch {}
  const sesiId = crypto.randomUUID().replace(/-/g, '').substring(0, 8)
  sesiList.push({ id: sesiId, tipe, tanggal, catatan: catatan || '' })
  await db.prepare("UPDATE bk_rekaman SET penanganan = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(sesiList), rekaman_id).run()
  revalidatePath('/dashboard/bk')
  return { success: 'Sesi penanganan ditambahkan.' }
}

export async function hapusSesiPenanganan(rekaman_id: string, sesi_id: string) {
  const db = await getDB()
  const row = await db.prepare('SELECT penanganan FROM bk_rekaman WHERE id = ?').bind(rekaman_id).first<{ penanganan: string }>()
  if (!row) return { error: 'Rekaman tidak ditemukan.' }
  let sesiList: SesiPenanganan[] = []
  try { sesiList = JSON.parse(row.penanganan || '[]') } catch {}
  sesiList = sesiList.filter(s => s.id !== sesi_id)
  await db.prepare("UPDATE bk_rekaman SET penanganan = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(sesiList), rekaman_id).run()
  revalidatePath('/dashboard/bk')
  return { success: 'Sesi dihapus.' }
}

// ============================================================
// 4. LIST SISWA BERREKAMAN (tabel utama, paginated)
// ============================================================
export async function getListSiswaBerrekaman(
  guru_bk_id: string, tahun_ajaran_id: string, is_admin: boolean,
  filter: { bidang?: BidangBK | ''; tindak_lanjut?: TindakLanjut | ''; kelas_id?: string },
  page: number = 1, pageSize: number = 10
) {
  const db = await getDB()
  const conditions: string[] = ['r.tahun_ajaran_id = ?']
  const params: any[] = [tahun_ajaran_id]

  if (!is_admin) {
    const binaanRes = await db.prepare(
      'SELECT kelas_id FROM kelas_binaan_bk WHERE guru_bk_id = ? AND tahun_ajaran_id = ?'
    ).bind(guru_bk_id, tahun_ajaran_id).all<{ kelas_id: string }>()
    const kelasIds = (binaanRes.results || []).map(r => r.kelas_id)
    if (kelasIds.length === 0) return { rows: [], total: 0 }
    if (filter.kelas_id) {
      if (!kelasIds.includes(filter.kelas_id)) return { rows: [], total: 0 }
      conditions.push('s.kelas_id = ?')
      params.push(filter.kelas_id)
    } else {
      conditions.push(`s.kelas_id IN (${kelasIds.map(() => '?').join(',')})`)
      params.push(...kelasIds)
    }
  } else if (filter.kelas_id) {
    conditions.push('s.kelas_id = ?')
    params.push(filter.kelas_id)
  }

  if (filter.bidang) { conditions.push('r.bidang = ?'); params.push(filter.bidang) }
  if (filter.tindak_lanjut) { conditions.push('r.tindak_lanjut = ?'); params.push(filter.tindak_lanjut) }

  const where = conditions.join(' AND ')
  const countRes = await db.prepare(`
    SELECT COUNT(DISTINCT r.siswa_id) as total FROM bk_rekaman r
    JOIN siswa s ON r.siswa_id = s.id WHERE ${where}
  `).bind(...params).first<{ total: number }>()
  const total = countRes?.total ?? 0
  const offset = (page - 1) * pageSize
  const rows = await db.prepare(`
    SELECT s.id as siswa_id, s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok,
      COUNT(r.id) as jumlah_rekaman,
      MAX(r.created_at) as rekaman_terakhir,
      GROUP_CONCAT(DISTINCT r.bidang) as bidang_list,
      SUM(CASE WHEN NULLIF(TRIM(r.tindak_lanjut), '') IS NOT NULL THEN 1 ELSE 0 END) as tindak_lanjut_count
    FROM bk_rekaman r
    JOIN siswa s ON r.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE ${where}
    GROUP BY s.id, s.nama_lengkap, s.nisn, s.foto_url, k.tingkat, k.nomor_kelas, k.kelompok
    ORDER BY MAX(r.created_at) DESC
    LIMIT ? OFFSET ?
  `).bind(...params, pageSize, offset).all<any>()
  return { rows: rows.results || [], total }
}

// ============================================================
// 5. LAPORAN PDF BK
// ============================================================

export async function getLaporanBKSiswa(siswa_id: string, tahun_ajaran_id: string, guru_bk_id: string, is_admin: boolean) {
  const db = await getDB()
  try {
    const siswa = await db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn,
        k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE s.id = ?
      LIMIT 1
    `).bind(siswa_id).first<any>()
    if (!siswa) return { error: 'Siswa tidak ditemukan.' }
    if (!is_admin && siswa.kelas_id && !(await isKelasBinaan(db, guru_bk_id, tahun_ajaran_id, siswa.kelas_id))) {
      return { error: 'Anda tidak memiliki akses laporan siswa ini.' }
    }

    const ta = await db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE id = ? LIMIT 1').bind(tahun_ajaran_id).first<any>()
    if (!ta) return { error: 'Tahun ajaran tidak ditemukan.' }

    const guru = await getGuruBKPenandaTangan(db, guru_bk_id, tahun_ajaran_id, is_admin, siswa.kelas_id)
    if (!guru) return { error: 'Data Guru BK penanda tangan tidak ditemukan.' }

    const rekamanRes = await db.prepare(`
      SELECT r.id, r.siswa_id, r.bidang, r.deskripsi, r.penanganan,
        r.tindak_lanjut, r.catatan_tindak_lanjut, r.created_at, r.updated_at,
        t.nama as topik_nama,
        u.nama_lengkap as guru_nama
      FROM bk_rekaman r
      LEFT JOIN bk_topik t ON r.topik_id = t.id
      LEFT JOIN "user" u ON r.guru_bk_id = u.id
      WHERE r.siswa_id = ? AND r.tahun_ajaran_id = ?
      ORDER BY r.created_at DESC
    `).bind(siswa_id, tahun_ajaran_id).all<any>()

    const laporan: LaporanBKSiswa = {
      siswa: {
        id: siswa.id,
        nama_lengkap: siswa.nama_lengkap,
        nisn: siswa.nisn,
        tingkat: siswa.tingkat,
        nomor_kelas: siswa.nomor_kelas,
        kelas_kelompok: siswa.kelas_kelompok,
      },
      ta,
      guru_bk: guru,
      rekaman: (rekamanRes.results || []).map((r: any) => ({
        id: r.id,
        siswa_id: r.siswa_id,
        bidang: r.bidang,
        topik_nama: r.topik_nama,
        deskripsi: r.deskripsi || '',
        penanganan: parsePenanganan(r.penanganan),
        tindak_lanjut: r.tindak_lanjut || '',
        catatan_tindak_lanjut: r.catatan_tindak_lanjut || '',
        created_at: r.created_at,
        updated_at: r.updated_at,
        guru_nama: r.guru_nama || null,
      })),
    }
    return { data: laporan }
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal mengambil data laporan siswa.' }
  }
}

export async function getLaporanBKKelas(kelas_id: string, tahun_ajaran_id: string, guru_bk_id: string, is_admin: boolean) {
  const db = await getDB()
  try {
    if (!is_admin && !(await isKelasBinaan(db, guru_bk_id, tahun_ajaran_id, kelas_id))) {
      return { error: 'Anda tidak memiliki akses laporan kelas ini.' }
    }

    const [kelas, ta, guru] = await Promise.all([
      db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas WHERE id = ? LIMIT 1').bind(kelas_id).first<any>(),
      db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE id = ? LIMIT 1').bind(tahun_ajaran_id).first<any>(),
      getGuruBKPenandaTangan(db, guru_bk_id, tahun_ajaran_id, is_admin, kelas_id),
    ])
    if (!kelas) return { error: 'Kelas tidak ditemukan.' }
    if (!ta) return { error: 'Tahun ajaran tidak ditemukan.' }
    if (!guru) return { error: 'Data Guru BK penanda tangan tidak ditemukan.' }

    const rowsRes = await db.prepare(`
      SELECT s.id as siswa_id, s.nama_lengkap, s.nisn,
        r.id as rekaman_id, r.bidang, r.deskripsi, r.penanganan, r.tindak_lanjut,
        r.created_at, t.nama as topik_nama
      FROM bk_rekaman r
      JOIN siswa s ON r.siswa_id = s.id
      LEFT JOIN bk_topik t ON r.topik_id = t.id
      WHERE s.kelas_id = ? AND r.tahun_ajaran_id = ?
      ORDER BY s.nama_lengkap ASC, r.created_at DESC
    `).bind(kelas_id, tahun_ajaran_id).all<any>()

    const siswaMap = new Map<string, LaporanBKKelas['siswa'][number] & { bidangSet: Set<string> }>()
    for (const row of rowsRes.results || []) {
      if (!siswaMap.has(row.siswa_id)) {
        siswaMap.set(row.siswa_id, {
          id: row.siswa_id,
          nama_lengkap: row.nama_lengkap,
          nisn: row.nisn,
          jumlah_rekaman: 0,
          bidang_list: '',
          rekaman_terakhir: null,
          tindak_lanjut_count: 0,
          sesi_count: 0,
          ringkasan_terakhir: null,
          topik_terakhir: null,
          bidangSet: new Set<string>(),
        })
      }
      const item = siswaMap.get(row.siswa_id)!
      item.jumlah_rekaman += 1
      item.bidangSet.add(row.bidang)
      item.sesi_count += parsePenanganan(row.penanganan).length
      if (String(row.tindak_lanjut || '').trim()) item.tindak_lanjut_count += 1
      if (!item.rekaman_terakhir || String(row.created_at) > String(item.rekaman_terakhir)) {
        item.rekaman_terakhir = row.created_at
        item.ringkasan_terakhir = row.deskripsi || null
        item.topik_terakhir = row.topik_nama || null
      }
    }

    const siswa = Array.from(siswaMap.values()).map(({ bidangSet, ...row }) => ({
      ...row,
      bidang_list: Array.from(bidangSet).join(', '),
    }))

    const laporan: LaporanBKKelas = { kelas, ta, guru_bk: guru, siswa }
    return { data: laporan }
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal mengambil data laporan kelas.' }
  }
}

// ============================================================
// 6. SINKRONISASI & VIEW PER GURU BK
// ============================================================

export async function sinkronKelasBinaanDariPenugasan() {
  const db = await getDB()
  try {
    const ta = await getTaAktif(db)
    if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.' }

    const res = await db.prepare(`
      SELECT DISTINCT pm.guru_id, pm.kelas_id
      FROM penugasan_mengajar pm
      JOIN "user" u ON pm.guru_id = u.id
      WHERE u.role = 'guru_bk' AND pm.tahun_ajaran_id = ?
    `).bind(ta.id).all<{ guru_id: string; kelas_id: string }>()

    const rows = res.results || []
    if (rows.length === 0) return { error: 'Tidak ada penugasan guru BK di semester aktif.' }

    // Hapus binaan TA ini saja, bukan semua TA
    await db.prepare('DELETE FROM kelas_binaan_bk WHERE tahun_ajaran_id = ?').bind(ta.id).run()

    const CHUNK = 10
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const placeholders = chunk.map(() => `(lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))`).join(', ')
      const values = chunk.flatMap(r => [r.guru_id, r.kelas_id, ta.id])
      await db.prepare(
        `INSERT OR IGNORE INTO kelas_binaan_bk (id, guru_bk_id, kelas_id, tahun_ajaran_id, created_at) VALUES ${placeholders}`
      ).bind(...values).run()
    }

    revalidatePath('/', 'layout')
    return { success: `Sinkronisasi selesai: ${rows.length} kelas binaan untuk TA ${ta.nama} Smt ${ta.semester}.` }
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal sinkronisasi.' }
  }
}

export async function getKelasBinaanPerGuru(tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT u.id as guru_id, u.nama_lengkap as guru_nama,
      k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM kelas_binaan_bk kb
    JOIN "user" u ON kb.guru_bk_id = u.id
    JOIN kelas k ON kb.kelas_id = k.id
    WHERE kb.tahun_ajaran_id = ?
    ORDER BY u.nama_lengkap ASC, k.tingkat ASC, k.nomor_kelas ASC
  `).bind(tahun_ajaran_id).all<any>()
  const map = new Map<string, { guru_id: string; guru_nama: string; kelas_list: any[] }>()
  for (const row of res.results || []) {
    if (!map.has(row.guru_id)) map.set(row.guru_id, { guru_id: row.guru_id, guru_nama: row.guru_nama, kelas_list: [] })
    map.get(row.guru_id)!.kelas_list.push({ id: row.kelas_id, tingkat: row.tingkat, nomor_kelas: row.nomor_kelas, kelompok: row.kelompok })
  }
  return Array.from(map.values())
}

// ============================================================
// 7. DATA UNTUK PAGE
// ============================================================
export async function getInitialDataBK(guru_bk_id: string, is_admin: boolean) {
  const db = await getDB()
  const [taAktif, topikAll] = await Promise.all([
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>(),
    db.prepare('SELECT id, bidang, nama FROM bk_topik ORDER BY bidang ASC, nama ASC').all<any>(),
  ])

  const kelasBinaan = is_admin
    ? await db.prepare(`
        SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok,
          u.nama_lengkap as guru_bk_nama
        FROM kelas k
        LEFT JOIN kelas_binaan_bk kb ON k.id = kb.kelas_id
          AND (kb.tahun_ajaran_id = ? OR ? IS NULL)
        LEFT JOIN "user" u ON kb.guru_bk_id = u.id
        ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC
      `).bind(taAktif?.id ?? null, taAktif?.id ?? null).all<any>()
    : taAktif
      ? await db.prepare(`
          SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok
          FROM kelas_binaan_bk kb
          JOIN kelas k ON kb.kelas_id = k.id
          WHERE kb.guru_bk_id = ? AND kb.tahun_ajaran_id = ?
          ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC
        `).bind(guru_bk_id, taAktif.id).all<any>()
      : { results: [] }

  return {
    taAktif: taAktif ?? null,
    topikAll: topikAll.results || [],
    kelasBinaan: kelasBinaan.results || [],
  }
}
