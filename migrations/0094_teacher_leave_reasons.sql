CREATE TABLE alasan_izin_guru (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL COLLATE NOCASE UNIQUE,
  kepentingan_sekolah INTEGER NOT NULL DEFAULT 0 CHECK (kepentingan_sekolah IN (0, 1)),
  aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  created_by TEXT REFERENCES "user"(id),
  updated_by TEXT REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO alasan_izin_guru (id, nama) VALUES ('izin-guru-lainnya', 'Izin lainnya');
ALTER TABLE agenda_guru ADD COLUMN alasan_izin_guru_id TEXT REFERENCES alasan_izin_guru(id);
ALTER TABLE delegasi_tugas ADD COLUMN alasan_izin_guru_id TEXT REFERENCES alasan_izin_guru(id);
CREATE INDEX idx_agenda_alasan_izin_guru ON agenda_guru(alasan_izin_guru_id);
CREATE INDEX idx_delegasi_alasan_izin_guru ON delegasi_tugas(alasan_izin_guru_id);
CREATE TABLE izin_guru_audit (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
