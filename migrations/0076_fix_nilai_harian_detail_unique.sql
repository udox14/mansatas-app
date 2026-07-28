-- Samakan nilai_harian_detail lama dengan skema modul Nilai Harian saat ini.
-- Beberapa instalasi berasal dari migration_mts_to_man.sql yang belum memiliki
-- UNIQUE(header_id, siswa_id), sehingga ON CONFLICT pada penyimpanan nilai gagal.

-- Pertahankan satu baris terbaru untuk setiap siswa dalam satu sesi.
DELETE FROM nilai_harian_detail
WHERE rowid NOT IN (
  SELECT MAX(rowid)
  FROM nilai_harian_detail
  GROUP BY header_id, siswa_id
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nilai_harian_detail_header_siswa
  ON nilai_harian_detail(header_id, siswa_id);
