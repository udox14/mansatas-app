-- Tetapkan satu atau beberapa hari latihan rutin untuk setiap ekstrakurikuler.
-- Nilai mengikuti konvensi aplikasi: 1=Senin sampai 7=Minggu.
-- Disimpan sebagai JSON array, contoh: [5,6] untuk Jumat dan Sabtu.
ALTER TABLE ekstrakurikuler ADD COLUMN hari_latihan TEXT;
