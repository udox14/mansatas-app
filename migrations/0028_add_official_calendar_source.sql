CREATE TABLE IF NOT EXISTS kalender_pendidikan_events_new (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'LAINNYA'
                CHECK(category IN ('TANGGAL_MERAH','LIBUR_SEMESTER','RAPAT','UJIAN','KEGIATAN_MADRASAH','LAINNYA')),
  is_effective  INTEGER NOT NULL DEFAULT 0,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','sync','official')),
  external_id   TEXT,
  description   TEXT,
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(start_date <= end_date),
  UNIQUE(source, external_id)
);

INSERT OR IGNORE INTO kalender_pendidikan_events_new
  (id, start_date, end_date, title, category, is_effective, source, external_id, description, created_by, updated_by, created_at, updated_at)
SELECT id, start_date, end_date, title, category, is_effective, source, external_id, description, created_by, updated_by, created_at, updated_at
FROM kalender_pendidikan_events;

DROP TABLE kalender_pendidikan_events;

ALTER TABLE kalender_pendidikan_events_new RENAME TO kalender_pendidikan_events;

CREATE INDEX IF NOT EXISTS idx_kalender_pendidikan_events_range
ON kalender_pendidikan_events(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_kalender_pendidikan_events_category
ON kalender_pendidikan_events(category, is_effective);
