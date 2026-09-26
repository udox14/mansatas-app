CREATE TABLE IF NOT EXISTS staff_device_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_agenda_at TEXT,
  last_agenda_id TEXT,
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_device_sessions_user_seen
  ON staff_device_sessions(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_device_sessions_user_device
  ON staff_device_sessions(user_id, device_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_device_sessions_device_seen
  ON staff_device_sessions(device_id, last_seen_at DESC);
