-- Indeks untuk agregasi status absensi harian lintas kelas dan rentang tanggal.
CREATE INDEX IF NOT EXISTS idx_absensi_daily_assignment_date_student
  ON absensi_siswa(penugasan_id, tanggal, siswa_id);

CREATE INDEX IF NOT EXISTS idx_absensi_session_daily_date_assignment
  ON absensi_sesi_guru(tanggal, penugasan_id);

CREATE INDEX IF NOT EXISTS idx_absensi_wali_daily_date_student
  ON keterangan_absensi_wali_kelas(tanggal, siswa_id);

CREATE INDEX IF NOT EXISTS idx_izin_kelas_daily_date_student
  ON izin_tidak_masuk_kelas(tanggal, siswa_id);

CREATE INDEX IF NOT EXISTS idx_izin_keluar_daily_student_range
  ON izin_keluar_komplek(siswa_id, waktu_keluar, waktu_kembali);
