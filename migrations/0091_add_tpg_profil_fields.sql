-- Tambah kolom NUPTK, NRG, dan No. Urut TPG untuk Guru di tabel user
ALTER TABLE "user" ADD COLUMN nuptk TEXT;
ALTER TABLE "user" ADD COLUMN nrg TEXT;
ALTER TABLE "user" ADD COLUMN no_urut TEXT;
