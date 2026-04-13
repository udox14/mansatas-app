-- ============================================================
-- MIGRATION: Bimbingan Konseling (BK)
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-bk.sql
-- ============================================================

-- 1. Kelas binaan guru BK (many-to-many)
CREATE TABLE IF NOT EXISTS kelas_binaan_bk (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_bk_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kelas_id   TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guru_bk_id, kelas_id)
);

-- 2. Master topik permasalahan BK
CREATE TABLE IF NOT EXISTS bk_topik (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bidang     TEXT NOT NULL CHECK(bidang IN ('Pribadi','Karir','Sosial','Akademik')),
  nama       TEXT NOT NULL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(bidang, nama)
);

-- 3. Rekaman layanan BK
CREATE TABLE IF NOT EXISTS bk_rekaman (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  guru_bk_id      TEXT NOT NULL REFERENCES "user"(id),
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id),
  bidang          TEXT NOT NULL CHECK(bidang IN ('Pribadi','Karir','Sosial','Akademik')),
  topik_id        TEXT REFERENCES bk_topik(id) ON DELETE SET NULL,
  deskripsi       TEXT,
  penanganan      TEXT NOT NULL DEFAULT '[]',
  -- JSON array of {tipe, tanggal, catatan}
  -- tipe: KONSELING | KONSELING_KELOMPOK | HOME_VISIT
  tindak_lanjut   TEXT NOT NULL DEFAULT 'BELUM',
  -- BELUM | SUDAH | KOLABORASI_ORANG_TUA | PEMANGGILAN_ORANG_TUA
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_kelas_binaan_guru    ON kelas_binaan_bk(guru_bk_id);
CREATE INDEX IF NOT EXISTS idx_kelas_binaan_kelas   ON kelas_binaan_bk(kelas_id);
CREATE INDEX IF NOT EXISTS idx_bk_topik_bidang      ON bk_topik(bidang);
CREATE INDEX IF NOT EXISTS idx_bk_rekaman_siswa     ON bk_rekaman(siswa_id, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_bk_rekaman_guru      ON bk_rekaman(guru_bk_id, tahun_ajaran_id);

-- 5. Seed topik default
INSERT OR IGNORE INTO bk_topik (bidang, nama) VALUES
  ('Pribadi', 'Masalah keluarga'),
  ('Pribadi', 'Kesehatan mental'),
  ('Pribadi', 'Kepercayaan diri'),
  ('Pribadi', 'Manajemen emosi'),
  ('Karir', 'Pilihan jurusan'),
  ('Karir', 'Minat dan bakat'),
  ('Karir', 'Rencana masa depan'),
  ('Sosial', 'Masalah pertemanan'),
  ('Sosial', 'Bullying'),
  ('Sosial', 'Adaptasi lingkungan'),
  ('Akademik', 'Kesulitan belajar'),
  ('Akademik', 'Motivasi belajar'),
  ('Akademik', 'Kehadiran / absensi');
