-- Migration: 0026_fix_backfill_primary_roles.sql
-- Konteks: Migration 0025 menambahkan 'wali_kelas' ke user_roles untuk guru yang
--          sudah ditugaskan sebagai wali kelas. Namun sebagian guru tersebut
--          belum memiliki primary role mereka (misal: 'guru') di tabel user_roles
--          (hanya ada di kolom user.role), sehingga UI menampilkan mereka seolah
--          hanya memiliki role 'wali_kelas'.
--
-- Fix: Pastikan SEMUA user (kecuali ortu & siswa) memiliki primary role-nya
--      (dari user.role) di tabel user_roles.
--      Aman dijalankan berulang kali karena menggunakan INSERT OR IGNORE.

INSERT OR IGNORE INTO user_roles (user_id, role)
SELECT id, role
FROM user
WHERE role NOT IN ('ortu', 'siswa')
  AND role IS NOT NULL;
