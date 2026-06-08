INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'settings-mobile-app');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('super_admin', 'settings-mobile-app', 1, 1, 1, 1);
