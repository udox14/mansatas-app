// Only existing notification state is marked; permission writes remain atomic.
export const ATTENDANCE_PERMISSION_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS attendance_recheck_izin_tidak_masuk_kelas_insert AFTER INSERT ON izin_tidak_masuk_kelas
BEGIN
  UPDATE attendance_parent_notice_state SET needs_recheck = needs_recheck + 1, next_check_at = NULL
  WHERE initial_sent_at IS NOT NULL AND tanggal <= date('now','+7 hours') AND ((siswa_id = NEW.siswa_id AND tanggal = NEW.tanggal));
END`,
  `CREATE TRIGGER IF NOT EXISTS attendance_recheck_izin_tidak_masuk_kelas_update AFTER UPDATE ON izin_tidak_masuk_kelas
BEGIN
  UPDATE attendance_parent_notice_state SET needs_recheck = needs_recheck + 1, next_check_at = NULL
  WHERE initial_sent_at IS NOT NULL AND tanggal <= date('now','+7 hours') AND ((siswa_id = OLD.siswa_id AND tanggal = OLD.tanggal) OR (siswa_id = NEW.siswa_id AND tanggal = NEW.tanggal));
END`,
  `CREATE TRIGGER IF NOT EXISTS attendance_recheck_izin_tidak_masuk_kelas_delete AFTER DELETE ON izin_tidak_masuk_kelas
BEGIN
  UPDATE attendance_parent_notice_state SET needs_recheck = needs_recheck + 1, next_check_at = NULL
  WHERE initial_sent_at IS NOT NULL AND tanggal <= date('now','+7 hours') AND ((siswa_id = OLD.siswa_id AND tanggal = OLD.tanggal));
END`,
  `CREATE TRIGGER IF NOT EXISTS attendance_recheck_izin_keluar_komplek_insert AFTER INSERT ON izin_keluar_komplek
BEGIN
  UPDATE attendance_parent_notice_state SET needs_recheck = needs_recheck + 1, next_check_at = NULL
  WHERE initial_sent_at IS NOT NULL AND tanggal <= date('now','+7 hours') AND ((siswa_id = NEW.siswa_id AND tanggal >= substr(NEW.waktu_keluar,1,10) AND (NEW.waktu_kembali IS NULL OR tanggal <= substr(NEW.waktu_kembali,1,10))));
END`,
  `CREATE TRIGGER IF NOT EXISTS attendance_recheck_izin_keluar_komplek_update AFTER UPDATE ON izin_keluar_komplek
BEGIN
  UPDATE attendance_parent_notice_state SET needs_recheck = needs_recheck + 1, next_check_at = NULL
  WHERE initial_sent_at IS NOT NULL AND tanggal <= date('now','+7 hours') AND ((siswa_id = OLD.siswa_id AND tanggal >= substr(OLD.waktu_keluar,1,10) AND (OLD.waktu_kembali IS NULL OR tanggal <= substr(OLD.waktu_kembali,1,10))) OR (siswa_id = NEW.siswa_id AND tanggal >= substr(NEW.waktu_keluar,1,10) AND (NEW.waktu_kembali IS NULL OR tanggal <= substr(NEW.waktu_kembali,1,10))));
END`,
  `CREATE TRIGGER IF NOT EXISTS attendance_recheck_izin_keluar_komplek_delete AFTER DELETE ON izin_keluar_komplek
BEGIN
  UPDATE attendance_parent_notice_state SET needs_recheck = needs_recheck + 1, next_check_at = NULL
  WHERE initial_sent_at IS NOT NULL AND tanggal <= date('now','+7 hours') AND ((siswa_id = OLD.siswa_id AND tanggal >= substr(OLD.waktu_keluar,1,10) AND (OLD.waktu_kembali IS NULL OR tanggal <= substr(OLD.waktu_kembali,1,10))));
END`
]
