-- Sinkronisasi rencana setelah lulus dan pilihan pendidikan TKA.
ALTER TABLE penerimaan_pt ADD COLUMN jenis_data TEXT NOT NULL DEFAULT 'HASIL'
  CHECK (jenis_data IN ('HASIL', 'PILIHAN_TKA'));
ALTER TABLE penerimaan_pt ADD COLUMN pilihan_ke INTEGER
  CHECK (pilihan_ke IS NULL OR pilihan_ke IN (1, 2));

CREATE UNIQUE INDEX IF NOT EXISTS idx_penerimaan_pt_pilihan_tka_unique
  ON penerimaan_pt(siswa_id, tahun_ajaran_id, pilihan_ke)
  WHERE jenis_data = 'PILIHAN_TKA';

CREATE INDEX IF NOT EXISTS idx_penerimaan_pt_jenis_siswa_ta
  ON penerimaan_pt(jenis_data, siswa_id, tahun_ajaran_id);

CREATE TABLE IF NOT EXISTS rencana_pasca_lulus (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  kategori        TEXT NOT NULL CHECK (kategori IN (
    'BEKERJA', 'WIRAUSAHA', 'TNI_POLRI', 'MENIKAH', 'PESANTREN',
    'KURSUS_PELATIHAN', 'BELUM_MENENTUKAN', 'LAINNYA'
  )),
  catatan         TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);

CREATE INDEX IF NOT EXISTS idx_rencana_pasca_lulus_ta_kategori
  ON rencana_pasca_lulus(tahun_ajaran_id, kategori);
