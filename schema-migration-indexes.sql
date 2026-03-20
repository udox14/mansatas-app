-- Migration: Tambah index yang kurang untuk query penugasan_mengajar
-- Query ini muncul di Cloudflare Analytics dengan 9k+ rows read
--
-- Jalankan via:
-- wrangler d1 execute mansatas-db --remote --file=schema-migration-indexes.sql

-- Index untuk filter tahun_ajaran_id di penugasan (query paling sering)
CREATE INDEX IF NOT EXISTS idx_penugasan_ta_id
  ON penugasan_mengajar(tahun_ajaran_id);

-- Index composite untuk lookup penugasan by guru + TA
CREATE INDEX IF NOT EXISTS idx_penugasan_guru_ta
  ON penugasan_mengajar(guru_id, tahun_ajaran_id);

-- Index untuk kelas tingkat + status siswa (query analitik kelas 12)
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_status
  ON siswa(kelas_id, status);

-- Index untuk rekap_nilai by siswa (LEFT JOIN di analitik)
CREATE INDEX IF NOT EXISTS idx_rekap_nilai_siswa
  ON rekap_nilai_akademik(siswa_id);
