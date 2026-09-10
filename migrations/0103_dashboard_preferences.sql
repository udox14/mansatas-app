-- Apply before releasing the dashboard favorites UI.
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  shortcut_ids TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(shortcut_ids) AND json_type(shortcut_ids) = 'array' AND json_array_length(shortcut_ids) <= 8),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
