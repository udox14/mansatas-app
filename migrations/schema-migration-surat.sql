-- ============================================================
-- MIGRATION: Surat Keluar (Generate & Log)
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=migrations/schema-migration-surat.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS surat_keluar (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis_surat     TEXT NOT NULL,
  nomor_urut      INTEGER NOT NULL,
  nomor_surat     TEXT NOT NULL,
  tahun           INTEGER NOT NULL,
  perihal         TEXT,
  data_surat      TEXT NOT NULL DEFAULT '{}',
  dicetak_oleh    TEXT NOT NULL REFERENCES "user"(id),
  nama_pencetak   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_surat_jenis ON surat_keluar(jenis_surat);
CREATE INDEX IF NOT EXISTS idx_surat_tahun ON surat_keluar(tahun);
CREATE INDEX IF NOT EXISTS idx_surat_created ON surat_keluar(created_at);
