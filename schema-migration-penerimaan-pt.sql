-- Migration: Fitur Penerimaan Perguruan Tinggi Kelas 12
-- Lokasi: schema-migration-penerimaan-pt.sql

CREATE TABLE IF NOT EXISTS penerimaan_pt (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id),
  jalur           TEXT NOT NULL,
  -- SNBP | SNBT | SPAN_PTKIN | UM_PTKIN | MANDIRI | PMB_PTS | LAINNYA
  kampus_id       TEXT NOT NULL,    -- id dari kampus.json
  kampus_nama     TEXT NOT NULL,    -- nama lengkap (denormalized)
  program_studi   TEXT,
  status          TEXT NOT NULL DEFAULT 'DITERIMA',
  -- DITERIMA | TIDAK_DITERIMA | MENGUNDURKAN_DIRI
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pt_siswa    ON penerimaan_pt(siswa_id, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_pt_kampus   ON penerimaan_pt(kampus_id, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_pt_jalur    ON penerimaan_pt(jalur, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_pt_ta       ON penerimaan_pt(tahun_ajaran_id);
