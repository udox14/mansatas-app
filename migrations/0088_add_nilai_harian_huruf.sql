-- Tambahkan pilihan nilai angka atau huruf (A-E) per sesi Nilai Harian.
-- Kolom nilai pada detail tetap dipakai karena SQLite mendukung nilai TEXT
-- pada kolom REAL; tipe sesi menjadi sumber validasi dan interpretasinya.
ALTER TABLE nilai_harian_header
  ADD COLUMN tipe_nilai TEXT NOT NULL DEFAULT 'angka'
  CHECK (tipe_nilai IN ('angka', 'huruf'));
