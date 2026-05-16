CREATE TABLE IF NOT EXISTS role_feature_permissions (
  role TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  can_create INTEGER NOT NULL DEFAULT 1,
  can_read INTEGER NOT NULL DEFAULT 1,
  can_update INTEGER NOT NULL DEFAULT 1,
  can_delete INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role, feature_id),
  FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
);

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
SELECT role, feature_id, 1, 1, 1, 1
FROM role_features;
