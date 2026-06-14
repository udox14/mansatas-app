-- Migration: role_features untuk Ekstrakurikuler
-- 'ekstrakurikuler'        -> halaman pembina (kelola anggota/pertemuan/absensi/nilai)
-- 'ekstrakurikuler-master' -> halaman admin (CRUD master + assign pembina + monitoring)

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin',  'ekstrakurikuler'),
('admin_tu',     'ekstrakurikuler'),
('kepsek',       'ekstrakurikuler'),
('wakamad',      'ekstrakurikuler'),
('guru',         'ekstrakurikuler'),
('wali_kelas',   'ekstrakurikuler'),
('guru_bk',      'ekstrakurikuler'),
('guru_ppl',     'ekstrakurikuler'),
('guru_tahfidz', 'ekstrakurikuler');

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'ekstrakurikuler-master'),
('admin_tu',    'ekstrakurikuler-master'),
('kepsek',      'ekstrakurikuler-master'),
('wakamad',     'ekstrakurikuler-master');
