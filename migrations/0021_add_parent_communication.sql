-- Komunikasi orang tua: notifikasi, pemanggilan, dan catatan tindak lanjut
CREATE TABLE IF NOT EXISTS parent_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source_ref TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, type, source_ref)
);

CREATE TABLE IF NOT EXISTS parent_summons (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  source_ref TEXT,
  reason TEXT NOT NULL,
  event_date TEXT,
  event_time TEXT,
  location TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'terkirim',
  parent_response TEXT,
  parent_response_note TEXT,
  parent_responded_at TEXT,
  created_by TEXT REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, source_ref)
);

CREATE TABLE IF NOT EXISTS parent_thread_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  note_type TEXT NOT NULL DEFAULT 'tindak_lanjut',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_notifications_siswa_created
  ON parent_notifications(siswa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_summons_siswa_created
  ON parent_summons(siswa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_thread_notes_siswa_created
  ON parent_thread_notes(siswa_id, created_at DESC);

