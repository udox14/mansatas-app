-- Bendahara dapat menjadi pengaju dan Ketua Komite dapat mendelegasikan tahap review kepada Anggota Komite.
ALTER TABLE komite_pengajuan ADD COLUMN ketua_delegate_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE komite_pengajuan ADD COLUMN ketua_delegated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE komite_pengajuan ADD COLUMN ketua_delegated_at TEXT;

UPDATE role_feature_permissions
SET can_create = 1
WHERE role = 'bendahara_komite' AND feature_id = 'komite-pengajuan';

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('bendahara_komite', 'komite-pengajuan', 1, 1, 1, 0);
