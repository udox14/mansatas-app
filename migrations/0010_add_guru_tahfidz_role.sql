-- Migration: Add guru_tahfidz to master_roles
-- Menambahkan role Guru Tahfidz agar muncul di daftar role sistem

INSERT OR IGNORE INTO master_roles (value, label, is_custom) VALUES
('guru_tahfidz', 'Guru Tahfidz', 0);
