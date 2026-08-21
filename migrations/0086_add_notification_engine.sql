-- Central notification configuration and idempotent delivery ledger.
-- Event rows are seeded by lib/notification-engine.ts so new catalog entries
-- can be introduced without having to duplicate long template payloads here.

CREATE TABLE IF NOT EXISTS notification_event_settings (
  event_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  url_template TEXT NOT NULL DEFAULT '/dashboard',
  channels_json TEXT NOT NULL DEFAULT '["fcm"]',
  target_json TEXT NOT NULL DEFAULT '{}',
  reminder_json TEXT NOT NULL DEFAULT '{}',
  level TEXT NOT NULL DEFAULT 'info',
  updated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_dispatches (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dedup_key TEXT NOT NULL UNIQUE,
  event_key TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  target_scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  queued_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_status
  ON notification_dispatches(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_event
  ON notification_dispatches(event_key, source_ref);
