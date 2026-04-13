-- ============================================================
-- MIGRATION: Jadwal Mengajar
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-jadwal.sql
-- ============================================================

-- 1. Tambah kolom jam_pelajaran ke tahun_ajaran
--    Format JSON: [{"id":1,"nama":"Jam 1","mulai":"08:00","selesai":"08:40"}, ...]
ALTER TABLE tahun_ajaran ADD COLUMN jam_pelajaran TEXT NOT NULL DEFAULT '[]';

-- 2. Tabel jadwal mengajar — FK ke penugasan_mengajar (CASCADE delete)
CREATE TABLE IF NOT EXISTS jadwal_mengajar (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  hari            INTEGER NOT NULL CHECK(hari BETWEEN 1 AND 6), -- 1=Senin..6=Sabtu
  jam_ke          INTEGER NOT NULL,                             -- nomor jam pelajaran
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, hari, jam_ke)
);

-- 3. Indexes untuk query per kelas/guru
CREATE INDEX IF NOT EXISTS idx_jadwal_ta_hari     ON jadwal_mengajar(tahun_ajaran_id, hari);
CREATE INDEX IF NOT EXISTS idx_jadwal_penugasan   ON jadwal_mengajar(penugasan_id);
