-- Migration: Rename nilai_um → nilai_smt6 untuk MTs (6 semester)
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-smt6.sql

-- SQLite tidak support RENAME COLUMN di semua versi, jadi cukup tambah kolom baru
-- nilai_um tetap ada tapi tidak dipakai (aman)
ALTER TABLE rekap_nilai_akademik ADD COLUMN nilai_smt6 TEXT DEFAULT '{}';
