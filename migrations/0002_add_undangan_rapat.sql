-- ============================================================
-- Migration: Fitur Undangan Rapat
-- ============================================================

CREATE TABLE IF NOT EXISTS undangan_rapat (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agenda          TEXT NOT NULL,
  tanggal         TEXT NOT NULL,
  waktu           TEXT NOT NULL,
  tempat          TEXT NOT NULL,
  catatan         TEXT,
  pengundang_id   TEXT NOT NULL REFERENCES "user"(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS peserta_rapat (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  rapat_id        TEXT NOT NULL REFERENCES undangan_rapat(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES "user"(id),
  status_kehadiran TEXT NOT NULL DEFAULT 'BELUM_RESPOND' CHECK(status_kehadiran IN ('BELUM_RESPOND', 'HADIR', 'TIDAK_HADIR')),
  alasan_tidak_hadir TEXT,
  waktu_respon    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rapat_pengundang ON undangan_rapat(pengundang_id);
CREATE INDEX IF NOT EXISTS idx_peserta_rapat_id ON peserta_rapat(rapat_id);
CREATE INDEX IF NOT EXISTS idx_peserta_user_id ON peserta_rapat(user_id);
