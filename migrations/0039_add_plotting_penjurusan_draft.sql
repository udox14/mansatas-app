CREATE TABLE IF NOT EXISTS plotting_penjurusan_draft (
  id                       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id                 TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  source_tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  target_tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  minat_jurusan            TEXT,
  status                   TEXT NOT NULL DEFAULT 'draft'
                           CHECK(status IN ('draft','applied')),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, source_tahun_ajaran_id, target_tahun_ajaran_id)
);

CREATE INDEX IF NOT EXISTS idx_plotting_penjurusan_draft_context
  ON plotting_penjurusan_draft(source_tahun_ajaran_id, target_tahun_ajaran_id);

CREATE INDEX IF NOT EXISTS idx_plotting_penjurusan_draft_siswa
  ON plotting_penjurusan_draft(siswa_id);
