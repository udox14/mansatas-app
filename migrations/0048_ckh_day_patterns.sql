-- Persistent CKH patterns by weekday for days without an active teaching schedule.
CREATE TABLE IF NOT EXISTS ckh_day_patterns (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id            TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  weekday            INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 6),
  kegiatan_bulanan   TEXT NOT NULL DEFAULT '',
  catatan_harian     TEXT NOT NULL DEFAULT '',
  vol                INTEGER NOT NULL DEFAULT 1,
  satuan             TEXT NOT NULL DEFAULT 'Kegiatan',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_ckh_day_patterns_user ON ckh_day_patterns(user_id, weekday);
