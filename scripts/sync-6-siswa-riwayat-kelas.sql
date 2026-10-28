-- Sinkronisasi 6 siswa yang belum memiliki riwayat_kelas pada Tahun Ajaran 2026/2027 Ganjil
-- Siswa: Haura Marata, Muhamad Sakti Alamsyah, Anjas Ardiansyah, Ahmad Raihan Mumtaz, Pahmi Muhamad Alwi, Sindi Rofiatun Niswah

INSERT INTO riwayat_kelas (
  id,
  siswa_id,
  kelas_id,
  tahun_ajaran_id,
  kelas_tingkat,
  kelas_nomor,
  kelas_kelompok,
  kelas_nama,
  created_at
)
SELECT 
  lower(hex(randomblob(16))),
  s.id,
  s.kelas_id,
  '44e4dd4af13d99dac8cc0f99687aedd1',
  k.tingkat,
  k.nomor_kelas,
  k.kelompok,
  CASE 
    WHEN k.kelompok IS NOT NULL AND k.kelompok != 'UMUM' THEN (k.tingkat || '-' || k.nomor_kelas || ' ' || k.kelompok)
    ELSE (k.tingkat || '-' || k.nomor_kelas)
  END,
  datetime('now')
FROM siswa s
JOIN kelas k ON s.kelas_id = k.id
WHERE s.id IN (
  'a31b4b4ec2acbcef63e7aae95f558711',
  'f7ef1b4ad7cc229a7778b46a0acdcbd1',
  '522dcfa4d9484415851832be47ba11e1',
  'ddb7a7c7ec08467c90c103d76344a789',
  '158119d22af7514f1e530ff45d4e8cfa',
  'ccbf318afe987b20042d4de41de4862f'
)
ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET
  kelas_id = excluded.kelas_id,
  kelas_tingkat = excluded.kelas_tingkat,
  kelas_nomor = excluded.kelas_nomor,
  kelas_kelompok = excluded.kelas_kelompok,
  kelas_nama = excluded.kelas_nama;
