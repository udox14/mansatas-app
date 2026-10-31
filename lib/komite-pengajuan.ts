import { getUserRoles } from '@/lib/features'
import { ensureActivityLogTables } from '@/lib/activity-log'

export const KOMITE_VERIFIER_KEY = 'komite_verifier_user_id'
export const KOMITE_CHAIRMAN_KEY = 'komite_spb_chairman_user_id'

// Storage keeps the legacy `ketua` key; version 2 means Verifikator.
export async function komiteConfiguredUser(db: D1Database, key: string, role: string) {
  return db.prepare(`SELECT u.id,COALESCE(u.nama_lengkap,u.name,u.email) AS name
    FROM system_settings s JOIN "user" u ON u.id=s.value
    WHERE s.key=? AND COALESCE(u.banned,0)=0 AND (u.role=? OR EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role=?))`)
    .bind(key,role,role).first<{ id: string; name: string }>()
}

export async function komiteChairman(db: D1Database) {
  const selected = await komiteConfiguredUser(db, KOMITE_CHAIRMAN_KEY, 'ketua_komite')
  if (selected) return selected
  const rows = await db.prepare(`SELECT u.id,COALESCE(u.nama_lengkap,u.name,u.email) AS name
    FROM "user" u WHERE COALESCE(u.banned,0)=0 AND (u.role='ketua_komite' OR EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='ketua_komite')) ORDER BY u.id`).all<{ id: string; name: string }>()
  return rows.results?.length === 1 ? rows.results[0] : null
}

export const KOMITE_FEATURE_ID = 'komite-pengajuan'
export const KOMITE_SUBMITTER_ROLES = ['super_admin', 'kepsek', 'wakamad', 'pembina_ekstrakurikuler', 'bendahara_komite'] as const
export const KOMITE_STAGE_ROLE = {
  bendahara: 'bendahara_komite',
  ketua: 'ketua_komite',
  kepala: 'kepsek',
} as const

export type KomiteStatus = 'draft' | 'menunggu_bendahara' | 'menunggu_ketua' | 'menunggu_kepala' | 'perlu_revisi' | 'ditolak' | 'disetujui'
export type KomiteStage = keyof typeof KOMITE_STAGE_ROLE
export type KomiteReviewAction = 'setujui' | 'minta_revisi' | 'tolak'

// The retired principal flag is accepted for source compatibility only.
export function komiteNextReviewStatus(stage: KomiteStage, action: KomiteReviewAction, _requirePrincipalApproval = false): KomiteStatus {
  if (action === 'minta_revisi') return 'perlu_revisi'
  if (action === 'tolak') return 'ditolak'
  if (stage === 'bendahara') return 'menunggu_ketua'
  return 'disetujui'
}

// Legacy approved proposals used the three-stage workflow. The stored final
// stage is authoritative for new SPBs, regardless of subsequent setting changes.
export function komiteSpbApprovalStages(finalStage?: string | null): KomiteStage[] {
  return finalStage === 'ketua' ? ['bendahara', 'ketua'] : ['bendahara', 'ketua', 'kepala']
}

export type KomiteNotificationPlan = {
  eventKey: string
  recipient: 'applicant' | 'reviewer'
  suffix: string
}

export function komiteReviewNotificationPlans(
  stage: KomiteStage,
  action: KomiteReviewAction,
  _requirePrincipalApproval = false,
): KomiteNotificationPlan[] {
  if (action === 'minta_revisi') {
    return [{ eventKey: 'komite_revision_requested', recipient: 'applicant', suffix: 'revision-requested' }]
  }
  if (action === 'tolak') {
    return [{ eventKey: 'komite_rejected', recipient: 'applicant', suffix: 'rejected' }]
  }
  if (stage === 'bendahara') {
    return [
      { eventKey: 'komite_treasurer_approved', recipient: 'applicant', suffix: 'approved' },
      { eventKey: 'komite_verifier_review_requested', recipient: 'reviewer', suffix: 'waiting-verifier' },
    ]
  }
  return [{ eventKey: 'komite_final_approved', recipient: 'applicant', suffix: 'final-approved' }]
}

export function stageForStatus(status: string): KomiteStage | null {
  if (status === 'menunggu_bendahara') return 'bendahara'
  if (status === 'menunggu_ketua') return 'ketua'
  if (status === 'menunggu_kepala') return 'kepala'
  return null
}

export async function ensureKomitePengajuanSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS komite_pengajuan (
      id TEXT PRIMARY KEY, judul TEXT NOT NULL, uraian TEXT NOT NULL,
      nominal INTEGER NOT NULL CHECK (nominal > 0), pengaju_id TEXT NOT NULL REFERENCES "user"(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','menunggu_bendahara','menunggu_ketua','menunggu_kepala','perlu_revisi','ditolak','disetujui')),
      current_version INTEGER NOT NULL DEFAULT 1, nomor_spb TEXT COLLATE NOCASE UNIQUE,
      penerima_pembayaran TEXT, submitted_at TEXT, approved_at TEXT, rejected_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS komite_pengajuan_versions (
      id TEXT PRIMARY KEY, pengajuan_id TEXT NOT NULL REFERENCES komite_pengajuan(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES "user"(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')), submitted_at TEXT,
      UNIQUE (pengajuan_id, version_number)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS komite_pengajuan_files (
      id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES komite_pengajuan_versions(id) ON DELETE CASCADE,
      original_filename TEXT NOT NULL, r2_key TEXT NOT NULL UNIQUE, size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
      mime_type TEXT NOT NULL DEFAULT 'application/pdf', created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS komite_pengajuan_reviews (
      id TEXT PRIMARY KEY, pengajuan_id TEXT NOT NULL REFERENCES komite_pengajuan(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL, stage TEXT NOT NULL CHECK (stage IN ('bendahara','ketua','kepala')),
      action TEXT NOT NULL CHECK (action IN ('setujui','minta_revisi','tolak')), catatan TEXT,
      actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL, actor_name TEXT NOT NULL, actor_role TEXT NOT NULL,
      actor_signature_url TEXT, is_super_admin_bypass INTEGER NOT NULL DEFAULT 0,
      nomor_spb_snapshot TEXT, penerima_snapshot TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS komite_pengajuan_rincian (
      id TEXT PRIMARY KEY, pengajuan_id TEXT NOT NULL REFERENCES komite_pengajuan(id) ON DELETE CASCADE,
      urutan INTEGER NOT NULL CHECK (urutan BETWEEN 1 AND 10), uraian TEXT NOT NULL,
      penerima_penyedia TEXT NOT NULL, jumlah INTEGER NOT NULL CHECK (jumlah > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (pengajuan_id, urutan)
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_komite_pengajuan_pengaju ON komite_pengajuan(pengaju_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_komite_pengajuan_status ON komite_pengajuan(status, updated_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_komite_versions_pengajuan ON komite_pengajuan_versions(pengajuan_id, version_number)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_komite_files_version ON komite_pengajuan_files(version_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_komite_reviews_actor ON komite_pengajuan_reviews(actor_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_komite_reviews_pengajuan ON komite_pengajuan_reviews(pengajuan_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_komite_rincian_pengajuan ON komite_pengajuan_rincian(pengajuan_id, urutan)'),
  ])

  const alterStatements = [
    `ALTER TABLE komite_pengajuan ADD COLUMN workflow_version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE komite_pengajuan ADD COLUMN chairman_id_snapshot TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN chairman_name_snapshot TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_at TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_by TEXT REFERENCES "user"(id) ON DELETE SET NULL`,
    `ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_name TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN laporan_revision INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE komite_pengajuan_reviews ADD COLUMN workflow_version INTEGER NOT NULL DEFAULT 1`,

    `ALTER TABLE komite_pengajuan ADD COLUMN final_approval_stage TEXT CHECK (final_approval_stage IS NULL OR final_approval_stage IN ('ketua','kepala'))`,
    `ALTER TABLE komite_pengajuan ADD COLUMN tahun_anggaran TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN kode_rkas_program TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN realisasi_status TEXT NOT NULL DEFAULT 'belum' CHECK (realisasi_status IN ('belum','sudah'))`,
    `ALTER TABLE komite_pengajuan ADD COLUMN realisasi_tanggal TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN realisasi_metode TEXT CHECK (realisasi_metode IS NULL OR realisasi_metode IN ('Tunai','Transfer'))`,
    `ALTER TABLE komite_pengajuan ADD COLUMN realisasi_petugas TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN realisasi_catatan TEXT`,
    `ALTER TABLE komite_pengajuan ADD COLUMN ketua_delegate_id TEXT REFERENCES "user"(id) ON DELETE SET NULL`,
    `ALTER TABLE komite_pengajuan ADD COLUMN ketua_delegated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL`,
    `ALTER TABLE komite_pengajuan ADD COLUMN ketua_delegated_at TEXT`,
  ]
  for (const sql of alterStatements) {
    try {
      await db.prepare(sql).run()
    } catch (error: any) {
      if (!String(error?.message || '').toLowerCase().includes('duplicate column')) throw error
    }
  }

  await db.batch([
    db.prepare('DROP INDEX IF EXISTS uq_komite_review_stage_version'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uq_komite_review_stage_flow ON komite_pengajuan_reviews(pengajuan_id,version_number,stage,workflow_version)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
  ])
  await ensureActivityLogTables(db)
  // Audit and transition share one atomic batch, guarded by the old version.
  await db.batch([
    db.prepare(`INSERT INTO activity_logs (id,module,action,summary,entity_type,entity_id,before_json,after_json)
      SELECT lower(hex(randomblob(16))),'komite_pengajuan','migrate_verifier_flow',
        'Mengalihkan pengajuan ke alur Bendahara - Verifikator','komite_pengajuan',id,
        json_object('status',status,'workflow_version',workflow_version),
        json_object('status',CASE WHEN status IN ('menunggu_ketua','menunggu_kepala') THEN 'menunggu_ketua' ELSE status END,'workflow_version',2)
      FROM komite_pengajuan WHERE workflow_version=1 AND status NOT IN ('disetujui','ditolak')`),
    db.prepare(`UPDATE komite_pengajuan SET workflow_version=2,
      status=CASE WHEN status IN ('menunggu_ketua','menunggu_kepala') THEN 'menunggu_ketua' ELSE status END,
      updated_at=datetime('now') WHERE workflow_version=1 AND status NOT IN ('disetujui','ditolak')`),
  ])

  await db.batch([
    db.prepare(`UPDATE komite_pengajuan
      SET tahun_anggaran=COALESCE(tahun_anggaran, strftime('%Y','now') || '/' || (CAST(strftime('%Y','now') AS INTEGER) + 1)),
          kode_rkas_program=COALESCE(kode_rkas_program, '-')
      WHERE tahun_anggaran IS NULL OR kode_rkas_program IS NULL`),
    db.prepare(`INSERT OR IGNORE INTO komite_pengajuan_rincian (id,pengajuan_id,urutan,uraian,penerima_penyedia,jumlah)
      SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
        p.id, 1, COALESCE(NULLIF(p.uraian,''), p.judul), COALESCE(NULLIF(p.penerima_pembayaran,''), '-'), p.nominal
      FROM komite_pengajuan p
      WHERE NOT EXISTS (SELECT 1 FROM komite_pengajuan_rincian r WHERE r.pengajuan_id=p.id)`),
  ])

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO master_roles (value,label,is_custom) VALUES ('pembina_ekstrakurikuler','Pembina Ekstrakurikuler',0)`),
    db.prepare(`INSERT OR IGNORE INTO master_roles (value,label,is_custom) VALUES ('ketua_komite','Ketua Komite',0)`),
    db.prepare(`INSERT OR IGNORE INTO master_roles (value,label,is_custom) VALUES ('anggota_komite','Anggota Komite',0)`),
    ...['super_admin','kepsek','wakamad','pembina_ekstrakurikuler','bendahara_komite','ketua_komite','anggota_komite'].map(role =>
      db.prepare('INSERT OR IGNORE INTO role_features (role,feature_id) VALUES (?,?)').bind(role, KOMITE_FEATURE_ID)
    ),
    ...['pembina_ekstrakurikuler','ketua_komite','anggota_komite'].map(role =>
      db.prepare(`INSERT OR IGNORE INTO role_features (role,feature_id) VALUES (?,'dashboard')`).bind(role)
    ),
    db.prepare(`INSERT OR IGNORE INTO role_features (role,feature_id) VALUES ('pembina_ekstrakurikuler','ekstrakurikuler')`),
    db.prepare(`INSERT OR IGNORE INTO role_feature_permissions
      (role,feature_id,can_create,can_read,can_update,can_delete)
      VALUES ('bendahara_komite',?,1,1,1,0)`).bind(KOMITE_FEATURE_ID),
    db.prepare(`UPDATE role_feature_permissions SET can_create=1
      WHERE role='bendahara_komite' AND feature_id=?`).bind(KOMITE_FEATURE_ID),
  ])
}

export async function isNamedKomiteSubmitter(db: D1Database, userId: string) {
  const row = await db.prepare(`SELECT 1 AS ok FROM user_feature_overrides WHERE user_id = ? AND feature_id = ? AND action = 'grant' LIMIT 1`)
    .bind(userId, KOMITE_FEATURE_ID).first<{ ok: number }>()
  return Boolean(row)
}

export async function canSubmitKomite(db: D1Database, userId: string, roles?: string[]) {
  const resolved = roles ?? await getUserRoles(db, userId)
  return resolved.some(role => (KOMITE_SUBMITTER_ROLES as readonly string[]).includes(role)) || isNamedKomiteSubmitter(db, userId)
}

export async function canReviewKomite(
  db: D1Database,
  userId: string,
  row: { pengaju_id: string; status: string; ketua_delegate_id?: string | null },
  roles?: string[],
) {
  const stage = stageForStatus(row.status)
  if (!stage) return { allowed: false, stage: null as KomiteStage | null, bypass: false }
  const resolved = roles ?? await getUserRoles(db, userId)
  if (stage === 'kepala') return { allowed: false, stage, bypass: false }
  const verifier = stage === 'ketua' ? await komiteConfiguredUser(db, KOMITE_VERIFIER_KEY, 'anggota_komite') : null
  if (stage === 'ketua' && !verifier) return { allowed: false, stage, bypass: false }
  if (resolved.includes('super_admin')) return { allowed: true, stage, bypass: true }
  if (stage === 'bendahara' && userId === row.pengaju_id && resolved.includes('bendahara_komite')) {
    return { allowed: true, stage, bypass: false }
  }
  if (userId === row.pengaju_id) return { allowed: false, stage, bypass: false }
  return { allowed: stage === 'ketua' ? verifier?.id === userId : resolved.includes('bendahara_komite'), stage, bypass: false }
}

export async function canViewKomitePengajuan(
  db: D1Database,
  userId: string,
  row: { id: string; pengaju_id: string; status: string; ketua_delegate_id?: string | null },
  roles?: string[],
) {
  const resolved = roles ?? await getUserRoles(db, userId)
  if (resolved.includes('super_admin') || resolved.includes('kepsek') || row.pengaju_id === userId) return true
  if (row.status === 'disetujui' && resolved.includes('anggota_komite')) return true
  if (row.status === 'menunggu_ketua' && (await komiteConfiguredUser(db, KOMITE_VERIFIER_KEY, 'anggota_komite'))?.id === userId) return true
  const stage = stageForStatus(row.status)
  if (stage === 'bendahara' && resolved.includes('bendahara_komite')) return true
  const acted = await db.prepare('SELECT 1 AS ok FROM komite_pengajuan_reviews WHERE pengajuan_id = ? AND actor_id = ? LIMIT 1')
    .bind(row.id, userId).first<{ ok: number }>()
  return Boolean(acted)
}

export function komiteStatusLabel(status: string) {
  return ({
    draft: 'Draft', menunggu_bendahara: 'Menunggu Bendahara', menunggu_ketua: 'Menunggu Verifikator',
    menunggu_kepala: 'Menunggu Kepala Madrasah', perlu_revisi: 'Perlu Revisi', ditolak: 'Ditolak', disetujui: 'Disetujui',
  } as Record<string, string>)[status] || status
}
