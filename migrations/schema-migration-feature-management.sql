-- ============================================================
-- MIGRATION: Feature Management & Multi-Role System
-- ============================================================

-- 1. Multi-role per user
--    Satu user bisa punya banyak role sekaligus
CREATE TABLE IF NOT EXISTS user_roles (
  user_id   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role      TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

-- 2. Mapping role → fitur (bisa diedit admin via UI)
--    Menggantikan hardcoded roles[] di config/menu.ts
CREATE TABLE IF NOT EXISTS role_features (
  role        TEXT NOT NULL,
  feature_id  TEXT NOT NULL,
  PRIMARY KEY (role, feature_id)
);

-- 3. Override per-user (grant/revoke fitur individual)
--    grant  = user dapat akses meskipun role-nya tidak
--    revoke = user TIDAK dapat akses meskipun role-nya bisa
CREATE TABLE IF NOT EXISTS user_feature_overrides (
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  feature_id  TEXT NOT NULL,
  action      TEXT NOT NULL CHECK(action IN ('grant', 'revoke')),
  PRIMARY KEY (user_id, feature_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_role_features_role ON role_features(role);
CREATE INDEX IF NOT EXISTS idx_role_features_feature ON role_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_overrides_user ON user_feature_overrides(user_id);

-- ============================================================
-- MIGRATE EXISTING DATA
-- ============================================================

-- Pindahkan role existing dari kolom user.role ke tabel user_roles
INSERT OR IGNORE INTO user_roles (user_id, role)
SELECT id, role FROM "user" WHERE role IS NOT NULL AND role != '';

-- ============================================================
-- SEED role_features dari default config/menu.ts
-- ============================================================

-- Dashboard (semua role)
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'dashboard'), ('admin_tu', 'dashboard'), ('kepsek', 'dashboard'),
('wakamad', 'dashboard'), ('guru', 'dashboard'), ('guru_bk', 'dashboard'),
('guru_piket', 'dashboard'), ('wali_kelas', 'dashboard'), ('resepsionis', 'dashboard'),
('guru_ppl', 'dashboard');

-- Data Siswa
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'siswa'), ('admin_tu', 'siswa'), ('kepsek', 'siswa'),
('wakamad', 'siswa'), ('guru', 'siswa'), ('guru_bk', 'siswa'), ('wali_kelas', 'siswa');

-- Manajemen Kelas
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'kelas'), ('admin_tu', 'kelas'), ('kepsek', 'kelas'), ('wakamad', 'kelas');

-- Plotting & Kenaikan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'plotting'), ('admin_tu', 'plotting'), ('kepsek', 'plotting');

-- Pusat Akademik
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'akademik'), ('admin_tu', 'akademik'), ('kepsek', 'akademik'), ('wakamad', 'akademik');

-- Rekap Nilai
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'akademik-nilai'), ('admin_tu', 'akademik-nilai'), ('kepsek', 'akademik-nilai'), ('wakamad', 'akademik-nilai');

-- Program Unggulan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'program-unggulan'), ('admin_tu', 'program-unggulan'), ('kepsek', 'program-unggulan'),
('wakamad', 'program-unggulan'), ('guru', 'program-unggulan'), ('wali_kelas', 'program-unggulan');

-- Kelola Unggulan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'program-unggulan-kelola'), ('admin_tu', 'program-unggulan-kelola'),
('kepsek', 'program-unggulan-kelola'), ('wakamad', 'program-unggulan-kelola');

-- Guru & Pegawai
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'guru'), ('admin_tu', 'guru'), ('kepsek', 'guru');

-- Absensi Siswa
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'kehadiran'), ('admin_tu', 'kehadiran'), ('kepsek', 'kehadiran'),
('wakamad', 'kehadiran'), ('guru', 'kehadiran'), ('guru_piket', 'kehadiran'), ('wali_kelas', 'kehadiran');

-- Rekap Absensi
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'rekap-absensi'), ('admin_tu', 'rekap-absensi'), ('kepsek', 'rekap-absensi'),
('wakamad', 'rekap-absensi'), ('wali_kelas', 'rekap-absensi');

-- Agenda Guru
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'agenda'), ('admin_tu', 'agenda'), ('kepsek', 'agenda'),
('wakamad', 'agenda'), ('guru', 'agenda'), ('wali_kelas', 'agenda'),
('guru_bk', 'agenda'), ('guru_piket', 'agenda'), ('guru_ppl', 'agenda');

-- Monitoring Agenda
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'monitoring-agenda'), ('admin_tu', 'monitoring-agenda'), ('kepsek', 'monitoring-agenda');

-- Perizinan Siswa
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'izin'), ('admin_tu', 'izin'), ('kepsek', 'izin'),
('wakamad', 'izin'), ('guru_bk', 'izin'), ('guru_piket', 'izin'), ('resepsionis', 'izin');

-- Kedisiplinan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'kedisiplinan'), ('admin_tu', 'kedisiplinan'), ('kepsek', 'kedisiplinan'),
('wakamad', 'kedisiplinan'), ('guru_bk', 'kedisiplinan'), ('guru_piket', 'kedisiplinan'),
('resepsionis', 'kedisiplinan'), ('guru_ppl', 'kedisiplinan'), ('wali_kelas', 'kedisiplinan');

-- Bimbingan Konseling
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'bk'), ('kepsek', 'bk'), ('wakamad', 'bk'), ('guru_bk', 'bk');

-- Psikotes & Minat
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'psikotes'), ('kepsek', 'psikotes'), ('wakamad', 'psikotes'),
('guru_bk', 'psikotes'), ('guru', 'psikotes');

-- Presensi Pegawai
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'presensi'), ('admin_tu', 'presensi'), ('resepsionis', 'presensi');

-- Monitoring Presensi
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'monitoring-presensi'), ('admin_tu', 'monitoring-presensi'), ('kepsek', 'monitoring-presensi');

-- Surat Keluar
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'surat'), ('admin_tu', 'surat'), ('wakamad', 'surat'), ('kepsek', 'surat');

-- Pengaturan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'settings'), ('kepsek', 'settings'), ('admin_tu', 'settings');

-- Manajemen Fitur (hanya super_admin)
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'settings-fitur');
