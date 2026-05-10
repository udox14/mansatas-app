-- Migration: 0025_backfill_wali_kelas_role.sql
-- Tujuan: Backfill role 'wali_kelas' ke tabel user_roles
--         untuk semua guru yang sudah ditugaskan sebagai wali kelas
--         di tabel kelas (sebelum fitur auto-sync diimplementasikan).
--
-- Aman dijalankan berulang kali karena menggunakan INSERT OR IGNORE.

INSERT OR IGNORE INTO user_roles (user_id, role)
SELECT DISTINCT wali_kelas_id, 'wali_kelas'
FROM kelas
WHERE wali_kelas_id IS NOT NULL;
