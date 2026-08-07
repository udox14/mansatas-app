-- ============================================================
-- TKA (Tes Kemampuan Akademik) — versioning DDL + index
-- Tab Hasil TKA & Analitik sudah dihapus dari UI (fokus pendataan
-- dan rekap pemilihan). Tabel tka_hasil tetap dipertahankan (data
-- tidak dihapus) dan diberi index agar query membaca aman.
-- ============================================================

-- DDL idempotent (aman dijalankan berulang; hanya membuat bila belum ada)
CREATE TABLE IF NOT EXISTS tka_mapel_pilihan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  mapel_pilihan1  TEXT,
  mapel_pilihan2  TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);

CREATE TABLE IF NOT EXISTS tka_hasil (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  siswa_id          TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  nomor_peserta     TEXT,
  nilai_bind        REAL,   kategori_bind     TEXT,
  nilai_mat         REAL,   kategori_mat      TEXT,
  nilai_bing        REAL,   kategori_bing     TEXT,
  mapel_pilihan1    TEXT,
  nilai_pilihan1    REAL,   kategori_pilihan1 TEXT,
  mapel_pilihan2    TEXT,
  nilai_pilihan2    REAL,   kategori_pilihan2 TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);

-- Index untuk query rekap/pendataan yang memfilter tahun ajaran
CREATE INDEX IF NOT EXISTS idx_tka_mapel_pilihan_ta   ON tka_mapel_pilihan(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_tka_mapel_pilihan_p1   ON tka_mapel_pilihan(tahun_ajaran_id, mapel_pilihan1);
CREATE INDEX IF NOT EXISTS idx_tka_mapel_pilihan_p2   ON tka_mapel_pilihan(tahun_ajaran_id, mapel_pilihan2);
CREATE INDEX IF NOT EXISTS idx_tka_mapel_pilihan_siswa ON tka_mapel_pilihan(siswa_id);
CREATE INDEX IF NOT EXISTS idx_tka_hasil_ta           ON tka_hasil(tahun_ajaran_id);
