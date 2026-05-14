CREATE TABLE IF NOT EXISTS role_sidebar_configs (
  role TEXT PRIMARY KEY,
  groups_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
);
