-- Parent portal discipline: immutable record snapshots, publication workflow,
-- and one-shot parent clarification requests.

ALTER TABLE siswa_pelanggaran ADD COLUMN nama_pelanggaran_snapshot TEXT;
ALTER TABLE siswa_pelanggaran ADD COLUMN kategori_snapshot TEXT;
ALTER TABLE siswa_pelanggaran ADD COLUMN poin_snapshot INTEGER;
ALTER TABLE siswa_pelanggaran ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'published'
  CHECK(publication_status IN ('pending', 'published', 'rejected'));
ALTER TABLE siswa_pelanggaran ADD COLUMN reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE siswa_pelanggaran ADD COLUMN reviewed_at TEXT;
ALTER TABLE siswa_pelanggaran ADD COLUMN review_note TEXT;

UPDATE siswa_pelanggaran
SET nama_pelanggaran_snapshot = (
      SELECT mp.nama_pelanggaran FROM master_pelanggaran mp WHERE mp.id = siswa_pelanggaran.master_pelanggaran_id
    ),
    kategori_snapshot = (
      SELECT mp.kategori FROM master_pelanggaran mp WHERE mp.id = siswa_pelanggaran.master_pelanggaran_id
    ),
    poin_snapshot = (
      SELECT mp.poin FROM master_pelanggaran mp WHERE mp.id = siswa_pelanggaran.master_pelanggaran_id
    )
WHERE nama_pelanggaran_snapshot IS NULL
   OR kategori_snapshot IS NULL
   OR poin_snapshot IS NULL;

CREATE INDEX IF NOT EXISTS idx_siswa_pelanggaran_parent_portal
  ON siswa_pelanggaran(siswa_id, publication_status, tahun_ajaran_id, tanggal DESC);

CREATE TABLE IF NOT EXISTS parent_discipline_clarifications (
  id                         TEXT PRIMARY KEY,
  siswa_pelanggaran_id       TEXT REFERENCES siswa_pelanggaran(id) ON DELETE SET NULL,
  siswa_id                   TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  parent_session_id          TEXT,
  pelanggaran_nama_snapshot  TEXT NOT NULL,
  pelanggaran_kategori_snapshot TEXT NOT NULL,
  pelanggaran_poin_snapshot  INTEGER NOT NULL,
  pelanggaran_tanggal_snapshot TEXT NOT NULL,
  request_message            TEXT NOT NULL CHECK(length(trim(request_message)) BETWEEN 1 AND 2000),
  status                     TEXT NOT NULL DEFAULT 'baru'
    CHECK(status IN ('baru', 'diproses', 'selesai', 'ditolak')),
  response_message           TEXT CHECK(response_message IS NULL OR length(trim(response_message)) BETWEEN 1 AND 2000),
  handled_by                 TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  handled_at                 TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_discipline_clarification_once
  ON parent_discipline_clarifications(siswa_pelanggaran_id)
  WHERE siswa_pelanggaran_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parent_discipline_clarification_student
  ON parent_discipline_clarifications(siswa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_discipline_clarification_status
  ON parent_discipline_clarifications(status, created_at DESC);
