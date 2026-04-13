-- ============================================================
-- MIGRATION: Tambah kolom asrama & kamar ke tabel siswa
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-asrama.sql
-- ============================================================

ALTER TABLE siswa ADD COLUMN asrama TEXT;
ALTER TABLE siswa ADD COLUMN kamar  TEXT;
