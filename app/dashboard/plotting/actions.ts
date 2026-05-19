// Lokasi: app/dashboard/plotting/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'

type TahunAjaranRef = {
  id: string
  nama: string
  semester: number
  is_active?: number
  daftar_jurusan?: string | null
}

type PlottingContext = {
  source_tahun_ajaran_id?: string
  target_tahun_ajaran_id?: string
}

async function ensurePlottingPenjurusanDraftTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS plotting_penjurusan_draft (
      id                       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id                 TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      source_tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      target_tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      minat_jurusan            TEXT,
      status                   TEXT NOT NULL DEFAULT 'draft'
                               CHECK(status IN ('draft','applied')),
      created_at               TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, source_tahun_ajaran_id, target_tahun_ajaran_id)
    )
  `).run()

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_plotting_penjurusan_draft_context
    ON plotting_penjurusan_draft(source_tahun_ajaran_id, target_tahun_ajaran_id)
  `).run()

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_plotting_penjurusan_draft_siswa
    ON plotting_penjurusan_draft(siswa_id)
  `).run()
}

function normalizeJurusan(value: string | null | undefined) {
  if (!value) return null
  if (value === 'AGM') return 'KEAGAMAAN'
  if (value === 'SOS') return 'SOSHUM'
  return value
}

export async function getTahunAjaranList() {
  const db = await getDB()
  const rows = await db
    .prepare('SELECT id, nama, semester, is_active, daftar_jurusan FROM tahun_ajaran ORDER BY nama ASC, semester ASC')
    .all<TahunAjaranRef>()

  return rows.results ?? []
}

async function resolvePlottingContext(db: D1Database, context?: PlottingContext) {
  let years = (await db
    .prepare('SELECT id, nama, semester, is_active, daftar_jurusan FROM tahun_ajaran ORDER BY nama ASC, semester ASC')
    .all<TahunAjaranRef>()).results ?? []

  if (!years.length) {
    const ta = await getTahunAjaranAktif()
    years = [{ ...ta, is_active: 1 }]
  }

  const active = years.find((ta) => ta.is_active === 1) ?? years[0]
  const source = years.find((ta) => ta.id === context?.source_tahun_ajaran_id) ?? active
  const target =
    years.find((ta) => ta.id === context?.target_tahun_ajaran_id) ??
    years.find((ta) => ta.nama > source.nama) ??
    source

  return { source, target, active }
}

// ============================================================
// 1. AMBIL TAHUN AJARAN AKTIF
// ============================================================
export async function getTahunAjaranAktif() {
  const db = await getDB()
  let ta = await db
    .prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()

  if (!ta) {
    const id = crypto.randomUUID()
    await db
      .prepare('INSERT INTO tahun_ajaran (id, nama, semester, is_active) VALUES (?, ?, ?, 1)')
      .bind(id, '2024/2025', 1)
      .run()
    ta = { id, nama: '2024/2025', semester: 1 }
  }

  return ta
}

// ============================================================
// 2. SISWA BELUM PUNYA KELAS
// ============================================================
export async function getSiswaBelumAdaKelas() {
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT id, nisn, nama_lengkap, jenis_kelamin FROM siswa
       WHERE kelas_id IS NULL AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .all<any>()
  return result.results ?? []
}

// ============================================================
// 3. KELAS BERDASARKAN TINGKAT
// ============================================================
export async function getKelasByTingkat(tingkat: number, tahun_ajaran_id?: string) {
  const db = await getDB()
  const { target } = await resolvePlottingContext(db, { target_tahun_ajaran_id: tahun_ajaran_id })
  const countByCurrentClass = !tahun_ajaran_id || target.is_active === 1

  const rows = await db
    .prepare(
      countByCurrentClass
        ? `SELECT k.id, k.tingkat, k.kelompok, k.nomor_kelas, k.kapasitas,
                  COUNT(CASE WHEN s.status = 'aktif' THEN 1 END) as jumlah_siswa
           FROM kelas k
           LEFT JOIN siswa s ON s.kelas_id = k.id
           WHERE k.tingkat = ?
           GROUP BY k.id
           ORDER BY k.kelompok ASC, k.nomor_kelas ASC`
        : `SELECT k.id, k.tingkat, k.kelompok, k.nomor_kelas, k.kapasitas,
                  COUNT(rk.siswa_id) as jumlah_siswa
           FROM kelas k
           LEFT JOIN riwayat_kelas rk
             ON rk.kelas_id = k.id AND rk.tahun_ajaran_id = ?
           WHERE k.tingkat = ?
           GROUP BY k.id
           ORDER BY k.kelompok ASC, k.nomor_kelas ASC`
    )
    .bind(...(countByCurrentClass ? [tingkat] : [target.id, tingkat]))
    .all<any>()

  return (rows.results ?? []).map((k: any) => ({
    ...k,
    nama: `${k.tingkat}-${k.nomor_kelas}${k.kelompok !== 'UMUM' ? ' ' + k.kelompok : ''}`,
  }))
}

// ============================================================
// 4. SISWA BERDASARKAN TINGKAT
// ============================================================
export async function getSiswaByTingkat(
  tingkat: number,
  source_tahun_ajaran_id?: string,
  target_tahun_ajaran_id?: string
) {
  const db = await getDB()
  await ensurePlottingPenjurusanDraftTable(db)
  const { source, target } = await resolvePlottingContext(db, {
    source_tahun_ajaran_id,
    target_tahun_ajaran_id,
  })
  const useCurrentClass = source.is_active === 1

  const result = await db
    .prepare(
      useCurrentClass
        ? `SELECT s.id, s.nisn, s.nis_lokal, s.nama_lengkap, s.jenis_kelamin, s.kelas_id,
                  s.minat_jurusan as legacy_minat_jurusan,
                  d.id as draft_id, d.minat_jurusan as draft_minat_jurusan,
                  k.tingkat, k.kelompok, k.nomor_kelas
           FROM siswa s
           JOIN kelas k ON s.kelas_id = k.id
           LEFT JOIN plotting_penjurusan_draft d
             ON d.siswa_id = s.id
            AND d.source_tahun_ajaran_id = ?
            AND d.target_tahun_ajaran_id = ?
           WHERE k.tingkat = ? AND s.status = 'aktif'
           ORDER BY s.nama_lengkap ASC`
        : `SELECT s.id, s.nisn, s.nis_lokal, s.nama_lengkap, s.jenis_kelamin, rk.kelas_id,
                  s.minat_jurusan as legacy_minat_jurusan,
                  d.id as draft_id, d.minat_jurusan as draft_minat_jurusan,
                  k.tingkat, k.kelompok, k.nomor_kelas
           FROM siswa s
           JOIN riwayat_kelas rk
             ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = ?
           JOIN kelas k ON k.id = rk.kelas_id
           LEFT JOIN plotting_penjurusan_draft d
             ON d.siswa_id = s.id
            AND d.source_tahun_ajaran_id = ?
            AND d.target_tahun_ajaran_id = ?
           WHERE k.tingkat = ? AND s.status = 'aktif'
           ORDER BY s.nama_lengkap ASC`
    )
    .bind(...(useCurrentClass ? [source.id, target.id, tingkat] : [source.id, source.id, target.id, tingkat]))
    .all<any>()

  return (result.results ?? []).map((s: any) => ({
    id: s.id,
    nisn: s.nisn,
    nis_lokal: s.nis_lokal,
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
    kelas_id: s.kelas_id,
    minat_jurusan: s.draft_id
      ? normalizeJurusan(s.draft_minat_jurusan)
      : normalizeJurusan(s.legacy_minat_jurusan),
    kelas_lama: s.tingkat ? `${s.tingkat}-${s.nomor_kelas}` : '',
    kelompok: s.kelompok ?? 'UMUM',
    kelas: {
      tingkat: s.tingkat,
      kelompok: s.kelompok,
      nomor_kelas: s.nomor_kelas,
    },
  }))
}

export async function getSiswaLulusByRiwayatTingkat(tingkat: number) {
  const db = await getDB()
  const ta = await getTahunAjaranAktif()

  const result = await db
    .prepare(
      `SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, rk.kelas_id,
              k.tingkat, k.kelompok, k.nomor_kelas
       FROM siswa s
       JOIN riwayat_kelas rk ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = ?
       JOIN kelas k ON k.id = rk.kelas_id
       WHERE k.tingkat = ? AND s.status = 'lulus'
       ORDER BY s.nama_lengkap ASC`
    )
    .bind(ta.id, tingkat)
    .all<any>()

  return (result.results ?? []).map((s: any) => ({
    id: s.id,
    nisn: s.nisn,
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
    kelas_id: s.kelas_id,
    kelas_lama: s.tingkat ? `${s.tingkat}-${s.nomor_kelas}` : '',
    kelompok: s.kelompok ?? 'UMUM',
    kelas: {
      tingkat: s.tingkat,
      kelompok: s.kelompok,
      nomor_kelas: s.nomor_kelas,
    },
  }))
}

// ============================================================
// 5. DRAFT PENJURUSAN PER TAHUN AJARAN
// ============================================================
export async function setDraftPenjurusan(
  siswa_id: string,
  minat_jurusan: string | null,
  context?: PlottingContext
) {
  const db = await getDB()
  await ensurePlottingPenjurusanDraftTable(db)
  const { source, target } = await resolvePlottingContext(db, context)
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO plotting_penjurusan_draft (
         id, siswa_id, source_tahun_ajaran_id, target_tahun_ajaran_id, minat_jurusan, status, updated_at
       )
       VALUES (?, ?, ?, ?, ?, 'draft', ?)
       ON CONFLICT(siswa_id, source_tahun_ajaran_id, target_tahun_ajaran_id)
       DO UPDATE SET
         minat_jurusan = excluded.minat_jurusan,
         status = 'draft',
         updated_at = excluded.updated_at`
    )
    .bind(crypto.randomUUID(), siswa_id, source.id, target.id, normalizeJurusan(minat_jurusan), now)
    .run()

  revalidatePath('/dashboard/plotting')
  return { success: true }
}

export async function setDraftPenjurusanMassal(
  payload: { id: string; minat_jurusan: string }[],
  context?: PlottingContext
) {
  const db = await getDB()
  await ensurePlottingPenjurusanDraftTable(db)
  const { source, target } = await resolvePlottingContext(db, context)
  const now = new Date().toISOString()

  const chunkSize = 100
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const stmts = chunk.map((p) =>
      db
        .prepare(
          `INSERT INTO plotting_penjurusan_draft (
             id, siswa_id, source_tahun_ajaran_id, target_tahun_ajaran_id, minat_jurusan, status, updated_at
           )
           VALUES (?, ?, ?, ?, ?, 'draft', ?)
           ON CONFLICT(siswa_id, source_tahun_ajaran_id, target_tahun_ajaran_id)
           DO UPDATE SET
             minat_jurusan = excluded.minat_jurusan,
             status = 'draft',
             updated_at = excluded.updated_at`
        )
        .bind(crypto.randomUUID(), p.id, source.id, target.id, normalizeJurusan(p.minat_jurusan), now)
    )
    await db.batch(stmts)
  }

  revalidatePath('/dashboard/plotting')
  return { success: true }
}

// ============================================================
// 6. SIMPAN PLOTTING MASSAL
// ============================================================
export async function simpanPlottingMassal(
  hasilPlotting: { siswa_id: string; kelas_id: string }[],
  context?: PlottingContext
) {
  if (!hasilPlotting.length) return { error: 'Tidak ada data plotting.' }

  const db = await getDB()
  await ensurePlottingPenjurusanDraftTable(db)
  const { source, target } = await resolvePlottingContext(db, context)

  try {
    const now = new Date().toISOString()
    const chunkSize = 100

    if (target.is_active === 1) {
      const updateStmts = hasilPlotting.map((plot) =>
        db
          .prepare('UPDATE siswa SET kelas_id = ?, updated_at = ? WHERE id = ?')
          .bind(plot.kelas_id, now, plot.siswa_id)
      )

      for (let i = 0; i < updateStmts.length; i += chunkSize) {
        await db.batch(updateStmts.slice(i, i + chunkSize))
      }
    }

    const riwayatStmts = hasilPlotting.map((plot) =>
      db
        .prepare(
          `INSERT INTO riwayat_kelas (siswa_id, kelas_id, tahun_ajaran_id)
           VALUES (?, ?, ?)
           ON CONFLICT(siswa_id, tahun_ajaran_id)
           DO UPDATE SET kelas_id = excluded.kelas_id`
        )
        .bind(plot.siswa_id, plot.kelas_id, target.id)
    )

    for (let i = 0; i < riwayatStmts.length; i += chunkSize) {
      await db.batch(riwayatStmts.slice(i, i + chunkSize))
    }

    for (let i = 0; i < hasilPlotting.length; i += chunkSize) {
      const chunk = hasilPlotting.slice(i, i + chunkSize)
      const placeholders = chunk.map(() => '?').join(', ')
      await db
        .prepare(
          `UPDATE plotting_penjurusan_draft
           SET status = 'applied', updated_at = ?
           WHERE source_tahun_ajaran_id = ?
             AND target_tahun_ajaran_id = ?
             AND siswa_id IN (${placeholders})`
        )
        .bind(now, source.id, target.id, ...chunk.map((plot) => plot.siswa_id))
        .run()
    }

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')

    const mode = target.is_active === 1 ? 'permanen' : `sebagai rencana TA ${target.nama}`
    return { success: `Berhasil memploting ${hasilPlotting.length} siswa ${mode}!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat menyimpan plotting.' }
  }
}

// ============================================================
// 7. PROSES KELULUSAN MASSAL KELAS 12
// ============================================================
export async function prosesKelulusanMassal(siswaIds: string[]) {
  if (!siswaIds.length) return { error: 'Tidak ada siswa yang dipilih.' }

  const db = await getDB()

  try {
    const now = new Date().toISOString()
    const chunkSize = 100

    const stmts = siswaIds.map((id) =>
      db
        .prepare('UPDATE siswa SET status = ?, kelas_id = NULL, updated_at = ? WHERE id = ?')
        .bind('lulus', now, id)
    )

    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize))
    }

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
    return { success: `Berhasil meluluskan ${siswaIds.length} siswa kelas 12!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat memproses kelulusan.' }
  }
}

export async function batalkanKelulusanMassal(siswaIds: string[]) {
  if (!siswaIds.length) return { error: 'Tidak ada siswa yang dipilih.' }

  const db = await getDB()
  const ta = await getTahunAjaranAktif()

  try {
    const placeholders = siswaIds.map(() => '?').join(', ')
    const restorable = await db
      .prepare(
        `SELECT s.id, rk.kelas_id
         FROM siswa s
         JOIN riwayat_kelas rk ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = ?
         JOIN kelas k ON k.id = rk.kelas_id
         WHERE s.id IN (${placeholders})
           AND s.status = 'lulus'
           AND k.tingkat = 12`
      )
      .bind(ta.id, ...siswaIds)
      .all<{ id: string; kelas_id: string }>()

    const rows = restorable.results ?? []
    if (!rows.length) return { error: 'Tidak ada data riwayat kelas aktif yang bisa dipulihkan.' }

    const now = new Date().toISOString()
    const chunkSize = 100
    const stmts = rows.map((row) =>
      db
        .prepare('UPDATE siswa SET status = ?, kelas_id = ?, updated_at = ? WHERE id = ?')
        .bind('aktif', row.kelas_id, now, row.id)
    )

    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize))
    }

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')

    const skipped = siswaIds.length - rows.length
    const suffix = skipped > 0 ? ` ${skipped} siswa dilewati karena riwayat kelas aktifnya tidak ditemukan.` : ''
    return { success: `Berhasil memulihkan ${rows.length} siswa ke kelas semula.${suffix}` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat memulihkan kelulusan.' }
  }
}
