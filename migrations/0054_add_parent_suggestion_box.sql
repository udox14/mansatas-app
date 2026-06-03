-- Kotak Saran Portal Orang Tua
CREATE TABLE IF NOT EXISTS parent_suggestions (
  id             TEXT PRIMARY KEY,
  parent_user_id TEXT,
  siswa_id       TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  category       TEXT NOT NULL CHECK(category IN ('Akademik', 'Kesiswaan', 'Sarpras', 'Keuangan', 'Layanan', 'Lainnya')),
  title          TEXT NOT NULL,
  message        TEXT NOT NULL,
  is_anonymous   INTEGER NOT NULL DEFAULT 0 CHECK(is_anonymous IN (0, 1)),
  status         TEXT NOT NULL DEFAULT 'baru' CHECK(status IN ('baru', 'dibaca', 'diproses', 'selesai')),
  read_at        TEXT,
  handled_by     TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  handled_at     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_suggestions_siswa_created
  ON parent_suggestions(siswa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_suggestions_status_created
  ON parent_suggestions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_suggestions_category_created
  ON parent_suggestions(category, created_at DESC);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'kotak-saran-ortu'),
  ('kepsek', 'kotak-saran-ortu'),
  ('wakamad', 'kotak-saran-ortu'),
  ('admin_tu', 'kotak-saran-ortu');
