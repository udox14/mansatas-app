-- Broadcast penugasan ke semua guru piket hari itu, lalu catat guru yang melaksanakan per kelas.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS delegasi_tugas_new (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dari_user_id    TEXT NOT NULL REFERENCES "user"(id),
  kepada_user_id  TEXT REFERENCES "user"(id),
  tanggal         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'DIKIRIM' CHECK(status IN ('DIKIRIM','SELESAI')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO delegasi_tugas_new (id, dari_user_id, kepada_user_id, tanggal, status, created_at, updated_at)
SELECT id, dari_user_id, kepada_user_id, tanggal, status, created_at, updated_at
FROM delegasi_tugas;

DROP TABLE delegasi_tugas;
ALTER TABLE delegasi_tugas_new RENAME TO delegasi_tugas;

ALTER TABLE delegasi_tugas_kelas ADD COLUMN pelaksana_user_id TEXT REFERENCES "user"(id);
ALTER TABLE delegasi_tugas_kelas ADD COLUMN selesai_at TEXT;

CREATE INDEX IF NOT EXISTS idx_delegasi_dari_tanggal ON delegasi_tugas(dari_user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_delegasi_kepada_tanggal ON delegasi_tugas(kepada_user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_delegasi_kelas_delegasi ON delegasi_tugas_kelas(delegasi_id);
CREATE INDEX IF NOT EXISTS idx_delegasi_kelas_penugasan ON delegasi_tugas_kelas(penugasan_mengajar_id);
CREATE INDEX IF NOT EXISTS idx_delegasi_kelas_pelaksana ON delegasi_tugas_kelas(pelaksana_user_id);

PRAGMA foreign_keys = ON;
