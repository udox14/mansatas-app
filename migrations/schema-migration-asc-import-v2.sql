-- ============================================================
-- MIGRATION: ASC Import V2 — kode_asc + pelajaran bergilir
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=migrations/schema-migration-asc-import-v2.sql
-- ============================================================

-- 1. Tambah kolom kode_asc di mata_pelajaran
ALTER TABLE mata_pelajaran ADD COLUMN kode_asc TEXT;

-- 2. Tambah kolom is_piket_bergilir di penugasan_mengajar
--    Penugasan yang ditandai ini = pelajaran khusus (RISET, KSM, dll)
--    yang bisa bentrok dengan jam utama & diampu bergiliran
ALTER TABLE penugasan_mengajar ADD COLUMN is_piket_bergilir INTEGER NOT NULL DEFAULT 0;

-- 3. Tabel daftar guru bergilir untuk satu penugasan
--    Admin mengatur urutan giliran (urutan) dan minggu aktif manual
CREATE TABLE IF NOT EXISTS penugasan_guru_piket (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  urutan          INTEGER NOT NULL DEFAULT 1,
  is_aktif_minggu_ini INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, guru_id)
);

CREATE INDEX IF NOT EXISTS idx_piket_penugasan ON penugasan_guru_piket(penugasan_id);
CREATE INDEX IF NOT EXISTS idx_piket_guru ON penugasan_guru_piket(guru_id);
