-- ============================================================
-- Akademik Input Wizard: draft checkpoints + apply backups
-- ============================================================

CREATE TABLE IF NOT EXISTS akademik_input_sessions (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK(status IN ('draft','applied','discarded')),
  active_step       TEXT NOT NULL DEFAULT 'persiapan',
  summary_json      TEXT NOT NULL DEFAULT '{}',
  logs_json         TEXT NOT NULL DEFAULT '[]',
  created_by        TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_akademik_input_sessions_ta_status
  ON akademik_input_sessions(tahun_ajaran_id, status, updated_at);

CREATE TABLE IF NOT EXISTS akademik_input_rows (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id      TEXT NOT NULL REFERENCES akademik_input_sessions(id) ON DELETE CASCADE,
  step_key        TEXT NOT NULL,
  row_key         TEXT NOT NULL,
  payload_json    TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft',
  error_message   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, step_key, row_key)
);

CREATE INDEX IF NOT EXISTS idx_akademik_input_rows_session_step
  ON akademik_input_rows(session_id, step_key);

CREATE TABLE IF NOT EXISTS akademik_input_apply_backups (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id      TEXT NOT NULL REFERENCES akademik_input_sessions(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  snapshot_json   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_akademik_input_backups_session
  ON akademik_input_apply_backups(session_id);
