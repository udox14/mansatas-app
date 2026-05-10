-- Pengumuman khusus portal orang tua
CREATE TABLE IF NOT EXISTS parent_announcements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_scope TEXT NOT NULL DEFAULT 'all', -- all | kelas
  kelas_id TEXT REFERENCES kelas(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  publish_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_announcements_active
  ON parent_announcements(is_active, publish_at);
CREATE INDEX IF NOT EXISTS idx_parent_announcements_scope
  ON parent_announcements(target_scope, kelas_id);

-- Feature baru untuk kelola pengumuman ortu
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('super_admin', 'pengumuman-ortu');
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('admin_tu', 'pengumuman-ortu');
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('kepsek', 'pengumuman-ortu');
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('wakamad', 'pengumuman-ortu');
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('wali_kelas', 'pengumuman-ortu');
