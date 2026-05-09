-- Migration: Penanda sesi absensi guru
-- Tujuan: membedakan "belum diisi" vs "sudah disimpan (termasuk semua hadir)"

CREATE TABLE IF NOT EXISTS absensi_sesi_guru (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tanggal      TEXT NOT NULL, -- YYYY-MM-DD
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  diinput_oleh TEXT NOT NULL REFERENCES "user"(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_absensi_sesi_guru_penugasan_tgl
  ON absensi_sesi_guru(penugasan_id, tanggal);
