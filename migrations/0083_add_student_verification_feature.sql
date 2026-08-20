-- Insight & Verifikasi Siswa: read-only untuk pimpinan dan super admin.
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'verifikasi-siswa'),
  ('kepsek', 'verifikasi-siswa'),
  ('wakamad', 'verifikasi-siswa');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('super_admin', 'verifikasi-siswa', 0, 1, 0, 0),
  ('kepsek', 'verifikasi-siswa', 0, 1, 0, 0),
  ('wakamad', 'verifikasi-siswa', 0, 1, 0, 0);
