-- ============================================================
-- MIGRATION: Program Unggulan v2 — Materi Mingguan & Jadwal Sampling
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=migrations/schema-migration-pu-v2.sql
-- ============================================================

-- 1. Materi mingguan per program
CREATE TABLE IF NOT EXISTS pu_materi_mingguan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  program         TEXT NOT NULL CHECK(program IN ('tahfidz','bahasa_arab','bahasa_inggris')),
  minggu_mulai    TEXT NOT NULL,
  konten          TEXT NOT NULL DEFAULT '{}',
  created_by      TEXT REFERENCES "user"(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Many-to-many: materi ↔ kelas unggulan
CREATE TABLE IF NOT EXISTS pu_materi_mingguan_kelas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  materi_id       TEXT NOT NULL REFERENCES pu_materi_mingguan(id) ON DELETE CASCADE,
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  UNIQUE(materi_id, pu_kelas_id)
);

-- 3. Jadwal sampling mingguan: siswa mana dites hari apa
CREATE TABLE IF NOT EXISTS pu_jadwal_sampling (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  minggu_mulai    TEXT NOT NULL,
  hari            INTEGER NOT NULL CHECK(hari BETWEEN 1 AND 6),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pu_kelas_id, siswa_id, minggu_mulai)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pu_materi_mingguan_prog ON pu_materi_mingguan(program, minggu_mulai);
CREATE INDEX IF NOT EXISTS idx_pu_materi_mingguan_kelas ON pu_materi_mingguan_kelas(materi_id);
CREATE INDEX IF NOT EXISTS idx_pu_materi_mingguan_kelas2 ON pu_materi_mingguan_kelas(pu_kelas_id);
CREATE INDEX IF NOT EXISTS idx_pu_jadwal_sampling_kelas ON pu_jadwal_sampling(pu_kelas_id, minggu_mulai);
CREATE INDEX IF NOT EXISTS idx_pu_jadwal_sampling_siswa ON pu_jadwal_sampling(siswa_id, minggu_mulai);
