'use server'

import { revalidatePath } from 'next/cache'
import { getDB } from '@/utils/db-server'
import { KAMPUS_BY_ID, PRODI_BY_KAMPUS } from '@/lib/pendidikan-lanjutan'
import type { RencanaKategori } from '@/lib/pendidikan-lanjutan'

export type RencanaPendidikanData = {
  kategori: RencanaKategori
  catatan: string | null
  pilihan1_kampus_id: string | null
  pilihan1_kampus_nama: string | null
  pilihan1_prodi: string | null
  pilihan2_kampus_id: string | null
  pilihan2_kampus_nama: string | null
  pilihan2_prodi: string | null
}

export async function getRencanaPendidikanSiswa(siswaId: string, tahunAjaranId: string): Promise<RencanaPendidikanData> {
  const db = await getDB()
  const row = await db.prepare(`
    SELECT COALESCE(r.kategori, 'KULIAH') kategori, r.catatan,
      p1.kampus_id pilihan1_kampus_id, p1.kampus_nama pilihan1_kampus_nama, p1.program_studi pilihan1_prodi,
      p2.kampus_id pilihan2_kampus_id, p2.kampus_nama pilihan2_kampus_nama, p2.program_studi pilihan2_prodi
    FROM siswa s
    LEFT JOIN rencana_pasca_lulus r ON r.siswa_id = s.id AND r.tahun_ajaran_id = ?
    LEFT JOIN penerimaan_pt p1 ON p1.siswa_id = s.id AND p1.tahun_ajaran_id = ?
      AND p1.jenis_data = 'PILIHAN_TKA' AND p1.pilihan_ke = 1
    LEFT JOIN penerimaan_pt p2 ON p2.siswa_id = s.id AND p2.tahun_ajaran_id = ?
      AND p2.jenis_data = 'PILIHAN_TKA' AND p2.pilihan_ke = 2
    WHERE s.id = ?
  `).bind(tahunAjaranId, tahunAjaranId, tahunAjaranId, siswaId).first<RencanaPendidikanData>()
  return row ?? {
    kategori: 'KULIAH', catatan: null,
    pilihan1_kampus_id: null, pilihan1_kampus_nama: null, pilihan1_prodi: null,
    pilihan2_kampus_id: null, pilihan2_kampus_nama: null, pilihan2_prodi: null,
  }
}

export async function saveRencanaPendidikanSiswa(payload: {
  siswa_id: string
  tahun_ajaran_id: string
  kategori: RencanaKategori
  catatan?: string | null
  pilihan1_kampus_id?: string | null
  pilihan1_prodi?: string | null
  pilihan2_kampus_id?: string | null
  pilihan2_prodi?: string | null
}) {
  const note = payload.catatan?.trim() || null
  if (payload.kategori === 'LAINNYA' && !note) return { error: 'Catatan wajib diisi untuk rencana Lainnya.' }
  const choices = [
    { slot: 1, kampusId: payload.pilihan1_kampus_id, prodi: payload.pilihan1_prodi },
    { slot: 2, kampusId: payload.pilihan2_kampus_id, prodi: payload.pilihan2_prodi },
  ] as const
  if (payload.kategori === 'KULIAH') {
    const filled = choices.filter(choice => choice.kampusId)
    for (const choice of filled) {
      const kampus = KAMPUS_BY_ID.get(choice.kampusId!)
      if (!kampus) return { error: 'Perguruan tinggi tidak valid.' }
      const prodi = PRODI_BY_KAMPUS[choice.kampusId!] ?? []
      if (prodi.length && !choice.prodi) return { error: `Program studi wajib dipilih untuk ${kampus.nama}.` }
      if (choice.prodi && prodi.length && !prodi.some(item => item.nama === choice.prodi)) return { error: 'Program studi tidak valid.' }
    }
    if (filled.length === 2 && filled[0].kampusId === filled[1].kampusId && filled[0].prodi === filled[1].prodi) {
      return { error: 'Pilihan pendidikan 1 dan 2 tidak boleh sama.' }
    }
  }

  const db = await getDB()
  const statements = [
    db.prepare('DELETE FROM rencana_pasca_lulus WHERE siswa_id = ? AND tahun_ajaran_id = ?').bind(payload.siswa_id, payload.tahun_ajaran_id),
    db.prepare("DELETE FROM penerimaan_pt WHERE siswa_id = ? AND tahun_ajaran_id = ? AND jenis_data = 'PILIHAN_TKA'").bind(payload.siswa_id, payload.tahun_ajaran_id),
  ]
  if (payload.kategori !== 'KULIAH') {
    statements.push(db.prepare(`INSERT INTO rencana_pasca_lulus
      (siswa_id, tahun_ajaran_id, kategori, catatan, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`
    ).bind(payload.siswa_id, payload.tahun_ajaran_id, payload.kategori, note))
  } else {
    for (const choice of choices) {
      if (!choice.kampusId) continue
      const kampus = KAMPUS_BY_ID.get(choice.kampusId)!
      statements.push(db.prepare(`INSERT INTO penerimaan_pt
        (siswa_id, tahun_ajaran_id, jalur, kampus_id, kampus_nama, program_studi,
         status, jenis_data, pilihan_ke, updated_at)
        VALUES (?, ?, 'PILIHAN_TKA', ?, ?, ?, 'RENCANA', 'PILIHAN_TKA', ?, datetime('now', 'localtime'))`
      ).bind(payload.siswa_id, payload.tahun_ajaran_id, kampus.id, kampus.nama, choice.prodi || null, choice.slot))
    }
  }
  try {
    await db.batch(statements)
    revalidatePath('/dashboard/tka')
    revalidatePath('/dashboard/penerimaan-pt')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Gagal menyimpan rencana.' }
  }
}
