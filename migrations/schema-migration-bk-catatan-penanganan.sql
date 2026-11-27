-- ============================================================
-- MIGRATION: Tambah kolom Catatan Penanganan Siswa pada bk_rekaman
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=migrations/schema-migration-bk-catatan-penanganan.sql
-- ============================================================

ALTER TABLE bk_rekaman ADD COLUMN tanggal TEXT DEFAULT '';
ALTER TABLE bk_rekaman ADD COLUMN tempat TEXT DEFAULT '';
ALTER TABLE bk_rekaman ADD COLUMN waktu TEXT DEFAULT '';
ALTER TABLE bk_rekaman ADD COLUMN teknik_konseling TEXT DEFAULT '';
ALTER TABLE bk_rekaman ADD COLUMN media TEXT DEFAULT '';
ALTER TABLE bk_rekaman ADD COLUMN akar_masalah TEXT DEFAULT '';
ALTER TABLE bk_rekaman ADD COLUMN hasil_konsultasi TEXT DEFAULT '';
