-- migrations/tambah-agenda-piket.sql
-- Tabel untuk menyimpan bukti kehadiran guru piket (foto + waktu submit)

CREATE TABLE IF NOT EXISTS agenda_piket (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  jadwal_id     TEXT NOT NULL REFERENCES jadwal_guru_piket(id) ON DELETE CASCADE,
  shift_id      INTEGER NOT NULL REFERENCES pengaturan_shift_piket(id),
  tanggal       TEXT NOT NULL,          -- Format YYYY-MM-DD
  foto_url      TEXT,                   -- URL foto dari R2 (via /api/media/)
  status        TEXT NOT NULL DEFAULT 'HADIR', -- HADIR | TELAT | ALFA | SAKIT | IZIN
  waktu_submit  TEXT,                   -- ISO datetime WIB saat submit
  catatan_admin TEXT,                   -- Catatan dari admin saat override status
  diubah_oleh   TEXT REFERENCES "user"(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, jadwal_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_agenda_piket_tanggal ON agenda_piket(tanggal);
CREATE INDEX IF NOT EXISTS idx_agenda_piket_user    ON agenda_piket(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_piket_jadwal  ON agenda_piket(jadwal_id);
