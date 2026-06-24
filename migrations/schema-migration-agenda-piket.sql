-- Migration: Add Agenda Support for Guru Piket
-- Date: $(date +%Y-%m-%d)

-- 1. Create penugasan_piket table
-- Links jadwal_guru_piket to specific date/shift instance
CREATE TABLE IF NOT EXISTS penugasan_piket (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jadwal_guru_piket_id TEXT NOT NULL REFERENCES jadwal_guru_piket(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  shift_id INTEGER NOT NULL REFERENCES pengaturan_shift_piket(id),
  shift_nama TEXT NOT NULL,
  jam_mulai INTEGER NOT NULL,
  jam_selesai INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  UNIQUE(jadwal_guru_piket_id, tanggal, shift_id)
);

-- 2. Extend agenda_guru to support piket
-- Existing: penugasan_id → penugasan_mengajar (teaching)
-- New:     penugasan_piket_id → penugasan_piket (piket)
ALTER TABLE agenda_guru 
ADD COLUMN penugasan_piket_id TEXT REFERENCES penugasan_piket(id) ON DELETE SET NULL;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agenda_guru_piket_id ON agenda_guru(penugasan_piket_id);
CREATE INDEX IF NOT EXISTS idx_penugasan_piket_jadwal ON penugasan_piket(jadwal_guru_piket_id);
CREATE INDEX IF NOT EXISTS idx_penugasan_piket_tanggal ON penugasan_piket(tanggal);

-- 4. Trigger: Auto-create penugasan_piket daily for active jadwal_guru_piket
-- (Optional, can be done via cron job instead)
-- For now, create manually or via UI/cron when needed
