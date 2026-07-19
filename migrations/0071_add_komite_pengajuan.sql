-- Workflow pengajuan dan persetujuan dana Komite.
CREATE TABLE IF NOT EXISTS komite_pengajuan (
  id TEXT PRIMARY KEY,
  judul TEXT NOT NULL,
  uraian TEXT NOT NULL,
  nominal INTEGER NOT NULL CHECK (nominal > 0),
  pengaju_id TEXT NOT NULL REFERENCES "user"(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','menunggu_bendahara','menunggu_ketua','menunggu_kepala','perlu_revisi','ditolak','disetujui')),
  current_version INTEGER NOT NULL DEFAULT 1,
  nomor_spb TEXT COLLATE NOCASE UNIQUE,
  penerima_pembayaran TEXT,
  submitted_at TEXT,
  approved_at TEXT,
  rejected_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS komite_pengajuan_versions (
  id TEXT PRIMARY KEY,
  pengajuan_id TEXT NOT NULL REFERENCES komite_pengajuan(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  UNIQUE (pengajuan_id, version_number)
);

CREATE TABLE IF NOT EXISTS komite_pengajuan_files (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES komite_pengajuan_versions(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS komite_pengajuan_reviews (
  id TEXT PRIMARY KEY,
  pengajuan_id TEXT NOT NULL REFERENCES komite_pengajuan(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('bendahara','ketua','kepala')),
  action TEXT NOT NULL CHECK (action IN ('setujui','minta_revisi','tolak')),
  catatan TEXT,
  actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_signature_url TEXT,
  is_super_admin_bypass INTEGER NOT NULL DEFAULT 0,
  nomor_spb_snapshot TEXT,
  penerima_snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_komite_pengajuan_pengaju ON komite_pengajuan(pengaju_id, created_at);
CREATE INDEX IF NOT EXISTS idx_komite_pengajuan_status ON komite_pengajuan(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_komite_versions_pengajuan ON komite_pengajuan_versions(pengajuan_id, version_number);
CREATE INDEX IF NOT EXISTS idx_komite_files_version ON komite_pengajuan_files(version_id);
CREATE INDEX IF NOT EXISTS idx_komite_reviews_actor ON komite_pengajuan_reviews(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_komite_reviews_pengajuan ON komite_pengajuan_reviews(pengajuan_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_komite_review_stage_version ON komite_pengajuan_reviews(pengajuan_id, version_number, stage);

INSERT OR IGNORE INTO master_roles (value, label, is_custom) VALUES
  ('pembina_ekstrakurikuler', 'Pembina Ekstrakurikuler', 0),
  ('ketua_komite', 'Ketua Komite', 0),
  ('anggota_komite', 'Anggota Komite', 0);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('pembina_ekstrakurikuler', 'dashboard'),
  ('ketua_komite', 'dashboard'),
  ('anggota_komite', 'dashboard'),
  ('super_admin', 'komite-pengajuan'),
  ('kepsek', 'komite-pengajuan'),
  ('wakamad', 'komite-pengajuan'),
  ('pembina_ekstrakurikuler', 'komite-pengajuan'),
  ('pembina_ekstrakurikuler', 'ekstrakurikuler'),
  ('bendahara_komite', 'komite-pengajuan'),
  ('ketua_komite', 'komite-pengajuan'),
  ('anggota_komite', 'komite-pengajuan');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('super_admin', 'komite-pengajuan', 1, 1, 1, 1),
  ('kepsek', 'komite-pengajuan', 1, 1, 1, 0),
  ('wakamad', 'komite-pengajuan', 1, 1, 1, 0),
  ('pembina_ekstrakurikuler', 'komite-pengajuan', 1, 1, 1, 0),
  ('bendahara_komite', 'komite-pengajuan', 0, 1, 1, 0),
  ('ketua_komite', 'komite-pengajuan', 0, 1, 1, 0),
  ('anggota_komite', 'komite-pengajuan', 0, 1, 0, 0);
