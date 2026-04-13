-- ============================================================
-- MIGRATION: Program Unggulan
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-program-unggulan.sql
-- ============================================================

-- 1. Kelas Unggulan — menandai kelas mana saja yang ikut program unggulan
CREATE TABLE IF NOT EXISTS pu_kelas_unggulan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id        TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kelas_id, tahun_ajaran_id)
);

-- 2. Guru di-assign ke kelas unggulan beserta jam mengajar
CREATE TABLE IF NOT EXISTS pu_guru_kelas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  jam_mengajar    INTEGER NOT NULL DEFAULT 2 CHECK(jam_mengajar BETWEEN 1 AND 4),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guru_id, pu_kelas_id)
);

-- 3. Materi tes — konten HTML (teks, gambar, audio, tabel)
CREATE TABLE IF NOT EXISTS pu_materi (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  judul           TEXT NOT NULL,
  konten          TEXT NOT NULL DEFAULT '',
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  urutan          INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Hasil tes — catatan per siswa per sesi tes
--    status: 'belum' (baru di-assign), 'sudah' (sudah dinilai), 'sakit', 'izin', 'alfa'
--    round_number: rotasi ke-berapa (untuk fair queue)
CREATE TABLE IF NOT EXISTS pu_hasil_tes (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL DEFAULT (date('now')),
  nilai           TEXT CHECK(nilai IN ('Lancar', 'Kurang Lancar', 'Tidak Lancar')),
  status          TEXT NOT NULL DEFAULT 'belum'
                  CHECK(status IN ('belum', 'sudah', 'sakit', 'izin', 'alfa')),
  round_number    INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pu_kelas_ta        ON pu_kelas_unggulan(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_pu_kelas_kelas     ON pu_kelas_unggulan(kelas_id);
CREATE INDEX IF NOT EXISTS idx_pu_guru_guru       ON pu_guru_kelas(guru_id);
CREATE INDEX IF NOT EXISTS idx_pu_guru_pukelas    ON pu_guru_kelas(pu_kelas_id);
CREATE INDEX IF NOT EXISTS idx_pu_hasil_kelas_tgl ON pu_hasil_tes(pu_kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_pu_hasil_siswa     ON pu_hasil_tes(siswa_id);
CREATE INDEX IF NOT EXISTS idx_pu_hasil_guru_tgl  ON pu_hasil_tes(guru_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_pu_materi_kelas    ON pu_materi(pu_kelas_id, is_active);
