-- CKH Generator
ALTER TABLE "user" ADD COLUMN jabatan_cetak TEXT;

CREATE TABLE IF NOT EXISTS ckh_templates (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  role          TEXT NOT NULL,
  jabatan_cetak TEXT,
  title         TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(role, jabatan_cetak, title)
);

CREATE TABLE IF NOT EXISTS ckh_template_notes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  template_id TEXT NOT NULL REFERENCES ckh_templates(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(template_id, note)
);

CREATE TABLE IF NOT EXISTS ckh_documents (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  year       INTEGER NOT NULL,
  month      INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  status     TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINAL')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, year, month)
);

CREATE TABLE IF NOT EXISTS ckh_rows (
  id                         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id                TEXT NOT NULL REFERENCES ckh_documents(id) ON DELETE CASCADE,
  tanggal                    TEXT NOT NULL,
  row_order                  INTEGER NOT NULL DEFAULT 0,
  kegiatan_bulanan           TEXT NOT NULL,
  catatan_harian             TEXT NOT NULL,
  vol                        INTEGER NOT NULL DEFAULT 1,
  satuan                     TEXT NOT NULL DEFAULT 'Kegiatan',
  source                     TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('autofill','calendar','manual')),
  source_key                 TEXT,
  is_manual                  INTEGER NOT NULL DEFAULT 0,
  has_conflict               INTEGER NOT NULL DEFAULT 0,
  suggested_kegiatan_bulanan TEXT,
  suggested_catatan_harian   TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(document_id, tanggal, source_key)
);

CREATE INDEX IF NOT EXISTS idx_ckh_templates_scope ON ckh_templates(role, jabatan_cetak, is_active);
CREATE INDEX IF NOT EXISTS idx_ckh_template_notes_template ON ckh_template_notes(template_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ckh_rows_document ON ckh_rows(document_id, tanggal, row_order);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'ckh-generator'),
('admin_tu', 'ckh-generator'),
('kepsek', 'ckh-generator'),
('wakamad', 'ckh-generator'),
('guru', 'ckh-generator'),
('wali_kelas', 'ckh-generator'),
('guru_bk', 'ckh-generator'),
('guru_piket', 'ckh-generator'),
('guru_tahfidz', 'ckh-generator'),
('operator', 'ckh-generator'),
('pramubakti', 'ckh-generator'),
('satpam', 'ckh-generator');

INSERT OR IGNORE INTO ckh_templates (role, jabatan_cetak, title, sort_order) VALUES
('guru', NULL, 'Menyusun Rencana Pembelajaran', 10),
('guru', NULL, 'Melaksanakan proses pembelajaran', 20),
('guru', NULL, 'Melaksanakan tugas dinas lainnya', 90),
('wali_kelas', NULL, 'Melaksanakan pembinaan wali kelas', 30),
('wali_kelas', NULL, 'Melaksanakan tugas dinas lainnya', 90),
('guru_bk', NULL, 'Melaksanakan layanan bimbingan konseling', 20),
('guru_bk', NULL, 'Melaksanakan tugas dinas lainnya', 90),
('admin_tu', NULL, 'Melaksanakan layanan administrasi madrasah', 20),
('admin_tu', NULL, 'Melaksanakan tugas dinas lainnya', 90),
('operator', NULL, 'Melaksanakan pengelolaan data aplikasi madrasah', 20),
('operator', NULL, 'Melaksanakan tugas dinas lainnya', 90),
('pramubakti', NULL, 'Melaksanakan layanan kebersihan dan perawatan lingkungan madrasah', 20),
('pramubakti', NULL, 'Melaksanakan tugas dinas lainnya', 90),
('satpam', NULL, 'Melaksanakan pengamanan lingkungan madrasah', 20),
('satpam', NULL, 'Melaksanakan tugas dinas lainnya', 90);

INSERT OR IGNORE INTO ckh_template_notes (template_id, note, sort_order)
SELECT id, 'Menyiapkan bahan ajar', 10
FROM ckh_templates
WHERE role = 'guru' AND title = 'Menyusun Rencana Pembelajaran';

INSERT OR IGNORE INTO ckh_template_notes (template_id, note, sort_order)
SELECT id, 'Melaksanakan tugas sebagai Guru Piket', 10
FROM ckh_templates
WHERE title = 'Melaksanakan tugas dinas lainnya';
