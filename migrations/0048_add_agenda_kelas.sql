ALTER TABLE kelas ADD COLUMN km_siswa_id TEXT REFERENCES siswa(id) ON DELETE SET NULL;

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('super_admin', 'agenda-kelas');
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('admin_tu', 'agenda-kelas');
