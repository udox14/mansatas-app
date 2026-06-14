-- patch_06: soft delete siswa
-- Tambah kolom deleted_at. hapusSiswa jadi soft delete (status='dihapus' + deleted_at).
-- Data anak (fin_*, akademik, tahfidz, dll) tetap utuh → reversible.
-- Residu dibersihkan cron /api/cron/purge-siswa (hard delete > 90 hari).

ALTER TABLE siswa ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_siswa_deleted_at ON siswa(deleted_at);
