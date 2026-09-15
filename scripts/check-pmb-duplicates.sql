-- Must return zero rows before migration 0108 is applied.
SELECT 'nisn' AS field, tahun_ajaran, nisn AS value, COUNT(*) AS total
FROM pmb_pendaftar
WHERE COALESCE(TRIM(nisn), '') <> ''
GROUP BY tahun_ajaran, nisn HAVING COUNT(*) > 1
UNION ALL
SELECT 'nik', tahun_ajaran, nik, COUNT(*)
FROM pmb_pendaftar
WHERE COALESCE(TRIM(nik), '') <> ''
GROUP BY tahun_ajaran, nik HAVING COUNT(*) > 1
UNION ALL
SELECT 'no_pendaftaran', tahun_ajaran, no_pendaftaran, COUNT(*)
FROM pmb_pendaftar
WHERE COALESCE(TRIM(no_pendaftaran), '') <> ''
GROUP BY tahun_ajaran, no_pendaftaran HAVING COUNT(*) > 1;
