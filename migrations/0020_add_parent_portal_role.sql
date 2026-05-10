-- Tambah role + feature portal orang tua
INSERT OR IGNORE INTO master_roles (value, label, is_custom, mobile_nav_links)
VALUES ('orang_tua', 'Orang Tua Siswa', 0, '["portal-ortu"]');

INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES ('orang_tua', 'portal-ortu');

