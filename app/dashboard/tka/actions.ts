// Lokasi: app/dashboard/tka/actions.ts
'use server'

import { getDB } from '@/utils/db-server'
import { revalidatePath } from 'next/cache'
import { getMemCache, setMemCache, clearMemCachePrefix } from '@/utils/mem-cache'
import { KAMPUS_BY_ID, PRODI_BY_KAMPUS } from '@/lib/pendidikan-lanjutan'
import type { RencanaKategori } from '@/lib/pendidikan-lanjutan'
import { assertClassScope, assertStudentScope, isAdministrativeActor, requireActionAccess } from '@/lib/action-security'
import { publicServerError } from '@/lib/security-log'
import { ensureParentPortalEnhancementSchema } from '@/lib/parent-portal-schema'
import {
  fingerprintParentTkaSelection,
  isParentTkaSelectionComplete,
  normalizeParentTkaSelection,
  resolveParentTkaApprovalStatus,
} from '@/lib/parent-tka'
import type { ParentTkaApprovalStatus } from '@/lib/parent-tka'

export type KelasItem = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  wali_kelas_id: string | null
}

export type TkaMapelRow = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  kelas_id: string | null
  mapel_pilihan1: string | null
  mapel_pilihan2: string | null
  rencana_kategori: RencanaKategori | null
  rencana_catatan: string | null
  pilihan1_kampus_id: string | null
  pilihan1_kampus_nama: string | null
  pilihan1_prodi: string | null
  pilihan2_kampus_id: string | null
  pilihan2_kampus_nama: string | null
  pilihan2_prodi: string | null
}

export type TkaSiswaRekapRow = {
  siswa_id: string
  nisn: string
  nama_lengkap: string
  jenis_kelamin: string
  kelas_id: string | null
  tingkat: number | null
  nomor_kelas: string | null
  kelompok: string | null
  mapel_pilihan1: string | null
  mapel_pilihan2: string | null
  rencana_kategori: RencanaKategori | null
  rencana_catatan: string | null
  pilihan1_kampus_id: string | null
  pilihan1_kampus_nama: string | null
  pilihan1_prodi: string | null
  pilihan2_kampus_id: string | null
  pilihan2_kampus_nama: string | null
  pilihan2_prodi: string | null
}

export type TkaRekapItem = {
  mapel: string
  jumlah: number
}

export type RencanaRekapItem = { kategori: RencanaKategori; jumlah: number }

export type TkaParentApprovalStatus = ParentTkaApprovalStatus

export type TkaParentApprovalRow = TkaSiswaRekapRow & {
  has_data: boolean
  is_complete: boolean
  approval_status: TkaParentApprovalStatus
  approved_at: string | null
}

export type RekapFilter = {
  kelas_id?: string
  mapel?: string
  search?: string
  rencana?: RencanaKategori
  kampus_id?: string
  prodi?: string
}

export type TkaSaveItem = {
  siswa_id: string
  mapel_pilihan1: string | null
  mapel_pilihan2: string | null
  rencana_kategori: RencanaKategori
  rencana_catatan: string | null
  pilihan1_kampus_id: string | null
  pilihan1_prodi: string | null
  pilihan2_kampus_id: string | null
  pilihan2_prodi: string | null
}

const pendidikanSelectColumns = `
  COALESCE(rpl.kategori, 'KULIAH') as rencana_kategori,
  rpl.catatan as rencana_catatan,
  pp1.kampus_id as pilihan1_kampus_id,
  pp1.kampus_nama as pilihan1_kampus_nama,
  pp1.program_studi as pilihan1_prodi,
  pp2.kampus_id as pilihan2_kampus_id,
  pp2.kampus_nama as pilihan2_kampus_nama,
  pp2.program_studi as pilihan2_prodi`

const pendidikanJoins = `
  LEFT JOIN penerimaan_pt pp1 ON pp1.siswa_id = s.id
    AND pp1.tahun_ajaran_id = ? AND pp1.jenis_data = 'PILIHAN_TKA' AND pp1.pilihan_ke = 1
  LEFT JOIN penerimaan_pt pp2 ON pp2.siswa_id = s.id
    AND pp2.tahun_ajaran_id = ? AND pp2.jenis_data = 'PILIHAN_TKA' AND pp2.pilihan_ke = 2
  LEFT JOIN rencana_pasca_lulus rpl ON rpl.siswa_id = s.id AND rpl.tahun_ajaran_id = ?`

// ============================================================
// CACHE KEYS (TKA)
// ============================================================
const CACHE_TTL = 60_000 // 60 detik
const rekapJumlahKey = (taId: string, actorId: string) => `tka:rekap:jumlah:v2:${taId}:${actorId}`
const rekapSiswaKey = (taId: string, actorId: string, filter: RekapFilter) =>
  `tka:rekap:siswa:${taId}:${actorId}:${JSON.stringify(filter)}`

// ============================================================
// INITIAL DATA (2 query paralel — kelas 12 saja)
// ============================================================
export async function getInitialDataTka() {
  const actor = await requireActionAccess('tka', 'read')
  if (actor.kind !== 'staff') return { tahunAjaranAktif: null, kelasList: [] }
  const db = await getDB()
  const restricted = !isAdministrativeActor(actor)

  const [taRes, kelasRes] = await Promise.all([
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string; nama: string; semester: string }>(),
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
      FROM kelas k
      WHERE k.tingkat = 12
        ${restricted ? `AND (
          k.wali_kelas_id = ?
          OR EXISTS (SELECT 1 FROM kelas_binaan_bk kb WHERE kb.kelas_id = k.id AND kb.guru_bk_id = ?)
          OR EXISTS (SELECT 1 FROM penugasan_mengajar pm WHERE pm.kelas_id = k.id AND pm.guru_id = ?)
        )` : ''}
      ORDER BY k.tingkat ASC, k.nomor_kelas ASC, k.kelompok ASC
    `).bind(...(restricted ? [actor.id, actor.id, actor.id] : [])).all<KelasItem>(),
  ])

  return {
    tahunAjaranAktif: taRes,
    kelasList: kelasRes.results || [],
  }
}

// ============================================================
// GET SISWA BY KELAS (lazy load)
// ============================================================
export async function getSiswaByKelasForTka(kelasId: string, tahunAjaranId: string) {
  const actor = await requireActionAccess('tka', 'read')
  await assertClassScope(actor, kelasId, 'tka')
  const db = await getDB()

  // Query utama: siswa yang punya kelas_id langsung
  const rows = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2,
      ${pendidikanSelectColumns}
    FROM siswa s
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    ${pendidikanJoins}
    WHERE s.kelas_id = ? AND s.status = 'aktif'
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
  `).bind(tahunAjaranId, tahunAjaranId, tahunAjaranId, tahunAjaranId, kelasId).all<TkaMapelRow>()

  if (rows.results && rows.results.length > 0) {
    return rows.results
  }

  // Fallback: cari lewat riwayat_kelas (sistem multi-tahun ajaran)
  const fallback = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2,
      ${pendidikanSelectColumns}
    FROM riwayat_kelas rk
    JOIN siswa s ON s.id = rk.siswa_id
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    ${pendidikanJoins}
    WHERE rk.kelas_id = ? AND rk.tahun_ajaran_id = ? AND s.status = 'aktif'
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
  `).bind(tahunAjaranId, tahunAjaranId, tahunAjaranId, tahunAjaranId, kelasId, tahunAjaranId).all<TkaMapelRow>()

  return fallback.results || []
}

// ============================================================
// SEARCH SISWA KELAS 12 (lazy, enter-triggered)
// ============================================================
export async function searchSiswaKelas12ForTka(query: string, tahunAjaranId: string) {
  const actor = await requireActionAccess('tka', 'read')
  if (actor.kind !== 'staff' || query.trim().length < 2 || query.length > 100) return []
  const db = await getDB()
  const like = `%${query}%`
  const restricted = !isAdministrativeActor(actor)
  const scopeSql = restricted ? `AND (
    k.wali_kelas_id = ?
    OR EXISTS (SELECT 1 FROM kelas_binaan_bk kb WHERE kb.kelas_id = k.id AND kb.guru_bk_id = ?)
    OR EXISTS (SELECT 1 FROM penugasan_mengajar pm WHERE pm.kelas_id = k.id AND pm.guru_id = ?)
  )` : ''
  const scopeParams = restricted ? [actor.id, actor.id, actor.id] : []

  // Query: siswa aktif di kelas tingkat 12, dengan fallback riwayat_kelas
  const rows = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2,
      ${pendidikanSelectColumns}
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    ${pendidikanJoins}
    WHERE s.status = 'aktif'
      AND k.tingkat = 12
      AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
      ${scopeSql}
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
    LIMIT 50
  `).bind(tahunAjaranId, tahunAjaranId, tahunAjaranId, tahunAjaranId, like, like, ...scopeParams).all<TkaMapelRow>()

  if (rows.results && rows.results.length > 0) {
    return rows.results
  }

  // Fallback: siswa yang ada di riwayat kelas 12 tahun ajaran ini
  const fallback = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2,
      ${pendidikanSelectColumns}
    FROM siswa s
    JOIN riwayat_kelas rk ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = ?
    JOIN kelas k ON k.id = rk.kelas_id
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    ${pendidikanJoins}
    WHERE s.status = 'aktif'
      AND k.tingkat = 12
      AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
      ${scopeSql}
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
    LIMIT 50
  `).bind(tahunAjaranId, tahunAjaranId, tahunAjaranId, tahunAjaranId, tahunAjaranId, like, like, ...scopeParams).all<TkaMapelRow>()

  return fallback.results || []
}

// ============================================================
// BATCH SAVE MAPEL PILIHAN
// ============================================================
export async function batchSaveMapelPilihan(
  items: TkaSaveItem[],
  tahunAjaranId: string
) {
  const actor = await requireActionAccess('tka', 'update')
  if (items.length === 0) return { success: true, saved: 0 }
  if (!Array.isArray(items) || items.length > 100) return { success: false, error: 'Maksimal 100 siswa per penyimpanan.' }
  await Promise.all(items.map(item => assertStudentScope(actor, item.siswa_id, 'tka')))
  const db = await getDB()

  const itemStatements = items.map(item => {
    const kategori = item.rencana_kategori || 'KULIAH'
    const note = item.rencana_catatan?.trim() || null
    if (kategori === 'LAINNYA' && !note) throw new Error('Catatan wajib diisi untuk rencana Lainnya.')

    const choices = [
      { slot: 1, kampusId: item.pilihan1_kampus_id, prodi: item.pilihan1_prodi },
      { slot: 2, kampusId: item.pilihan2_kampus_id, prodi: item.pilihan2_prodi },
    ] as const
    if (kategori === 'KULIAH') {
      const filled = choices.filter(choice => choice.kampusId)
      for (const choice of filled) {
        const kampus = KAMPUS_BY_ID.get(choice.kampusId!)
        if (!kampus) throw new Error('Perguruan tinggi tidak valid.')
        const availableProdi = PRODI_BY_KAMPUS[choice.kampusId!] ?? []
        if (availableProdi.length > 0 && !choice.prodi) {
          throw new Error(`Program studi wajib dipilih untuk ${kampus.nama}.`)
        }
        if (choice.prodi && availableProdi.length > 0 && !availableProdi.some(prodi => prodi.nama === choice.prodi)) {
          throw new Error(`Program studi tidak valid untuk ${kampus.nama}.`)
        }
      }
      if (filled.length === 2 && filled[0].kampusId === filled[1].kampusId && filled[0].prodi === filled[1].prodi) {
        throw new Error('Pilihan pendidikan 1 dan 2 tidak boleh sama.')
      }
    }

    const statements = [db.prepare(`
      INSERT INTO tka_mapel_pilihan (siswa_id, tahun_ajaran_id, mapel_pilihan1, mapel_pilihan2, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET
        mapel_pilihan1 = excluded.mapel_pilihan1,
        mapel_pilihan2 = excluded.mapel_pilihan2,
        updated_at = excluded.updated_at
    `).bind(item.siswa_id, tahunAjaranId, item.mapel_pilihan1 ?? null, item.mapel_pilihan2 ?? null)]

    statements.push(db.prepare('DELETE FROM rencana_pasca_lulus WHERE siswa_id = ? AND tahun_ajaran_id = ?')
      .bind(item.siswa_id, tahunAjaranId))
    statements.push(db.prepare("DELETE FROM penerimaan_pt WHERE siswa_id = ? AND tahun_ajaran_id = ? AND jenis_data = 'PILIHAN_TKA'")
      .bind(item.siswa_id, tahunAjaranId))

    if (kategori !== 'KULIAH') {
      statements.push(db.prepare(`
        INSERT INTO rencana_pasca_lulus (siswa_id, tahun_ajaran_id, kategori, catatan, updated_at)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `).bind(item.siswa_id, tahunAjaranId, kategori, note))
    } else {
      for (const choice of choices) {
        if (!choice.kampusId) continue
        const kampus = KAMPUS_BY_ID.get(choice.kampusId)!
        statements.push(db.prepare(`
          INSERT INTO penerimaan_pt (
            siswa_id, tahun_ajaran_id, jalur, kampus_id, kampus_nama, program_studi,
            status, catatan, jenis_data, pilihan_ke, updated_at
          ) VALUES (?, ?, 'PILIHAN_TKA', ?, ?, ?, 'RENCANA', NULL, 'PILIHAN_TKA', ?, datetime('now', 'localtime'))
        `).bind(item.siswa_id, tahunAjaranId, kampus.id, kampus.nama, choice.prodi || null, choice.slot))
      }
    }
    return statements
  })

  try {
    // Chunking per 100 (batasan batch D1)
    const chunkSize = 50
    for (let i = 0; i < itemStatements.length; i += chunkSize) {
      await db.batch(itemStatements.slice(i, i + chunkSize).flat())
    }
    // Invalidate cache rekap agar data baru langsung terbaca
    clearMemCachePrefix('tka:')
    revalidatePath('/dashboard/tka')
    return { success: true, saved: items.length }
  } catch (error) {
    const safeError = publicServerError('tka.batch_save', error)
    return { success: false, ...safeError }
  }
}

// ============================================================
// REKAP JUMLAH MAPEL PILIHAN GABUNGAN — urutan input tidak membedakan prioritas
// ============================================================
export async function getRekapMapelPilihan(tahunAjaranId: string) {
  const actor = await requireActionAccess('tka', 'read')
  if (actor.kind !== 'staff') return []
  const cacheKey = rekapJumlahKey(tahunAjaranId, actor.id)
  const cached = getMemCache<TkaRekapItem[]>(cacheKey)
  if (cached) return cached

  const db = await getDB()
  const restricted = !isAdministrativeActor(actor)
  const scopeSql = restricted ? `AND EXISTS (
    SELECT 1 FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.id = tka_mapel_pilihan.siswa_id AND (
      k.wali_kelas_id = ?
      OR EXISTS (SELECT 1 FROM kelas_binaan_bk kb WHERE kb.kelas_id = s.kelas_id AND kb.guru_bk_id = ?)
      OR EXISTS (SELECT 1 FROM penugasan_mengajar pm WHERE pm.kelas_id = s.kelas_id AND pm.guru_id = ?)
    )
  )` : ''
  const scopeParams = restricted ? [actor.id, actor.id, actor.id] : []

  const rekap = await db.prepare(`
    SELECT pilihan.mapel, COUNT(DISTINCT pilihan.siswa_id) AS jumlah
    FROM (
      SELECT siswa_id, mapel_pilihan1 AS mapel
      FROM tka_mapel_pilihan
      WHERE tahun_ajaran_id = ? AND mapel_pilihan1 IS NOT NULL AND mapel_pilihan1 != ''
      ${scopeSql}
      UNION ALL
      SELECT siswa_id, mapel_pilihan2 AS mapel
      FROM tka_mapel_pilihan
      WHERE tahun_ajaran_id = ? AND mapel_pilihan2 IS NOT NULL AND mapel_pilihan2 != ''
      ${scopeSql}
    ) pilihan
    GROUP BY pilihan.mapel
    ORDER BY jumlah DESC, pilihan.mapel ASC
  `).bind(tahunAjaranId, ...scopeParams, tahunAjaranId, ...scopeParams).all<TkaRekapItem>()

  const result = rekap.results || []
  setMemCache(cacheKey, result, CACHE_TTL)
  return result
}

export async function getRekapRencanaPascaLulus(tahunAjaranId: string) {
  const actor = await requireActionAccess('tka', 'read')
  if (actor.kind !== 'staff') return []
  const db = await getDB()
  const restricted = !isAdministrativeActor(actor)
  const result = await db.prepare(`
    SELECT COALESCE(r.kategori, 'KULIAH') kategori, COUNT(DISTINCT tmp.siswa_id) jumlah
    FROM tka_mapel_pilihan tmp
    LEFT JOIN rencana_pasca_lulus r
      ON r.siswa_id = tmp.siswa_id AND r.tahun_ajaran_id = tmp.tahun_ajaran_id
    WHERE tmp.tahun_ajaran_id = ?
      ${restricted ? `AND EXISTS (
        SELECT 1 FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
        WHERE s.id = tmp.siswa_id AND (
          k.wali_kelas_id = ?
          OR EXISTS (SELECT 1 FROM kelas_binaan_bk kb WHERE kb.kelas_id = s.kelas_id AND kb.guru_bk_id = ?)
          OR EXISTS (SELECT 1 FROM penugasan_mengajar pm WHERE pm.kelas_id = s.kelas_id AND pm.guru_id = ?)
        )
      )` : ''}
    GROUP BY COALESCE(r.kategori, 'KULIAH')
    ORDER BY jumlah DESC
  `).bind(tahunAjaranId, ...(restricted ? [actor.id, actor.id, actor.id] : [])).all<RencanaRekapItem>()
  return result.results || []
}

// ============================================================
// REKAP SISWA (dipakai tabel rekap + data cetak) — di-cache per filter
// Satu query ber-index; paginasi & natural sort dilakukan di client
// (skala data kecil: siswa kelas 12, maks ~300 baris).
// ============================================================
export async function getSiswaRekapTka(tahunAjaranId: string, filter: RekapFilter = {}) {
  const actor = await requireActionAccess('tka', 'read')
  if (actor.kind !== 'staff') return []
  const cacheKey = rekapSiswaKey(tahunAjaranId, actor.id, filter)
  const cached = getMemCache<TkaSiswaRekapRow[]>(cacheKey)
  if (cached) return cached

  const db = await getDB()

  const conditions: string[] = ['tmp.tahun_ajaran_id = ?']
  const params: any[] = [tahunAjaranId]

  if (!isAdministrativeActor(actor)) {
    conditions.push(`(
      k.wali_kelas_id = ?
      OR EXISTS (SELECT 1 FROM kelas_binaan_bk kb WHERE kb.kelas_id = COALESCE(s.kelas_id, rk.kelas_id) AND kb.guru_bk_id = ?)
      OR EXISTS (SELECT 1 FROM penugasan_mengajar pm WHERE pm.kelas_id = COALESCE(s.kelas_id, rk.kelas_id) AND pm.guru_id = ?)
    )`)
    params.push(actor.id, actor.id, actor.id)
  }

  const { kelas_id, mapel, search, rencana, kampus_id, prodi } = filter

  if (mapel) {
    conditions.push('(tmp.mapel_pilihan1 = ? OR tmp.mapel_pilihan2 = ?)')
    params.push(mapel, mapel)
  }

  if (kelas_id) {
    conditions.push('(s.kelas_id = ? OR rk.kelas_id = ?)')
    params.push(kelas_id, kelas_id)
  }

  if (search) {
    if (search.length > 100) return []
    conditions.push('(s.nama_lengkap LIKE ? OR s.nisn LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  if (rencana) {
    if (rencana === 'KULIAH') conditions.push('rpl.kategori IS NULL')
    else { conditions.push('rpl.kategori = ?'); params.push(rencana) }
  }
  if (kampus_id) {
    conditions.push('(pp1.kampus_id = ? OR pp2.kampus_id = ?)')
    params.push(kampus_id, kampus_id)
  }
  if (prodi) {
    conditions.push('(pp1.program_studi = ? OR pp2.program_studi = ?)')
    params.push(prodi, prodi)
  }

  const where = conditions.join(' AND ')

  const res = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nisn,
      s.nama_lengkap,
      s.jenis_kelamin,
      s.kelas_id,
      COALESCE(k.tingkat, rk.kelas_tingkat) as tingkat,
      COALESCE(k.nomor_kelas, rk.kelas_nomor) as nomor_kelas,
      COALESCE(k.kelompok, rk.kelas_kelompok) as kelompok,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2,
      ${pendidikanSelectColumns}
    FROM tka_mapel_pilihan tmp
    JOIN siswa s ON s.id = tmp.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN riwayat_kelas rk
      ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = tmp.tahun_ajaran_id
    ${pendidikanJoins}
    WHERE ${where}
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
  `).bind(tahunAjaranId, tahunAjaranId, tahunAjaranId, ...params).all<TkaSiswaRekapRow>()

  const rows = res.results || []
  setMemCache(cacheKey, rows, CACHE_TTL)
  return rows
}

export async function getTkaParentApprovalRows(tahunAjaranId: string) {
  const actor = await requireActionAccess('tka', 'read')
  if (actor.kind !== 'staff') return []
  const db = await getDB()
  await ensureParentPortalEnhancementSchema(db)
  const restricted = !isAdministrativeActor(actor)
  const scopeSql = restricted ? `AND (
    k.wali_kelas_id = ?
    OR EXISTS (
      SELECT 1 FROM kelas_binaan_bk kb
      WHERE kb.kelas_id = k.id AND kb.guru_bk_id = ? AND kb.tahun_ajaran_id = ?
    )
    OR EXISTS (
      SELECT 1 FROM penugasan_mengajar pm
      WHERE pm.kelas_id = k.id AND pm.guru_id = ? AND pm.tahun_ajaran_id = ?
    )
  )` : ''

  const result = await db.prepare(`
    SELECT
      s.id AS siswa_id,
      s.nisn,
      s.nama_lengkap,
      s.jenis_kelamin,
      k.id AS kelas_id,
      k.tingkat,
      k.nomor_kelas,
      k.kelompok,
      tmp.id AS tka_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2,
      COALESCE(rpl.kategori, 'KULIAH') AS rencana_kategori,
      rpl.catatan AS rencana_catatan,
      pp1.kampus_id AS pilihan1_kampus_id,
      pp1.kampus_nama AS pilihan1_kampus_nama,
      pp1.program_studi AS pilihan1_prodi,
      pp2.kampus_id AS pilihan2_kampus_id,
      pp2.kampus_nama AS pilihan2_kampus_nama,
      pp2.program_studi AS pilihan2_prodi,
      approval.selection_fingerprint AS approval_fingerprint,
      approval.approved_at
    FROM siswa s
    LEFT JOIN riwayat_kelas rk
      ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = ?
    JOIN kelas k ON k.id = COALESCE(s.kelas_id, rk.kelas_id)
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    LEFT JOIN rencana_pasca_lulus rpl
      ON rpl.siswa_id = s.id AND rpl.tahun_ajaran_id = ?
    LEFT JOIN penerimaan_pt pp1
      ON pp1.siswa_id = s.id AND pp1.tahun_ajaran_id = ?
      AND pp1.jenis_data = 'PILIHAN_TKA' AND pp1.pilihan_ke = 1
    LEFT JOIN penerimaan_pt pp2
      ON pp2.siswa_id = s.id AND pp2.tahun_ajaran_id = ?
      AND pp2.jenis_data = 'PILIHAN_TKA' AND pp2.pilihan_ke = 2
    LEFT JOIN parent_tka_approvals approval ON approval.id = (
      SELECT pta.id
      FROM parent_tka_approvals pta
      WHERE pta.siswa_id = s.id AND pta.tahun_ajaran_id = ?
      ORDER BY datetime(pta.approved_at) DESC
      LIMIT 1
    )
    WHERE s.status = 'aktif' AND k.tingkat = 12
      ${scopeSql}
    ORDER BY k.nomor_kelas, k.kelompok, s.nama_lengkap COLLATE NOCASE
  `).bind(
    tahunAjaranId,
    tahunAjaranId,
    tahunAjaranId,
    tahunAjaranId,
    tahunAjaranId,
    tahunAjaranId,
    ...(restricted ? [actor.id, actor.id, tahunAjaranId, actor.id, tahunAjaranId] : []),
  ).all<any>()

  return Promise.all((result.results || []).map(async (row): Promise<TkaParentApprovalRow> => {
    const selection = normalizeParentTkaSelection({
      mapelPilihan1: row.mapel_pilihan1,
      mapelPilihan2: row.mapel_pilihan2,
      rencanaKategori: row.rencana_kategori,
      rencanaCatatan: row.rencana_catatan,
      pilihan1KampusId: row.pilihan1_kampus_id,
      pilihan1KampusNama: row.pilihan1_kampus_nama,
      pilihan1Prodi: row.pilihan1_prodi,
      pilihan2KampusId: row.pilihan2_kampus_id,
      pilihan2KampusNama: row.pilihan2_kampus_nama,
      pilihan2Prodi: row.pilihan2_prodi,
    })
    const hasData = Boolean(row.tka_id || row.pilihan1_kampus_id || row.pilihan2_kampus_id)
    const complete = hasData && isParentTkaSelectionComplete(selection)
    const currentFingerprint = hasData ? await fingerprintParentTkaSelection(selection) : null
    const status = resolveParentTkaApprovalStatus(complete, currentFingerprint, row.approval_fingerprint || null)

    return {
      siswa_id: row.siswa_id,
      nisn: row.nisn,
      nama_lengkap: row.nama_lengkap,
      jenis_kelamin: row.jenis_kelamin,
      kelas_id: row.kelas_id,
      tingkat: row.tingkat,
      nomor_kelas: row.nomor_kelas,
      kelompok: row.kelompok,
      mapel_pilihan1: selection.mapelPilihan1,
      mapel_pilihan2: selection.mapelPilihan2,
      rencana_kategori: selection.rencanaKategori as RencanaKategori,
      rencana_catatan: selection.rencanaCatatan,
      pilihan1_kampus_id: selection.pilihan1KampusId,
      pilihan1_kampus_nama: selection.pilihan1KampusNama,
      pilihan1_prodi: selection.pilihan1Prodi,
      pilihan2_kampus_id: selection.pilihan2KampusId,
      pilihan2_kampus_nama: selection.pilihan2KampusNama,
      pilihan2_prodi: selection.pilihan2Prodi,
      has_data: hasData,
      is_complete: complete,
      approval_status: status,
      approved_at: status === 'disetujui' ? row.approved_at : null,
    }
  }))
}
