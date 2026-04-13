-- ============================================================
-- MIGRASI: Delegasi Tugas (Penugasan)
-- Fitur penitipan tugas guru ke user lain
-- ============================================================

CREATE TABLE IF NOT EXISTS delegasi_tugas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dari_user_id    TEXT NOT NULL REFERENCES "user"(id),
  kepada_user_id  TEXT NOT NULL REFERENCES "user"(id),
  tanggal         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'DIKIRIM' CHECK(status IN ('DIKIRIM','SELESAI')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delegasi_tugas_kelas (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  delegasi_id             TEXT NOT NULL REFERENCES delegasi_tugas(id) ON DELETE CASCADE,
  penugasan_mengajar_id   TEXT NOT NULL REFERENCES penugasan_mengajar(id),
  kelas_id                TEXT NOT NULL REFERENCES kelas(id),
  tugas                   TEXT NOT NULL,
  absen_selesai           INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_delegasi_dari_tanggal ON delegasi_tugas(dari_user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_delegasi_kepada_tanggal ON delegasi_tugas(kepada_user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_delegasi_kelas_delegasi ON delegasi_tugas_kelas(delegasi_id);
CREATE INDEX IF NOT EXISTS idx_delegasi_kelas_penugasan ON delegasi_tugas_kelas(penugasan_mengajar_id);
