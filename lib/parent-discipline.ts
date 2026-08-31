import { ensureSchemaOnce } from '@/lib/schema-guard'
import { getSystemSetting, getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'

export type DisciplinePublishMode = 'immediate' | 'verified'
export type DisciplineClarificationMode = 'whatsapp' | 'form' | 'disabled'
export type DisciplinePublicationStatus = 'pending' | 'published' | 'rejected'
export type DisciplineClarificationStatus = 'baru' | 'diproses' | 'selesai' | 'ditolak'

export const DISCIPLINE_REVIEW_GLOBAL_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad'] as const
export const DISCIPLINE_CLARIFICATION_MAX_LENGTH = 2000

export function normalizeDisciplinePublishMode(value: unknown): DisciplinePublishMode {
  return value === 'verified' ? 'verified' : 'immediate'
}

export function normalizeDisciplineClarificationMode(value: unknown): DisciplineClarificationMode {
  return value === 'form' || value === 'disabled' ? value : 'whatsapp'
}

export function publicationStatusForMode(mode: DisciplinePublishMode): DisciplinePublicationStatus {
  return mode === 'verified' ? 'pending' : 'published'
}

export async function getParentDisciplineSettings() {
  const [enabled, publishModeRaw, clarificationModeRaw] = await Promise.all([
    getSystemSettingBoolean(SYSTEM_SETTING_KEYS.parentPortalDisciplineEnabled, true),
    getSystemSetting(SYSTEM_SETTING_KEYS.parentPortalDisciplinePublishMode, 'immediate'),
    getSystemSetting(SYSTEM_SETTING_KEYS.parentPortalDisciplineClarificationMode, 'whatsapp'),
  ])
  return {
    enabled,
    publishMode: normalizeDisciplinePublishMode(publishModeRaw),
    clarificationMode: normalizeDisciplineClarificationMode(clarificationModeRaw),
  }
}

export async function ensureParentDisciplineSchema(db: D1Database) {
  await ensureSchemaOnce('parent-discipline-schema-v1', async () => {
    const columns = await db.prepare('PRAGMA table_info(siswa_pelanggaran)').all<{ name: string }>()
    const names = new Set((columns.results || []).map(column => column.name))
    const additions = [
      ['nama_pelanggaran_snapshot', 'TEXT'],
      ['kategori_snapshot', 'TEXT'],
      ['poin_snapshot', 'INTEGER'],
      ['publication_status', "TEXT NOT NULL DEFAULT 'published' CHECK(publication_status IN ('pending','published','rejected'))"],
      ['reviewed_by', 'TEXT REFERENCES "user"(id) ON DELETE SET NULL'],
      ['reviewed_at', 'TEXT'],
      ['review_note', 'TEXT'],
    ] as const
    for (const [name, definition] of additions) {
      if (!names.has(name)) await db.prepare(`ALTER TABLE siswa_pelanggaran ADD COLUMN ${name} ${definition}`).run()
    }
    await db.prepare(`
      UPDATE siswa_pelanggaran
      SET nama_pelanggaran_snapshot = COALESCE(nama_pelanggaran_snapshot, (SELECT nama_pelanggaran FROM master_pelanggaran WHERE id = master_pelanggaran_id)),
          kategori_snapshot = COALESCE(kategori_snapshot, (SELECT kategori FROM master_pelanggaran WHERE id = master_pelanggaran_id)),
          poin_snapshot = COALESCE(poin_snapshot, (SELECT poin FROM master_pelanggaran WHERE id = master_pelanggaran_id))
      WHERE nama_pelanggaran_snapshot IS NULL OR kategori_snapshot IS NULL OR poin_snapshot IS NULL
    `).run()
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_siswa_pelanggaran_parent_portal ON siswa_pelanggaran(siswa_id, publication_status, tahun_ajaran_id, tanggal DESC)`).run()
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS parent_discipline_clarifications (
        id TEXT PRIMARY KEY,
        siswa_pelanggaran_id TEXT REFERENCES siswa_pelanggaran(id) ON DELETE SET NULL,
        siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
        parent_session_id TEXT,
        pelanggaran_nama_snapshot TEXT NOT NULL,
        pelanggaran_kategori_snapshot TEXT NOT NULL,
        pelanggaran_poin_snapshot INTEGER NOT NULL,
        pelanggaran_tanggal_snapshot TEXT NOT NULL,
        request_message TEXT NOT NULL CHECK(length(trim(request_message)) BETWEEN 1 AND 2000),
        status TEXT NOT NULL DEFAULT 'baru' CHECK(status IN ('baru','diproses','selesai','ditolak')),
        response_message TEXT CHECK(response_message IS NULL OR length(trim(response_message)) BETWEEN 1 AND 2000),
        handled_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        handled_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
    await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_discipline_clarification_once ON parent_discipline_clarifications(siswa_pelanggaran_id) WHERE siswa_pelanggaran_id IS NOT NULL`).run()
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_parent_discipline_clarification_student ON parent_discipline_clarifications(siswa_id, created_at DESC)`).run()
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_parent_discipline_clarification_status ON parent_discipline_clarifications(status, created_at DESC)`).run()
  })
}

export async function canReviewDisciplineRecord(db: D1Database, userId: string, siswaId: string) {
  const row = await db.prepare(`
    SELECT 1 AS allowed
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ? AND (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = ? AND ur.role IN ('super_admin','admin_tu','kepsek','wakamad')
      )
      OR EXISTS (
        SELECT 1 FROM "user" u
        WHERE u.id = ? AND u.role IN ('super_admin','admin_tu','kepsek','wakamad')
      )
      OR k.wali_kelas_id = ?
      OR EXISTS (
        SELECT 1 FROM kelas_binaan_bk kb
        JOIN tahun_ajaran ta ON ta.id = kb.tahun_ajaran_id AND ta.is_active = 1
        WHERE kb.kelas_id = s.kelas_id AND kb.guru_bk_id = ?
      )
    ) LIMIT 1
  `).bind(siswaId, userId, userId, userId, userId).first<{ allowed: number }>()
  return Boolean(row)
}

export async function getParentDisciplineData(db: D1Database, siswaId: string, tahunAjaranId: string) {
  await ensureParentDisciplineSchema(db)
  const [ta, records, selectedSummary, lifetimeSummary, sanctions, clarifications] = await Promise.all([
    db.prepare('SELECT id, nama, semester, is_active FROM tahun_ajaran WHERE id = ? LIMIT 1').bind(tahunAjaranId).first<any>(),
    db.prepare(`
      SELECT sp.id, sp.tanggal, sp.jam_input, sp.keterangan,
        COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran) AS nama_pelanggaran,
        COALESCE(sp.kategori_snapshot, mp.kategori) AS kategori,
        COALESCE(sp.poin_snapshot, mp.poin, 0) AS poin
      FROM siswa_pelanggaran sp
      LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE sp.siswa_id = ? AND sp.tahun_ajaran_id = ? AND sp.publication_status = 'published'
      ORDER BY sp.tanggal DESC, sp.created_at DESC
    `).bind(siswaId, tahunAjaranId).all<any>(),
    db.prepare(`
      SELECT COUNT(*) AS total_kasus, COALESCE(SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)), 0) AS total_poin,
             MAX(sp.tanggal) AS tanggal_terakhir
      FROM siswa_pelanggaran sp LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE sp.siswa_id = ? AND sp.tahun_ajaran_id = ? AND sp.publication_status = 'published'
    `).bind(siswaId, tahunAjaranId).first<any>(),
    db.prepare(`
      SELECT COUNT(*) AS total_kasus, COALESCE(SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)), 0) AS total_poin,
             MAX(sp.tanggal) AS tanggal_terakhir
      FROM siswa_pelanggaran sp LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE sp.siswa_id = ? AND sp.publication_status = 'published'
    `).bind(siswaId).first<any>(),
    db.prepare('SELECT id, nama, deskripsi, poin_minimal FROM sanksi_config ORDER BY poin_minimal DESC').all<any>(),
    db.prepare(`
      SELECT id, siswa_pelanggaran_id, status, request_message, response_message, handled_at, created_at,
             pelanggaran_nama_snapshot, pelanggaran_tanggal_snapshot
      FROM parent_discipline_clarifications WHERE siswa_id = ? ORDER BY created_at DESC
    `).bind(siswaId).all<any>(),
  ])
  if (!ta) return null
  const lifetimePoin = Number(lifetimeSummary?.total_poin || 0)
  const activeSanction = (sanctions.results || []).find(row => lifetimePoin >= Number(row.poin_minimal || 0)) || null
  return {
    tahunAjaran: { id: ta.id, nama: ta.nama, semester: Number(ta.semester), isActive: Number(ta.is_active) === 1 },
    selectedSummary: {
      totalKasus: Number(selectedSummary?.total_kasus || 0),
      totalPoin: Number(selectedSummary?.total_poin || 0),
      lastDate: selectedSummary?.tanggal_terakhir || null,
    },
    lifetimeSummary: {
      totalKasus: Number(lifetimeSummary?.total_kasus || 0),
      totalPoin: lifetimePoin,
      lastDate: lifetimeSummary?.tanggal_terakhir || null,
      levelLabel: activeSanction?.nama || (Number(lifetimeSummary?.total_kasus || 0) > 0 ? 'Perlu dipantau' : 'Baik'),
      sanctionDescription: activeSanction?.deskripsi || null,
    },
    records: records.results || [],
    clarifications: clarifications.results || [],
  }
}
