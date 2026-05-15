-- RPPM Generator
CREATE TABLE IF NOT EXISTS rppm_documents (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  template_type   TEXT NOT NULL CHECK(template_type IN ('cooperative-learning','discovery-learning','lok-r','pbl','pjbl')),
  title           TEXT NOT NULL DEFAULT '',
  mapel           TEXT NOT NULL DEFAULT '',
  kelas_semester  TEXT NOT NULL DEFAULT '',
  alokasi_waktu   TEXT NOT NULL DEFAULT '',
  content_json    TEXT NOT NULL DEFAULT '{}',
  print_settings  TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINAL')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rppm_documents_user_updated ON rppm_documents(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rppm_documents_template ON rppm_documents(template_type);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'rppm-generator'),
('admin_tu', 'rppm-generator'),
('kepsek', 'rppm-generator'),
('wakamad', 'rppm-generator'),
('guru', 'rppm-generator'),
('wali_kelas', 'rppm-generator'),
('guru_bk', 'rppm-generator'),
('guru_tahfidz', 'rppm-generator'),
('guru_ppl', 'rppm-generator');
