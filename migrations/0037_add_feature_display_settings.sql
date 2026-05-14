CREATE TABLE IF NOT EXISTS feature_display_settings (
  feature_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
