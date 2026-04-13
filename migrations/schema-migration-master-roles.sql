-- Migration: master_roles table
-- Menyimpan definisi role (termasuk role custom yang dibuat admin)

CREATE TABLE IF NOT EXISTS master_roles (
  value       TEXT PRIMARY KEY,  -- slug role: 'guru', 'admin_tu', dll
  label       TEXT NOT NULL,     -- nama tampil: 'Guru Mata Pelajaran'
  is_custom   INTEGER NOT NULL DEFAULT 0,  -- 1 = role custom buatan admin
  mobile_nav_links TEXT DEFAULT '[]', -- Konfigurasi JSON array 5 fitur mobile navbar
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed dari ALL_ROLES default
INSERT OR IGNORE INTO master_roles (value, label, is_custom) VALUES
('super_admin',  'Super Admin',               0),
('admin_tu',     'Admin Tata Usaha',          0),
('kepsek',       'Kepala Madrasah',           0),
('wakamad',      'Wakil Kepala Madrasah',     0),
('guru',         'Guru Mata Pelajaran',       0),
('guru_bk',      'Guru BK',                  0),
('guru_piket',   'Guru Piket',               0),
('wali_kelas',   'Wali Kelas',               0),
('resepsionis',  'Resepsionis',              0),
('guru_ppl',     'Guru PPL',                 0);
