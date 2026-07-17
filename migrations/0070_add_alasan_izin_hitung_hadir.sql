-- Kategori izin kepentingan sekolah dapat dihitung hadir jika mencakup seluruh KBM efektif.
ALTER TABLE alasan_izin_kelas
ADD COLUMN hitung_sebagai_hadir INTEGER NOT NULL DEFAULT 0 CHECK (hitung_sebagai_hadir IN (0, 1));

UPDATE alasan_izin_kelas
SET hitung_sebagai_hadir = 1
WHERE alasan IN ('BIMBINGAN LOMBA', 'KEGIATAN DI DALAM', 'KEGIATAN DI LUAR');
