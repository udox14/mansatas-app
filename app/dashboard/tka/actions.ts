'use server'
// app/dashboard/tka/actions.ts

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ── Mapel Pilihan ──────────────────────────────────────────────

export async function upsertMapelPilihan(
  siswa_id: string,
  tahun_ajaran_id: string,
  mapel_pilihan_1: string | null,
  mapel_pilihan_2: string | null
) {
  const db = await getDB()
  try {
    await db.prepare(`
      INSERT INTO tka_mapel_pilihan (siswa_id, tahun_ajaran_id, mapel_pilihan_1, mapel_pilihan_2)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET
        mapel_pilihan_1 = excluded.mapel_pilihan_1,
        mapel_pilihan_2 = excluded.mapel_pilihan_2,
        updated_at      = datetime('now')
    `).bind(siswa_id, tahun_ajaran_id, mapel_pilihan_1, mapel_pilihan_2).run()
    revalidatePath('/dashboard/tka')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

// ── Hasil TKA ─────────────────────────────────────────────────

export async function saveHasilTka(
  tahun_ajaran_id: string,
  rows: {
    nomor_peserta: string
    raw_nama_pdf: string
    siswa_id: string | null
    match_confidence: number
    nilai_bind: number | null
    nilai_mat: number | null
    nilai_bing: number | null
    mapel_p1: string | null
    nilai_p1: number | null
    mapel_p2: string | null
    nilai_p2: number | null
  }[]
) {
  const db = await getDB()
  try {
    // Replace semua data untuk tahun ajaran ini
    await db.prepare('DELETE FROM tka_hasil WHERE tahun_ajaran_id = ?')
      .bind(tahun_ajaran_id).run()

    // Insert per chunk 50 agar aman dari D1 limits
    const CHUNK = 50
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const stmts = chunk.map(r =>
        db.prepare(`
          INSERT INTO tka_hasil
            (siswa_id, tahun_ajaran_id, nomor_peserta, raw_nama_pdf,
             nilai_bind, nilai_mat, nilai_bing,
             mapel_p1, nilai_p1, mapel_p2, nilai_p2, match_confidence)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          r.siswa_id, tahun_ajaran_id, r.nomor_peserta, r.raw_nama_pdf,
          r.nilai_bind, r.nilai_mat, r.nilai_bing,
          r.mapel_p1 || null, r.nilai_p1, r.mapel_p2 || null, r.nilai_p2,
          r.match_confidence
        )
      )
      await db.batch(stmts)
    }

    revalidatePath('/dashboard/tka')
    return { ok: true, saved: rows.length }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function updateHasilMatch(
  hasil_id: string,
  siswa_id: string | null,
  tahun_ajaran_id: string
) {
  const db = await getDB()
  try {
    await db.prepare(`
      UPDATE tka_hasil
      SET siswa_id = ?, match_confidence = 100, updated_at = datetime('now')
      WHERE id = ?
    `).bind(siswa_id, hasil_id).run()
    revalidatePath('/dashboard/tka')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
