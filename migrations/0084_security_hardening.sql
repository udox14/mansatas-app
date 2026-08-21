-- Security hardening: explicit CRUD permissions and application login throttling.
-- Additive and safe to apply before the code rollout.

CREATE TABLE IF NOT EXISTS role_feature_permissions (
  role TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  can_create INTEGER NOT NULL DEFAULT 1 CHECK(can_create IN (0, 1)),
  can_read INTEGER NOT NULL DEFAULT 1 CHECK(can_read IN (0, 1)),
  can_update INTEGER NOT NULL DEFAULT 1 CHECK(can_update IN (0, 1)),
  can_delete INTEGER NOT NULL DEFAULT 1 CHECK(can_delete IN (0, 1)),
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role, feature_id),
  FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
);

-- Older production data can reference this built-in role before master_roles
-- was introduced. Register it before satisfying the permission FK.
INSERT OR IGNORE INTO master_roles (value, label, is_custom)
SELECT 'guru_tahfidz', 'Guru Tahfidz', 0
WHERE EXISTS (SELECT 1 FROM role_features WHERE role = 'guru_tahfidz');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
SELECT role, feature_id, 1, 1, 1, 1
FROM role_features;

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  actor_type TEXT NOT NULL CHECK(actor_type IN ('staff', 'parent')),
  account_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  failed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_attempt_pair
  ON auth_login_attempts(actor_type, account_hash, ip_hash, failed_at);

CREATE INDEX IF NOT EXISTS idx_auth_attempt_account
  ON auth_login_attempts(actor_type, account_hash, failed_at);

CREATE TABLE IF NOT EXISTS auth_ip_blocks (
  ip_hash TEXT PRIMARY KEY,
  blocked_until TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
