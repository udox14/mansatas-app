CREATE TABLE IF NOT EXISTS kalender_pendidikan_events (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'LAINNYA'
                CHECK(category IN ('TANGGAL_MERAH','LIBUR_SEMESTER','RAPAT','UJIAN','KEGIATAN_MADRASAH','LAINNYA')),
  is_effective  INTEGER NOT NULL DEFAULT 0,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','sync')),
  external_id   TEXT,
  description   TEXT,
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(start_date <= end_date),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_kalender_pendidikan_events_range
ON kalender_pendidikan_events(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_kalender_pendidikan_events_category
ON kalender_pendidikan_events(category, is_effective);

CREATE TABLE IF NOT EXISTS kalender_pendidikan_sync_logs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tahun         INTEGER NOT NULL,
  source        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK(status IN ('SUCCESS','FAILED')),
  jumlah_data   INTEGER NOT NULL DEFAULT 0,
  message       TEXT,
  synced_by     TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  synced_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kalender_pendidikan_sync_logs_tahun
ON kalender_pendidikan_sync_logs(tahun, synced_at);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'kalender-pendidikan'),
('admin_tu', 'kalender-pendidikan'),
('kepsek', 'kalender-pendidikan'),
('wakamad', 'kalender-pendidikan');
