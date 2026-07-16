-- Guru mata pelajaran dapat membaca Rekap Nilai. Perubahan data tetap hanya
-- untuk pengelola akademik; server juga memvalidasi pembatasan ini.
INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES ('guru', 'akademik-nilai');

INSERT INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES ('guru', 'akademik-nilai', 0, 1, 0, 0)
ON CONFLICT(role, feature_id) DO UPDATE SET
  can_create = 0,
  can_read = 1,
  can_update = 0,
  can_delete = 0,
  updated_at = CURRENT_TIMESTAMP;
