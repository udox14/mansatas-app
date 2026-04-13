-- Migration: Nilai Harian Guru
-- Tabel untuk menyimpan sesi penilaian (header) dan nilai per siswa (detail)

CREATE TABLE IF NOT EXISTS nilai_harian_header (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  judul           TEXT NOT NULL,        -- "Ulangan Harian 1", "Tugas 2", dll
  tanggal         TEXT NOT NULL,        -- format YYYY-MM-DD
  keterangan      TEXT,                 -- catatan opsional
  kkm             INTEGER DEFAULT 75,   -- KKM per sesi (bisa di-override)
  created_by      TEXT NOT NULL REFERENCES "user"(id),
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nilai_harian_detail (
  id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  header_id TEXT NOT NULL REFERENCES nilai_harian_header(id) ON DELETE CASCADE,
  siswa_id  TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  nilai     REAL NOT NULL DEFAULT 0,
  catatan   TEXT,
  UNIQUE(header_id, siswa_id)
);

-- Tabel pengaturan KKM global per penugasan (opsional, fallback ke 75)
CREATE TABLE IF NOT EXISTS nilai_harian_kkm (
  penugasan_id TEXT PRIMARY KEY REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  kkm          INTEGER NOT NULL DEFAULT 75,
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nilai_header_penugasan ON nilai_harian_header(penugasan_id);
CREATE INDEX IF NOT EXISTS idx_nilai_header_ta        ON nilai_harian_header(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_nilai_detail_header    ON nilai_harian_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_nilai_detail_siswa     ON nilai_harian_detail(siswa_id);
