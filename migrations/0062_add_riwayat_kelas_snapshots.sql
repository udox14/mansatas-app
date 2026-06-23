-- Snapshot label kelas agar riwayat tahun ajaran tidak berubah saat master kelas diedit.
ALTER TABLE riwayat_kelas ADD COLUMN kelas_tingkat INTEGER;
ALTER TABLE riwayat_kelas ADD COLUMN kelas_nomor TEXT;
ALTER TABLE riwayat_kelas ADD COLUMN kelas_kelompok TEXT;
ALTER TABLE riwayat_kelas ADD COLUMN kelas_nama TEXT;
