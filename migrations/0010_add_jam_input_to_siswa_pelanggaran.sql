ALTER TABLE siswa_pelanggaran ADD COLUMN jam_input TEXT;
ALTER TABLE siswa_pelanggaran ADD COLUMN source_signature TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pelanggaran_source_signature
  ON siswa_pelanggaran(source_signature)
  WHERE source_signature IS NOT NULL;
