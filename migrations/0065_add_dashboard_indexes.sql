-- Index untuk query agregat dashboard super admin (tren pelanggaran harian).
-- siswa_pelanggaran(tanggal) belum ada index -> range scan tanggal jadi full scan.
CREATE INDEX IF NOT EXISTS idx_pelanggaran_tanggal ON siswa_pelanggaran(tanggal);
