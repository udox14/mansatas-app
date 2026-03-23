-- ============================================================
-- MIGRATION: Psikotes & Minat
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-psikotes.sql
-- ============================================================

-- 1. Data psikotes per siswa (UNIQUE per siswa — tes hanya sekali kelas 10)
CREATE TABLE IF NOT EXISTS siswa_psikotes (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
  -- CFIT
  iq_score        INTEGER,
  iq_klasifikasi  TEXT,
  -- Bakat
  bakat_ver       INTEGER,
  bakat_num       INTEGER,
  bakat_skl       INTEGER,
  bakat_abs       INTEGER,
  bakat_mek       INTEGER,
  bakat_rr        INTEGER,
  bakat_kkk       INTEGER,
  -- Minat
  minat_ps        INTEGER,
  minat_nat       INTEGER,
  minat_mek       INTEGER,
  minat_bis       INTEGER,
  minat_art       INTEGER,
  minat_si        INTEGER,
  minat_v         INTEGER,
  minat_m         INTEGER,
  minat_k         INTEGER,
  -- RIASEC & Rekomendasi
  riasec          TEXT,
  mapel_pilihan   TEXT,
  rekom_raw       TEXT,  -- nilai asli dari excel: "MIA/IIS"
  rekom_jurusan   TEXT,  -- hasil mapping ke jurusan DB: "MIPA"
  -- Kepribadian
  mbti            TEXT,
  gaya_belajar    TEXT,
  -- Usia saat tes
  usia_thn        INTEGER,
  usia_bln        INTEGER,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Mapping label excel → jurusan di DB (fleksibel, bisa ubah kapan saja)
CREATE TABLE IF NOT EXISTS psikotes_rekom_mapping (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  label_excel TEXT NOT NULL UNIQUE,  -- "MIA", "IIS", "MIA/IIS", "IIS/MIA"
  jurusan_db  TEXT NOT NULL,         -- "MIPA", "SOSHUM", dll
  keterangan  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_psikotes_siswa    ON siswa_psikotes(siswa_id);
CREATE INDEX IF NOT EXISTS idx_psikotes_rekom    ON siswa_psikotes(rekom_jurusan);
CREATE INDEX IF NOT EXISTS idx_psikotes_gaya     ON siswa_psikotes(gaya_belajar);
CREATE INDEX IF NOT EXISTS idx_psikotes_iq       ON siswa_psikotes(iq_klasifikasi);

-- 4. Seed mapping default (bisa diedit user)
INSERT OR IGNORE INTO psikotes_rekom_mapping (label_excel, jurusan_db, keterangan) VALUES
  ('MIA',     'MIPA',     'Matematika dan Ilmu Alam'),
  ('IIS',     'SOSHUM',   'Ilmu-Ilmu Sosial'),
  ('MIA/IIS', 'MIPA',     'Utama MIA, alternatif IIS'),
  ('IIS/MIA', 'SOSHUM',   'Utama IIS, alternatif MIA'),
  ('IBB',     'KEAGAMAAN','Ilmu Bahasa dan Budaya'),
  ('IIK',     'KEAGAMAAN','Ilmu-Ilmu Keagamaan'),
  ('UMUM',    'UMUM',     'Tidak ada rekomendasi spesifik');
