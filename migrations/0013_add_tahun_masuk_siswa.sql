-- Migration: Add tahun_masuk column to siswa table
-- Tahun masuk (angkatan) siswa — tahun mereka pertama kali masuk sekolah

ALTER TABLE siswa ADD COLUMN tahun_masuk INTEGER;

-- Backfill: isi tahun_masuk dengan tahun dari created_at sebagai nilai awal.
-- Admin TU bisa memperbaiki data individual lewat form edit siswa.
UPDATE siswa SET tahun_masuk = CAST(strftime('%Y', created_at) AS INTEGER) WHERE tahun_masuk IS NULL;
