-- Guru PPL dapat memakai RPPM Generator, melihat seluruh jadwal pelajaran,
-- dan tetap hanya membaca data Akademik (tanpa hak ubah).

INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES
  ('guru_ppl', 'rppm-generator'),
  ('guru_ppl', 'akademik'),
  ('guru_ppl', 'penugasan');

INSERT INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete, updated_at)
VALUES
  ('guru_ppl', 'rppm-generator', 1, 1, 1, 1, CURRENT_TIMESTAMP),
  ('guru_ppl', 'akademik', 0, 1, 0, 0, CURRENT_TIMESTAMP),
  ('guru_ppl', 'penugasan', 1, 1, 1, 1, CURRENT_TIMESTAMP)
ON CONFLICT(role, feature_id) DO UPDATE SET
  can_create = excluded.can_create,
  can_read = excluded.can_read,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete,
  updated_at = excluded.updated_at;
