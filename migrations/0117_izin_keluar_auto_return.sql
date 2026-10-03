-- Small index of open daily permits; no historical data is changed by migration.
CREATE INDEX IF NOT EXISTS idx_izin_keluar_pending_time
  ON izin_keluar_komplek(waktu_keluar, id)
  WHERE status = 'BELUM KEMBALI';
-- Rollback (after removing the cron integration): DROP INDEX idx_izin_keluar_pending_time;
