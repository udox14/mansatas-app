-- Seed role_features for Penugasan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'penugasan'),
('admin_tu', 'penugasan'),
('kepsek', 'penugasan'),
('wakamad', 'penugasan'),
('guru', 'penugasan'),
('wali_kelas', 'penugasan'),
('guru_bk', 'penugasan'),
('guru_piket', 'penugasan'),
('guru_ppl', 'penugasan');

-- Seed role_features for Monitoring Penugasan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'monitoring-penugasan'),
('admin_tu', 'monitoring-penugasan'),
('kepsek', 'monitoring-penugasan'),
('wakamad', 'monitoring-penugasan');
