-- Pengajuan pembayaran DSPT dari Portal Orang Tua
CREATE TABLE IF NOT EXISTS fin_payment_submissions (
  id                 TEXT PRIMARY KEY,
  siswa_id           TEXT NOT NULL REFERENCES siswa(id),
  dspt_id            TEXT NOT NULL REFERENCES fin_dspt(id),
  kategori           TEXT NOT NULL DEFAULT 'dspt' CHECK(kategori IN ('dspt')),
  metode_bayar       TEXT NOT NULL DEFAULT 'transfer' CHECK(metode_bayar IN ('transfer', 'qris')),
  jumlah             INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'belum_upload'
                     CHECK(status IN ('belum_upload', 'menunggu_konfirmasi', 'terkonfirmasi', 'ditolak')),
  bukti_url          TEXT,
  bukti_uploaded_at  TEXT,
  confirmed_by       TEXT REFERENCES "user"(id),
  confirmed_at       TEXT,
  rejected_by        TEXT REFERENCES "user"(id),
  rejected_at        TEXT,
  reject_reason      TEXT,
  transaksi_id       TEXT REFERENCES fin_transaksi(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fin_payment_submissions_siswa
  ON fin_payment_submissions(siswa_id, created_at);

CREATE INDEX IF NOT EXISTS idx_fin_payment_submissions_status
  ON fin_payment_submissions(status, created_at);

CREATE INDEX IF NOT EXISTS idx_fin_payment_submissions_dspt
  ON fin_payment_submissions(dspt_id, created_at);

CREATE INDEX IF NOT EXISTS idx_fin_payment_submissions_created
  ON fin_payment_submissions(created_at);

-- Feature menu untuk pengaturan rekening/QR portal orang tua
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'keuangan-pengaturan'),
  ('bendahara_komite', 'keuangan-pengaturan');
