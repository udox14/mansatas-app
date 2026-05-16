CREATE TABLE IF NOT EXISTS kbm_exceptions (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal         TEXT NOT NULL,
  judul           TEXT NOT NULL,
  kategori        TEXT NOT NULL DEFAULT 'KEGIATAN_MADRASAH'
                  CHECK(kategori IN ('TANGGAL_MERAH','LIBUR_SEMESTER','RAPAT','UJIAN','KEGIATAN_MADRASAH','LAINNYA')),
  jam_ke_mulai    INTEGER NOT NULL,
  jam_ke_selesai  INTEGER NOT NULL,
  target_type     TEXT NOT NULL CHECK(target_type IN ('ALL','TINGKAT','KELAS')),
  target_value    TEXT,
  description     TEXT,
  created_by      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(tanggal GLOB '????-??-??'),
  CHECK(jam_ke_mulai > 0),
  CHECK(jam_ke_selesai >= jam_ke_mulai),
  CHECK(
    (target_type = 'ALL' AND target_value IS NULL)
    OR (target_type IN ('TINGKAT','KELAS') AND target_value IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_kbm_exceptions_tanggal
ON kbm_exceptions(tanggal);

CREATE INDEX IF NOT EXISTS idx_kbm_exceptions_target
ON kbm_exceptions(target_type, target_value);
