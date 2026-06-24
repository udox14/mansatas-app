// Lokasi: app/dashboard/plotting/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { ensureRiwayatKelasSnapshotColumns, formatKelasSnapshot } from '@/lib/riwayat-kelas'
import { logActivity } from '@/lib/activity-log'

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
  await ensureRiwayatKelasSnapshotColumns(db)
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
        : `SELECT k.id,
                  COALESCE(rk.kelas_tingkat, k.tingkat) as tingkat,
                  COALESCE(rk.kelas_kelompok, k.kelompok) as kelompok,
                  COALESCE(rk.kelas_nomor, k.nomor_kelas) as nomor_kelas,
                  k.kapasitas,
                  COUNT(rk.siswa_id) as jumlah_siswa
           FROM kelas k
           LEFT JOIN riwayat_kelas rk
             ON rk.kelas_id = k.id AND rk.tahun_ajaran_id = ?
           WHERE k.tingkat = ?
           GROUP BY k.id, COALESCE(rk.kelas_tingkat, k.tingkat), COALESCE(rk.kelas_kelompok, k.kelompok), COALESCE(rk.kelas_nomor, k.nomor_kelas), k.kapasitas
           ORDER BY COALESCE(rk.kelas_kelompok, k.kelompok) ASC, COALESCE(rk.kelas_nomor, k.nomor_kelas) ASC`
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
  await ensureRiwayatKelasSnapshotColumns(db)
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
                  COALESCE(rk.kelas_tingkat, k.tingkat) as tingkat,
                  COALESCE(rk.kelas_kelompok, k.kelompok) as kelompok,
                  COALESCE(rk.kelas_nomor, k.nomor_kelas) as nomor_kelas
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
  await ensureRiwayatKelasSnapshotColumns(db)
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
  await ensureRiwayatKelasSnapshotColumns(db)
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
  await ensureRiwayatKelasSnapshotColumns(db)
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
  await ensureRiwayatKelasSnapshotColumns(db)
  const { source, target } = await resolvePlottingContext(db, context)

  try {
    const now = new Date().toISOString()
    const chunkSize = 100

    if (source.id !== target.id && source.is_active === 1) {
      for (let i = 0; i < hasilPlotting.length; i += chunkSize) {
        const chunk = hasilPlotting.slice(i, i + chunkSize)
        const placeholders = chunk.map(() => '?').join(', ')
        const sourceRows = await db
          .prepare(
            `SELECT s.id, s.kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
             FROM siswa s
             JOIN kelas k ON k.id = s.kelas_id
             WHERE s.id IN (${placeholders})
               AND s.kelas_id IS NOT NULL
               AND s.status = 'aktif'`
          )
          .bind(...chunk.map((plot) => plot.siswa_id))
          .all<{ id: string; kelas_id: string; tingkat: number; nomor_kelas: string; kelompok: string }>()

        const sourceHistoryStmts = (sourceRows.results ?? []).map((row) =>
          db
            .prepare(
              `INSERT INTO riwayat_kelas (siswa_id, kelas_id, tahun_ajaran_id, kelas_tingkat, kelas_nomor, kelas_kelompok, kelas_nama)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(siswa_id, tahun_ajaran_id)
               DO UPDATE SET
                 kelas_id = excluded.kelas_id,
                 kelas_tingkat = excluded.kelas_tingkat,
                 kelas_nomor = excluded.kelas_nomor,
                 kelas_kelompok = excluded.kelas_kelompok,
                 kelas_nama = excluded.kelas_nama`
            )
            .bind(row.id, row.kelas_id, source.id, row.tingkat, row.nomor_kelas, row.kelompok, formatKelasSnapshot(row.tingkat, row.nomor_kelas, row.kelompok))
        )

        if (sourceHistoryStmts.length) await db.batch(sourceHistoryStmts)
      }
    }

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

    const uniqueTargetKelasIds = Array.from(new Set(hasilPlotting.map(plot => plot.kelas_id)))
    const targetKelasMap = new Map<string, { tingkat: number; nomor_kelas: string; kelompok: string }>()
    for (let i = 0; i < uniqueTargetKelasIds.length; i += chunkSize) {
      const chunk = uniqueTargetKelasIds.slice(i, i + chunkSize)
      const placeholders = chunk.map(() => '?').join(', ')
      const rows = await db
        .prepare(`SELECT id, tingkat, nomor_kelas, kelompok FROM kelas WHERE id IN (${placeholders})`)
        .bind(...chunk)
        .all<{ id: string; tingkat: number; nomor_kelas: string; kelompok: string }>()
      ;(rows.results ?? []).forEach(row => {
        targetKelasMap.set(row.id, { tingkat: row.tingkat, nomor_kelas: row.nomor_kelas, kelompok: row.kelompok })
      })
    }

    const riwayatStmts = hasilPlotting.map((plot) => {
      const kelas = targetKelasMap.get(plot.kelas_id)
      return (
      db
        .prepare(
          `INSERT INTO riwayat_kelas (siswa_id, kelas_id, tahun_ajaran_id, kelas_tingkat, kelas_nomor, kelas_kelompok, kelas_nama)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(siswa_id, tahun_ajaran_id)
           DO UPDATE SET
             kelas_id = excluded.kelas_id,
             kelas_tingkat = excluded.kelas_tingkat,
             kelas_nomor = excluded.kelas_nomor,
             kelas_kelompok = excluded.kelas_kelompok,
             kelas_nama = excluded.kelas_nama`
        )
        .bind(plot.siswa_id, plot.kelas_id, target.id, kelas?.tingkat ?? null, kelas?.nomor_kelas ?? null, kelas?.kelompok ?? null, formatKelasSnapshot(kelas?.tingkat, kelas?.nomor_kelas, kelas?.kelompok))
      )
    })

    for (let i = 0; i < riwayatStmts.length; i += chunkSize) {
      await db.batch(riwayatStmts.slice(i, i + chunkSize))
    }

    try {
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
    } catch (err) {
      console.error('Gagal menandai draft penjurusan sebagai applied:', err)
    }

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')

    await logActivity({
      db,
      module: 'plotting',
      action: 'apply_plotting_massal',
      severity: 'warning',
      summary: `Menyimpan ${hasilPlotting.length} hasil plotting siswa`,
      entityType: 'tahun_ajaran',
      entityId: target.id,
      entityLabel: `${target.nama} SMT ${target.semester}`,
      metadata: {
        source_tahun_ajaran_id: source.id,
        target_tahun_ajaran_id: target.id,
        targetIsActive: target.is_active === 1,
      },
      targets: hasilPlotting.map(plot => ({
        type: 'siswa',
        id: plot.siswa_id,
        metadata: { kelas_id: plot.kelas_id },
      })),
    })

    const mode = target.is_active === 1
      ? 'dan memperbarui kelas aktif siswa'
      : `sebagai rencana TA ${target.nama} SMT ${target.semester}. Kelas aktif siswa belum berubah sampai TA tersebut diaktifkan.`
    return { success: `Berhasil menyimpan ${hasilPlotting.length} hasil plotting ${mode}` }
  } catch (err: any) {
    console.error('Gagal menyimpan plotting:', err)
    return { error: `Terjadi kesalahan sistem saat menyimpan plotting: ${err?.message ?? 'detail tidak tersedia'}` }
  }
}

// ============================================================
// 7. PROSES KELULUSAN MASSAL KELAS 12
// ============================================================
export async function prosesKelulusanMassal(siswaIds: string[]) {
  if (!siswaIds.length) return { error: 'Tidak ada siswa yang dipilih.' }

  const db = await getDB()

  try {
    const beforeRows = await db.prepare(`SELECT id, nama_lengkap, status, kelas_id FROM siswa WHERE id IN (${siswaIds.map(() => '?').join(', ')})`).bind(...siswaIds).all<any>()
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
    await logActivity({
      db,
      module: 'plotting',
      action: 'bulk_graduate',
      severity: 'warning',
      summary: `Meluluskan ${siswaIds.length} siswa`,
      entityType: 'siswa',
      entityId: null,
      entityLabel: 'Kelulusan massal',
      metadata: { count: siswaIds.length },
      targets: (beforeRows.results ?? []).map(row => ({
        type: 'siswa',
        id: row.id,
        label: row.nama_lengkap,
        metadata: { before: row, after: { ...row, status: 'lulus', kelas_id: null } },
      })),
    })
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
    const beforeRows = await db.prepare(`SELECT id, nama_lengkap, status, kelas_id FROM siswa WHERE id IN (${siswaIds.map(() => '?').join(', ')})`).bind(...siswaIds).all<any>()
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
    await logActivity({
      db,
      module: 'plotting',
      action: 'bulk_cancel_graduate',
      severity: 'warning',
      summary: `Membatalkan kelulusan ${rows.length} siswa`,
      entityType: 'siswa',
      entityId: null,
      entityLabel: 'Pembatalan kelulusan massal',
      metadata: { requested: siswaIds.length, restored: rows.length, skipped },
      targets: rows.map(row => {
        const before = beforeRows.results?.find(item => item.id === row.id)
        return {
          type: 'siswa',
          id: row.id,
          label: before?.nama_lengkap || row.id,
          metadata: { before, after: { ...before, status: 'aktif', kelas_id: row.kelas_id } },
        }
      }),
    })
    const suffix = skipped > 0 ? ` ${skipped} siswa dilewati karena riwayat kelas aktifnya tidak ditemukan.` : ''
    return { success: `Berhasil memulihkan ${rows.length} siswa ke kelas semula.${suffix}` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat memulihkan kelulusan.' }
  }
}
