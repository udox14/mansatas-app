-- ============================================================
-- MIGRATION: Tambah kolom info keluar ke tabel siswa
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-siswa-keluar.sql
-- ============================================================

ALTER TABLE siswa ADD COLUMN tanggal_keluar TEXT;
ALTER TABLE siswa ADD COLUMN alasan_keluar  TEXT;
ALTER TABLE siswa ADD COLUMN keterangan_keluar TEXT;

-- Index untuk query daftar siswa keluar
CREATE INDEX IF NOT EXISTS idx_siswa_keluar ON siswa(status, tanggal_keluar)
  WHERE status = 'keluar';
