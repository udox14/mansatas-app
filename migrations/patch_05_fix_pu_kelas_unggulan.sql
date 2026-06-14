-- patch_05: buang sisa tabel Program Unggulan (pu_*) yang tak terpakai.
-- Penyebab error "no such table: main.pu_kelas_unggulan" saat hapus siswa:
-- tabel anak pu_* punya FK REFERENCES pu_kelas_unggulan(id) + siswa(id),
-- tapi induk pu_kelas_unggulan sudah hilang. DELETE FROM siswa cascade ke
-- tabel anak → SQLite validasi FK induk yang tak ada → error.
--
-- Tabel pu_* bekas migrasi lama, tidak dipakai kode app sama sekali.
-- Fix: drop semua. Anak dulu, induk terakhir.

DROP TABLE IF EXISTS pu_materi_mingguan_kelas;
DROP TABLE IF EXISTS pu_materi_mingguan;
DROP TABLE IF EXISTS pu_materi;
DROP TABLE IF EXISTS pu_hasil_tes;
DROP TABLE IF EXISTS pu_jadwal_sampling;
DROP TABLE IF EXISTS pu_guru_kelas;
DROP TABLE IF EXISTS pu_kelas_unggulan;
