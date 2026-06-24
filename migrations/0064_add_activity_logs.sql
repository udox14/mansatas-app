CREATE TABLE IF NOT EXISTS activity_logs (
  id                 TEXT PRIMARY KEY,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  actor_user_id      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  actor_name         TEXT,
  actor_email        TEXT,
  actor_roles        TEXT NOT NULL DEFAULT '[]',
  session_id         TEXT,
  module             TEXT NOT NULL,
  action             TEXT NOT NULL,
  severity           TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'danger')),
  summary            TEXT NOT NULL,
  entity_type        TEXT,
  entity_id          TEXT,
  entity_label       TEXT,
  before_json        TEXT,
  after_json         TEXT,
  diff_json          TEXT,
  metadata_json      TEXT,
  ip_address         TEXT,
  user_agent         TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS activity_log_targets (
  id            TEXT PRIMARY KEY,
  log_id        TEXT NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL,
  target_id     TEXT,
  target_label  TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_log_targets_log ON activity_log_targets(log_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_targets_target ON activity_log_targets(target_type, target_id);

CREATE TABLE IF NOT EXISTS activity_log_purge_runs (
  id                  TEXT PRIMARY KEY,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  purged_by           TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  purged_by_name      TEXT,
  start_date          TEXT NOT NULL,
  end_date            TEXT NOT NULL,
  deleted_logs_count  INTEGER NOT NULL DEFAULT 0,
  deleted_targets_count INTEGER NOT NULL DEFAULT 0,
  reason              TEXT NOT NULL,
  ip_address          TEXT,
  user_agent          TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_log_purge_runs_created_at
  ON activity_log_purge_runs(created_at);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES ('super_admin', 'log-aktivitas');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('super_admin', 'log-aktivitas', 1, 1, 1, 1);
