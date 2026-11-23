-- Additive migration: Parent Portal login & activity tracking
-- Safe, non-destructive, idempotent.

CREATE TABLE IF NOT EXISTS parent_session (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  nisn TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parent_credentials (
  siswa_id TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parent_login_stats (
  siswa_id        TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
  first_login_at  TEXT NOT NULL,
  last_login_at   TEXT NOT NULL,
  last_seen_at    TEXT,
  login_count     INTEGER NOT NULL DEFAULT 1,
  data_source     TEXT NOT NULL DEFAULT 'tracked'
                  CHECK(data_source IN ('tracked', 'backfill_session', 'backfill_credential')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_login_stats_last_login
  ON parent_login_stats(last_login_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_login_stats_last_seen
  ON parent_login_stats(last_seen_at DESC);

-- Historical backfill 1: active sessions
INSERT OR IGNORE INTO parent_login_stats (
  siswa_id, first_login_at, last_login_at, last_seen_at, login_count, data_source, updated_at
)
SELECT
  ps.siswa_id,
  MIN(ps.createdAt),
  MAX(ps.createdAt),
  MAX(ps.updatedAt),
  COUNT(*),
  'backfill_session',
  datetime('now')
FROM parent_session ps
JOIN siswa s ON s.id = ps.siswa_id
GROUP BY ps.siswa_id;

-- Historical backfill 2: previously created parent credentials (e.g. logged out)
INSERT OR IGNORE INTO parent_login_stats (
  siswa_id, first_login_at, last_login_at, last_seen_at, login_count, data_source, updated_at
)
SELECT
  pc.siswa_id,
  pc.updated_at,
  pc.updated_at,
  NULL,
  1,
  'backfill_credential',
  datetime('now')
FROM parent_credentials pc
JOIN siswa s ON s.id = pc.siswa_id;

-- RBAC seeds (read-only monitoring)
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'monitoring-login-ortu'),
  ('admin_tu', 'monitoring-login-ortu'),
  ('kepsek', 'monitoring-login-ortu'),
  ('wakamad', 'monitoring-login-ortu'),
  ('wali_kelas', 'monitoring-login-ortu'),
  ('guru_bk', 'monitoring-login-ortu');

INSERT OR IGNORE INTO role_feature_permissions (role, feature_id, can_create, can_read, can_update, can_delete) VALUES
  ('super_admin', 'monitoring-login-ortu', 0, 1, 0, 0),
  ('admin_tu', 'monitoring-login-ortu', 0, 1, 0, 0),
  ('kepsek', 'monitoring-login-ortu', 0, 1, 0, 0),
  ('wakamad', 'monitoring-login-ortu', 0, 1, 0, 0),
  ('wali_kelas', 'monitoring-login-ortu', 0, 1, 0, 0),
  ('guru_bk', 'monitoring-login-ortu', 0, 1, 0, 0);
