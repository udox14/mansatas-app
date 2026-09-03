-- Simpan kelas asal saat siswa ditandai keluar agar dapat dipulihkan saat statusnya dibatalkan.
ALTER TABLE siswa ADD COLUMN kelas_id_sebelum_keluar TEXT REFERENCES kelas(id) ON DELETE SET NULL;
