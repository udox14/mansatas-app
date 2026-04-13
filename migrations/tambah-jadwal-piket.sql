-- migrations/tambah-jadwal-piket.sql

CREATE TABLE IF NOT EXISTS pengaturan_shift_piket (
  id           INTEGER PRIMARY KEY,
  nama_shift   TEXT NOT NULL,
  jam_mulai    INTEGER NOT NULL,
  jam_selesai  INTEGER NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO pengaturan_shift_piket (id, nama_shift, jam_mulai, jam_selesai) VALUES 
(1, 'Shift 1', 1, 5),
(2, 'Shift 2', 6, 99);

CREATE TABLE IF NOT EXISTS jadwal_guru_piket (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hari         INTEGER NOT NULL CHECK(hari BETWEEN 1 AND 7),
  shift_id     INTEGER NOT NULL REFERENCES pengaturan_shift_piket(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, hari, shift_id)
);
