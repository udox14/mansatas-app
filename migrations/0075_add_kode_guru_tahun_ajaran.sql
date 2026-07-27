CREATE TABLE IF NOT EXISTS kode_guru_tahun_ajaran (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  guru_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kode              TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tahun_ajaran_id, guru_id)
);

CREATE INDEX IF NOT EXISTS idx_kode_guru_ta_kode
  ON kode_guru_tahun_ajaran(tahun_ajaran_id, kode);
