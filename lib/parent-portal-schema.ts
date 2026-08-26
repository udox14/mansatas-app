import { ensureSchemaOnce } from '@/lib/schema-guard'

export async function ensureParentPortalEnhancementSchema(db: D1Database) {
  await ensureSchemaOnce('parent-portal-enhancements', async () => {
    const notificationColumns = await db.prepare('PRAGMA table_info(parent_notifications)').all<{ name: string }>()
    if (!(notificationColumns.results || []).some(column => column.name === 'archived_at')) {
      await db.prepare('ALTER TABLE parent_notifications ADD COLUMN archived_at TEXT').run()
    }

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS parent_tka_approvals (
        id TEXT PRIMARY KEY,
        siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
        tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
        selection_fingerprint TEXT NOT NULL,
        selection_snapshot TEXT NOT NULL,
        statement_version TEXT NOT NULL,
        approved_by_parent_identifier TEXT NOT NULL,
        approved_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(siswa_id, tahun_ajaran_id, selection_fingerprint)
      )
    `).run()
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_parent_tka_approvals_lookup
      ON parent_tka_approvals(siswa_id, tahun_ajaran_id, approved_at DESC)
    `).run()
  })
}

