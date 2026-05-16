-- Dokumen TPG: S36 upload metadata and feature access
CREATE TABLE IF NOT EXISTS tpg_s36_uploads (
  user_id           TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  period_year       INTEGER NOT NULL,
  period_month      INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
  r2_key            TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size         INTEGER NOT NULL DEFAULT 0,
  uploaded_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tpg_s36_period ON tpg_s36_uploads(period_year, period_month);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'tpg-dokumen'),
('admin_tu', 'tpg-dokumen'),
('kepsek', 'tpg-dokumen'),
('wakamad', 'tpg-dokumen'),
('guru', 'tpg-dokumen'),
('wali_kelas', 'tpg-dokumen'),
('guru_bk', 'tpg-dokumen'),
('guru_piket', 'tpg-dokumen'),
('guru_tahfidz', 'tpg-dokumen'),
('operator', 'tpg-dokumen'),
('pramubakti', 'tpg-dokumen'),
('satpam', 'tpg-dokumen');
