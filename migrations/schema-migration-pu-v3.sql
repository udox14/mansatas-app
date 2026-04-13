-- ============================================================
-- MIGRATION: Program Unggulan v3 — Fix jadwal sampling constraint
-- Ubah UNIQUE(pu_kelas_id, siswa_id, minggu_mulai)
--   → UNIQUE(pu_kelas_id, siswa_id, minggu_mulai, hari)
-- Sehingga satu siswa bisa dites di beberapa hari berbeda dalam seminggu
-- (diperlukan agar setiap hari selalu ada siswa untuk setiap guru)
--
-- Jalankan:
--   wrangler d1 execute mansatas-db --remote --file=migrations/schema-migration-pu-v3.sql
-- ============================================================

-- 1. Buat tabel baru dengan constraint yang diperbarui
CREATE TABLE IF NOT EXISTS pu_jadwal_sampling_v3 (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  minggu_mulai    TEXT NOT NULL,
  hari            INTEGER NOT NULL CHECK(hari BETWEEN 1 AND 6),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pu_kelas_id, siswa_id, minggu_mulai, hari)
);

-- 2. Salin data lama (semua data lama sudah pasti unik per hari)
INSERT OR IGNORE INTO pu_jadwal_sampling_v3
  SELECT id, pu_kelas_id, siswa_id, minggu_mulai, hari, created_at
  FROM pu_jadwal_sampling;

-- 3. Hapus tabel lama
DROP TABLE pu_jadwal_sampling;

-- 4. Rename tabel baru
ALTER TABLE pu_jadwal_sampling_v3 RENAME TO pu_jadwal_sampling;

-- 5. Buat ulang indexes
CREATE INDEX IF NOT EXISTS idx_pu_jadwal_sampling_kelas ON pu_jadwal_sampling(pu_kelas_id, minggu_mulai);
CREATE INDEX IF NOT EXISTS idx_pu_jadwal_sampling_siswa ON pu_jadwal_sampling(siswa_id, minggu_mulai);
