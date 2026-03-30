-- Migration: Tambah kolom catatan_tindak_lanjut + ubah tindak_lanjut ke free text
-- Lokasi: schema-migration-bk-catatan-tindak.sql

-- 1. Tambah kolom catatan_tindak_lanjut
ALTER TABLE bk_rekaman ADD COLUMN catatan_tindak_lanjut TEXT DEFAULT '';

-- 2. Rename kolom tindak_lanjut tidak perlu karena SQLite TEXT sudah fleksibel
--    Hanya default value yang perlu diubah (dari BELUM ke string kosong)
--    Cukup handle di application layer saja.

-- 3. Update existing data: mapping old values ke label Indonesia
UPDATE bk_rekaman SET tindak_lanjut = 'Belum ditindaklanjuti' WHERE tindak_lanjut = 'BELUM';
UPDATE bk_rekaman SET tindak_lanjut = 'Sudah ditindaklanjuti' WHERE tindak_lanjut = 'SUDAH';
UPDATE bk_rekaman SET tindak_lanjut = 'Kolaborasi dengan orang tua' WHERE tindak_lanjut = 'KOLABORASI_ORANG_TUA';
UPDATE bk_rekaman SET tindak_lanjut = 'Pemanggilan orang tua' WHERE tindak_lanjut = 'PEMANGGILAN_ORANG_TUA';
