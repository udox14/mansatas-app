-- Migration: Add asal_sekolah column to siswa table
-- Digunakan untuk biodata lengkap siswa dan template import siswa.

ALTER TABLE siswa ADD COLUMN asal_sekolah TEXT;
