-- Migration: Tambah tabel konfigurasi kedisiplinan & threshold peringatan
-- Lokasi: migrations/0009_add_kedisiplinan_config.sql

-- Tabel untuk menyimpan aturan/threshold kedisiplinan yang bisa dikonfigurasi admin
CREATE TABLE IF NOT EXISTS kedisiplinan_config (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  label       TEXT,
  keterangan  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert nilai default konfigurasi
INSERT OR IGNORE INTO kedisiplinan_config (key, value, label, keterangan) VALUES
  ('threshold_perhatian',  '25', 'Poin Butuh Perhatian',    'Siswa dengan akumulasi poin di atas nilai ini dianggap perlu pengawasan'),
  ('threshold_peringatan', '50', 'Poin Peringatan Keras',   'Siswa dengan akumulasi poin di atas nilai ini mendapat peringatan keras (Surat Peringatan)'),
  ('threshold_kritis',     '75', 'Poin Level Kritis',       'Siswa dengan akumulasi poin di atas nilai ini mendapat tindakan khusus / panggilan orang tua'),
  ('credit_score_awal',   '100', 'Credit Score Awal',       'Nilai awal credit score siswa di awal tahun ajaran. Poin pelanggaran akan mengurangi nilai ini');
