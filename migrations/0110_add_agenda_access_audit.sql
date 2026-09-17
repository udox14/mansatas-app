ALTER TABLE activity_logs ADD COLUMN device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_activity_logs_device ON activity_logs(device_id, created_at);

CREATE TABLE IF NOT EXISTS agenda_access_alerts (
  id TEXT PRIMARY KEY,
  alert_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'live' CHECK(source IN ('live','historical')),
  detected_at TEXT NOT NULL,
  last_event_at TEXT NOT NULL,
  device_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  user_a_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  user_b_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low','medium','high')),
  reasons_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  agenda_id TEXT,
  agenda_owner_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  agenda_actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agenda_access_alerts_time ON agenda_access_alerts(last_event_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_access_alerts_users ON agenda_access_alerts(user_a_id, user_b_id, last_event_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_access_alerts_device ON agenda_access_alerts(device_id, last_event_at DESC);

CREATE TABLE IF NOT EXISTS agenda_access_blocks (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  blocked_at TEXT NOT NULL,
  blocked_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  blocked_by_name TEXT,
  lifted_at TEXT,
  lifted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  lifted_by_name TEXT,
  lift_reason TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agenda_access_blocks_active ON agenda_access_blocks(is_active, blocked_at DESC);

CREATE TABLE IF NOT EXISTS agenda_access_scan_runs (
  id TEXT PRIMARY KEY,
  scan_key TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  alerts_created INTEGER NOT NULL DEFAULT 0,
  run_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT
);

INSERT OR IGNORE INTO role_features(role, feature_id) VALUES
  ('super_admin', 'audit-akses-agenda'),
  ('kepsek', 'audit-akses-agenda'),
  ('wakamad', 'audit-akses-agenda');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('super_admin', 'audit-akses-agenda', 1, 1, 1, 0),
  ('kepsek', 'audit-akses-agenda', 0, 1, 0, 0),
  ('wakamad', 'audit-akses-agenda', 0, 1, 0, 0);
