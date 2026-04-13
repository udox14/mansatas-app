-- ============================================================
-- MIGRATION: Fitur Tahfidz & Progress Hafalan
-- ============================================================

-- 1. Siswa Tambahan Tahfidz (Manual Enrollment)
-- Menyimpan siswa non-Tahfidz yang ikut program tahfidz
CREATE TABLE IF NOT EXISTS tahfidz_siswa (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  ditambah_oleh TEXT REFERENCES "user"(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id)
);

-- 2. Progress Hafalan per Siswa & Surah (Aggregate State)
-- Meyimpan array ayat yang sudah dihafal hingga saat ini.
CREATE TABLE IF NOT EXISTS tahfidz_progress (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surah_nomor  INTEGER NOT NULL,   -- 1-114
  juz          INTEGER NOT NULL,   -- 1, 26-30
  ayat_hafal   TEXT NOT NULL DEFAULT '[]', -- JSON array of integers: [1,2,3]
  updated_by   TEXT REFERENCES "user"(id),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, surah_nomor)
);

-- 2. Riwayat Setoran Hafalan (Log / History)
-- Disimpan setiap kali guru mencentang ayat-ayat baru dan menekan simpan.
CREATE TABLE IF NOT EXISTS tahfidz_setoran_log (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surah_nomor  INTEGER NOT NULL,
  juz          INTEGER NOT NULL,
  ayat_baru    TEXT NOT NULL DEFAULT '[]', -- JSON array of integers: [4,5,6] yg disetorkan di sesi ini
  keterangan   TEXT,
  diinput_oleh TEXT NOT NULL REFERENCES "user"(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Nilai Tahfidz per Juz
CREATE TABLE IF NOT EXISTS tahfidz_nilai (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  juz          INTEGER NOT NULL,
  nilai        REAL NOT NULL DEFAULT 0,
  catatan      TEXT,
  updated_by   TEXT REFERENCES "user"(id),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, juz)
);

CREATE INDEX IF NOT EXISTS idx_tahfidz_prog_siswa ON tahfidz_progress(siswa_id);
CREATE INDEX IF NOT EXISTS idx_tahfidz_log_siswa ON tahfidz_setoran_log(siswa_id);
CREATE INDEX IF NOT EXISTS idx_tahfidz_nilai_siswa ON tahfidz_nilai(siswa_id);

-- ============================================================
-- AUTO INSERT ACCESS UNTUK ROLE guru_tahfidz
-- ============================================================
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('guru_tahfidz', 'dashboard'),
('guru_tahfidz', 'tahfidz'),
('guru_tahfidz', 'siswa'),
('super_admin', 'tahfidz'),
('kepsek', 'tahfidz'),
('wakamad', 'tahfidz');
