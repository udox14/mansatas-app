export type ParentTkaSelection = {
  mapelPilihan1: string | null
  mapelPilihan2: string | null
  rencanaKategori: string
  rencanaCatatan: string | null
  pilihan1KampusId: string | null
  pilihan1KampusNama: string | null
  pilihan1Prodi: string | null
  pilihan2KampusId: string | null
  pilihan2KampusNama: string | null
  pilihan2Prodi: string | null
}

function clean(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  return normalized || null
}

export function normalizeParentTkaSelection(input: Partial<ParentTkaSelection>): ParentTkaSelection {
  return {
    mapelPilihan1: clean(input.mapelPilihan1),
    mapelPilihan2: clean(input.mapelPilihan2),
    rencanaKategori: clean(input.rencanaKategori) || 'KULIAH',
    rencanaCatatan: clean(input.rencanaCatatan),
    pilihan1KampusId: clean(input.pilihan1KampusId),
    pilihan1KampusNama: clean(input.pilihan1KampusNama),
    pilihan1Prodi: clean(input.pilihan1Prodi),
    pilihan2KampusId: clean(input.pilihan2KampusId),
    pilihan2KampusNama: clean(input.pilihan2KampusNama),
    pilihan2Prodi: clean(input.pilihan2Prodi),
  }
}

export function isParentTkaSelectionComplete(selection: ParentTkaSelection) {
  if (!selection.mapelPilihan1 || !selection.mapelPilihan2) return false
  if (selection.rencanaKategori !== 'KULIAH') return true
  return Boolean(
    selection.pilihan1KampusId
    && selection.pilihan1KampusNama
    && selection.pilihan1Prodi
  )
}

export function serializeParentTkaSelection(selection: ParentTkaSelection) {
  return JSON.stringify(normalizeParentTkaSelection(selection))
}

export async function fingerprintParentTkaSelection(selection: ParentTkaSelection) {
  const bytes = new TextEncoder().encode(serializeParentTkaSelection(selection))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export const PARENT_TKA_STATEMENT_VERSION = '2026-08-26.v1'

export type ParentTkaApprovalStatus = 'disetujui' | 'belum_disetujui' | 'perlu_persetujuan_ulang' | 'belum_lengkap'

export function resolveParentTkaApprovalStatus(
  isComplete: boolean,
  currentFingerprint: string | null,
  latestApprovalFingerprint: string | null,
): ParentTkaApprovalStatus {
  if (!isComplete) return 'belum_lengkap'
  if (currentFingerprint && currentFingerprint === latestApprovalFingerprint) return 'disetujui'
  if (latestApprovalFingerprint) return 'perlu_persetujuan_ulang'
  return 'belum_disetujui'
}

export async function getParentTkaSelection(
  db: D1Database,
  siswaId: string,
  tahunAjaranId: string,
) {
  const row = await db.prepare(`
    SELECT
      tmp.id AS tka_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2,
      rpl.id AS rencana_id,
      COALESCE(rpl.kategori, 'KULIAH') AS rencana_kategori,
      rpl.catatan AS rencana_catatan,
      pp1.id AS pilihan1_id,
      pp1.kampus_id AS pilihan1_kampus_id,
      pp1.kampus_nama AS pilihan1_kampus_nama,
      pp1.program_studi AS pilihan1_prodi,
      pp2.id AS pilihan2_id,
      pp2.kampus_id AS pilihan2_kampus_id,
      pp2.kampus_nama AS pilihan2_kampus_nama,
      pp2.program_studi AS pilihan2_prodi
    FROM siswa s
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
    WHERE s.id = ?
    LIMIT 1
  `).bind(tahunAjaranId, tahunAjaranId, tahunAjaranId, tahunAjaranId, siswaId).first<any>()

  if (!row) return { hasData: false, selection: null as ParentTkaSelection | null }
  const hasData = Boolean(row.tka_id || row.rencana_id || row.pilihan1_id || row.pilihan2_id)
  return {
    hasData,
    selection: hasData ? normalizeParentTkaSelection({
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
    }) : null,
  }
}
