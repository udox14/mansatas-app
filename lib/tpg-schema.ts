export async function ensureTpgSchema(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tpg_s36_uploads (
      user_id           TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      period_year       INTEGER NOT NULL,
      period_month      INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
      r2_key            TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_size         INTEGER NOT NULL DEFAULT 0,
      uploaded_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tpg_s36_period ON tpg_s36_uploads(period_year, period_month)').run()

  for (const statement of [
    'ALTER TABLE "user" ADD COLUMN signature_url TEXT',
    'ALTER TABLE ckh_documents ADD COLUMN signature_enabled INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE ckh_documents ADD COLUMN signature_x_mm REAL NOT NULL DEFAULT 14',
    'ALTER TABLE ckh_documents ADD COLUMN signature_y_mm REAL NOT NULL DEFAULT 12',
    'ALTER TABLE ckh_documents ADD COLUMN signature_width_mm REAL NOT NULL DEFAULT 38',
  ]) {
    try {
      await db.prepare(statement).run()
    } catch {
      // Column already exists, keep going.
    }
  }

  const roles = [
    'super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas',
    'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam',
  ]
  await db.batch(roles.map(role => (
    db.prepare('INSERT OR IGNORE INTO role_features (role, feature_id) VALUES (?, ?)')
      .bind(role, 'tpg-dokumen')
  )))
}
