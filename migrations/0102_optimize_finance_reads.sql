-- Indeks komposit untuk pola baca utama modul Komite/Keuangan.
CREATE INDEX IF NOT EXISTS idx_fin_trx_detail_ref
  ON fin_transaksi_detail(ref_type, ref_id, transaksi_id);

CREATE INDEX IF NOT EXISTS idx_fin_trx_void_created
  ON fin_transaksi(is_void, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fin_trx_student_void_created
  ON fin_transaksi(siswa_id, is_void, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fin_cashflow_direction_void_date
  ON fin_cashflow_entries(direction, is_void, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_riwayat_kelas_student_created
  ON riwayat_kelas(siswa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_siswa_status_angkatan
  ON siswa(status, tahun_masuk);

PRAGMA optimize;
