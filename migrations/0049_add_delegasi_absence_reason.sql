-- Add required absence reason metadata to teacher task delegation.
-- Existing rows are backfilled with a safe default so the NOT NULL columns are valid.

ALTER TABLE delegasi_tugas
ADD COLUMN alasan_ketidakhadiran TEXT NOT NULL DEFAULT 'IZIN'
CHECK(alasan_ketidakhadiran IN ('SAKIT','IZIN'));

ALTER TABLE delegasi_tugas
ADD COLUMN deskripsi_ketidakhadiran TEXT NOT NULL DEFAULT 'Data penugasan lama sebelum alasan wajib diterapkan.';
