-- Tanggal mulai kelas tidak lagi wajib KBM dalam tahun ajaran berjalan.
-- Dipakai untuk kelas XII setelah perpisahan agar jadwal tidak dihitung alfa.
ALTER TABLE kelas ADD COLUMN kbm_nonaktif_mulai TEXT;
