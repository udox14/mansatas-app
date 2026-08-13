-- Akun khusus Google Play review: tampilan setara Super Admin, selalu read-only.
INSERT OR IGNORE INTO master_roles (value, label, is_custom, mobile_nav_links)
SELECT 'play_reviewer', 'Google Play Reviewer (Read Only)', 0, mobile_nav_links
FROM master_roles
WHERE value = 'super_admin';

INSERT OR IGNORE INTO master_roles (value, label, is_custom, mobile_nav_links)
VALUES ('play_reviewer', 'Google Play Reviewer (Read Only)', 0, '[]');

INSERT OR IGNORE INTO role_features (role, feature_id)
SELECT 'play_reviewer', feature_id
FROM role_features
WHERE role = 'super_admin';

INSERT OR REPLACE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete, updated_at)
SELECT 'play_reviewer', feature_id, 0, 1, 0, 0, CURRENT_TIMESTAMP
FROM role_features
WHERE role = 'play_reviewer';

INSERT OR REPLACE INTO role_sidebar_configs (role, groups_json, updated_at)
SELECT 'play_reviewer', groups_json, CURRENT_TIMESTAMP
FROM role_sidebar_configs
WHERE role = 'super_admin';
