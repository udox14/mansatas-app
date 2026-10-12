-- Add read access to the live per-class MBG summary.
-- Existing permissions and individual revocations are preserved.
INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES ('pramubakti', 'rekap-absensi');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES ('pramubakti', 'rekap-absensi', 0, 1, 0, 0);
