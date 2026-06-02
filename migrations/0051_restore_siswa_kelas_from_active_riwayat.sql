-- Emergency recovery:
-- Restore kelas siswa aktif yang tidak sengaja kosong dari riwayat_kelas tahun ajaran aktif.
-- Aman dijalankan ulang: hanya mengisi siswa aktif dengan kelas_id NULL.

UPDATE siswa
SET
  kelas_id = (
    SELECT rk.kelas_id
    FROM riwayat_kelas rk
    JOIN tahun_ajaran ta ON ta.id = rk.tahun_ajaran_id
    WHERE rk.siswa_id = siswa.id
      AND ta.is_active = 1
    LIMIT 1
  ),
  updated_at = datetime('now')
WHERE status = 'aktif'
  AND kelas_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM riwayat_kelas rk
    JOIN tahun_ajaran ta ON ta.id = rk.tahun_ajaran_id
    WHERE rk.siswa_id = siswa.id
      AND ta.is_active = 1
  );
