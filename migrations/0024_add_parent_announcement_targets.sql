-- Target fleksibel pengumuman ortu (multi kelas / angkatan)
CREATE TABLE IF NOT EXISTS parent_announcement_targets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  announcement_id TEXT NOT NULL REFERENCES parent_announcements(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, -- kelas | angkatan
  kelas_id TEXT REFERENCES kelas(id) ON DELETE CASCADE,
  tingkat INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_announcement_targets_announcement
  ON parent_announcement_targets(announcement_id);
CREATE INDEX IF NOT EXISTS idx_parent_announcement_targets_kelas
  ON parent_announcement_targets(kelas_id);
CREATE INDEX IF NOT EXISTS idx_parent_announcement_targets_tingkat
  ON parent_announcement_targets(tingkat);
