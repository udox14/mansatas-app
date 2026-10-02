-- Apply alongside the release. INSERT OR IGNORE preserves the original activation
-- instant on repeat deployment. No attendance source records are rewritten.
CREATE TABLE IF NOT EXISTS attendance_notice_policy (
  id INTEGER PRIMARY KEY CHECK(id = 1), activated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO attendance_notice_policy (id, activated_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE IF NOT EXISTS attendance_parent_notice_state (
  siswa_id TEXT NOT NULL REFERENCES siswa(id), tanggal TEXT NOT NULL,
  initial_revision INTEGER NOT NULL DEFAULT 0,
  initial_ref TEXT, initial_candidate TEXT, initial_due_at TEXT, initial_sent_at TEXT,
  final_revision INTEGER NOT NULL DEFAULT 0,
  final_status TEXT, final_ref TEXT, final_due_at TEXT,
  final_sent_status TEXT, final_sent_revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (siswa_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_attendance_notice_date
ON attendance_parent_notice_state(tanggal, initial_sent_at);
