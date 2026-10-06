-- Additive inbox; original attendance and delivered parent messages are untouched.
CREATE TABLE IF NOT EXISTS staff_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  event_key TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  url TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT,
  UNIQUE(user_id, event_key, source_ref)
);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_date ON staff_notifications(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_unread ON staff_notifications(user_id,created_at DESC,id DESC) WHERE read_at IS NULL;

-- Enable in-app alongside each existing homeroom delivery channel.
UPDATE notification_event_settings
SET channels_json = json_insert(channels_json, '$[#]', 'in_app')
WHERE event_key = 'attendance_homeroom_alert'
  AND json_valid(channels_json)
  AND NOT EXISTS (SELECT 1 FROM json_each(channels_json) WHERE value = 'in_app');
