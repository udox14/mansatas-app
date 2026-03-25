-- ============================================================
-- MIGRATION: TKA (Tes Kemampuan Akademik)
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-tka.sql
-- ============================================================

-- 1. Mapel pilihan TKA per siswa per tahun ajaran
CREATE TABLE IF NOT EXISTS tka_mapel_pilihan (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id         TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  mapel_pilihan_1  TEXT,
  mapel_pilihan_2  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);

CREATE INDEX IF NOT EXISTS idx_tka_mapel_pilihan_ta
  ON tka_mapel_pilihan(tahun_ajaran_id);

-- 2. Hasil TKA dari PDF resmi pemerintah
CREATE TABLE IF NOT EXISTS tka_hasil (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id         TEXT REFERENCES siswa(id) ON DELETE SET NULL,
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  nomor_peserta    TEXT,
  raw_nama_pdf     TEXT NOT NULL,
  nilai_bind       REAL,
  nilai_mat        REAL,
  nilai_bing       REAL,
  mapel_p1         TEXT,
  nilai_p1         REAL,
  mapel_p2         TEXT,
  nilai_p2         REAL,
  match_confidence INTEGER NOT NULL DEFAULT 100,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tahun_ajaran_id, nomor_peserta)
);

CREATE INDEX IF NOT EXISTS idx_tka_hasil_ta
  ON tka_hasil(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_tka_hasil_siswa
  ON tka_hasil(siswa_id, tahun_ajaran_id);
