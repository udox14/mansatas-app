-- Migration: Tes Kemampuan Akademik (TKA)
-- Jalankan migration ini untuk menambahkan fitur TKA

-- Tabel pilihan mapel TKA per siswa
CREATE TABLE IF NOT EXISTS tka_mapel_pilihan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  mapel_pilihan1  TEXT,
  mapel_pilihan2  TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);

-- Tabel hasil TKA per siswa (dari upload PDF)
CREATE TABLE IF NOT EXISTS tka_hasil (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  siswa_id          TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  nomor_peserta     TEXT,
  nilai_bind        REAL,
  kategori_bind     TEXT,
  nilai_mat         REAL,
  kategori_mat      TEXT,
  nilai_bing        REAL,
  kategori_bing     TEXT,
  mapel_pilihan1    TEXT,
  nilai_pilihan1    REAL,
  kategori_pilihan1 TEXT,
  mapel_pilihan2    TEXT,
  nilai_pilihan2    REAL,
  kategori_pilihan2 TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_tka_mapel_ta ON tka_mapel_pilihan(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_tka_mapel_siswa ON tka_mapel_pilihan(siswa_id);
CREATE INDEX IF NOT EXISTS idx_tka_hasil_ta ON tka_hasil(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_tka_hasil_siswa ON tka_hasil(siswa_id);
