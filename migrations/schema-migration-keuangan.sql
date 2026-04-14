-- ============================================================
-- MODUL KEUANGAN: DSPT, SPP, Koperasi, Transaksi, Diskon
-- Kas Keluar, Void Log, Janji Bayar, Import Log
-- ============================================================

-- 1. Tagihan DSPT (1 per siswa, nominal target bervariasi)
CREATE TABLE IF NOT EXISTS fin_dspt (
  id               TEXT PRIMARY KEY,
  siswa_id         TEXT NOT NULL REFERENCES siswa(id),
  nominal_target   INTEGER NOT NULL DEFAULT 0,
  total_dibayar    INTEGER NOT NULL DEFAULT 0,
  total_diskon     INTEGER NOT NULL DEFAULT 0,
  -- status: belum_bayar | nyicil | lunas
  status           TEXT NOT NULL DEFAULT 'belum_bayar',
  catatan          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id)
);
CREATE INDEX IF NOT EXISTS idx_fin_dspt_siswa ON fin_dspt(siswa_id);
CREATE INDEX IF NOT EXISTS idx_fin_dspt_status ON fin_dspt(status);

-- 2. Pengaturan SPP per tingkat kelas (toggle aktif/nonaktif)
CREATE TABLE IF NOT EXISTS fin_spp_setting (
  id          TEXT PRIMARY KEY,
  tingkat     INTEGER NOT NULL,  -- 10 | 11 | 12
  nominal     INTEGER NOT NULL DEFAULT 0,
  -- aktif: 1 = SPP ditagihkan untuk tingkat ini, 0 = dinonaktifkan
  aktif       INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT REFERENCES user(id),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tingkat)
);
INSERT OR IGNORE INTO fin_spp_setting (id, tingkat, nominal, aktif) VALUES
  ('spp-10', 10, 0, 1),
  ('spp-11', 11, 0, 1),
  ('spp-12', 12, 0, 1);

-- 3. Tagihan SPP per bulan per siswa
CREATE TABLE IF NOT EXISTS fin_spp_tagihan (
  id               TEXT PRIMARY KEY,
  siswa_id         TEXT NOT NULL REFERENCES siswa(id),
  bulan            INTEGER NOT NULL,  -- 1–12
  tahun            INTEGER NOT NULL,
  nominal          INTEGER NOT NULL DEFAULT 0,
  total_dibayar    INTEGER NOT NULL DEFAULT 0,
  total_diskon     INTEGER NOT NULL DEFAULT 0,
  -- status: belum_bayar | lunas
  status           TEXT NOT NULL DEFAULT 'belum_bayar',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, bulan, tahun)
);
CREATE INDEX IF NOT EXISTS idx_fin_spp_siswa ON fin_spp_tagihan(siswa_id);
CREATE INDEX IF NOT EXISTS idx_fin_spp_periode ON fin_spp_tagihan(tahun, bulan);
CREATE INDEX IF NOT EXISTS idx_fin_spp_status ON fin_spp_tagihan(status);

-- 4. Master item koperasi (seragam, buku, dll)
CREATE TABLE IF NOT EXISTS fin_koperasi_master_item (
  id               TEXT PRIMARY KEY,
  nama_item        TEXT NOT NULL,
  nominal_default  INTEGER NOT NULL DEFAULT 0,
  aktif            INTEGER NOT NULL DEFAULT 1,
  urutan           INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Header tagihan koperasi per siswa per tahun ajaran
CREATE TABLE IF NOT EXISTS fin_koperasi_tagihan (
  id               TEXT PRIMARY KEY,
  siswa_id         TEXT NOT NULL REFERENCES siswa(id),
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id),
  total_nominal    INTEGER NOT NULL DEFAULT 0,
  total_dibayar    INTEGER NOT NULL DEFAULT 0,
  total_diskon     INTEGER NOT NULL DEFAULT 0,
  -- status: belum_bayar | nyicil | lunas
  status           TEXT NOT NULL DEFAULT 'belum_bayar',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);
CREATE INDEX IF NOT EXISTS idx_fin_kop_tagihan_siswa ON fin_koperasi_tagihan(siswa_id);
CREATE INDEX IF NOT EXISTS idx_fin_kop_tagihan_status ON fin_koperasi_tagihan(status);

-- 6. Detail item per tagihan koperasi siswa
CREATE TABLE IF NOT EXISTS fin_koperasi_tagihan_item (
  id               TEXT PRIMARY KEY,
  tagihan_id       TEXT NOT NULL REFERENCES fin_koperasi_tagihan(id),
  master_item_id   TEXT REFERENCES fin_koperasi_master_item(id),
  nama_item        TEXT NOT NULL,  -- snapshot nama saat tagihan dibuat
  nominal          INTEGER NOT NULL DEFAULT 0,
  total_dibayar    INTEGER NOT NULL DEFAULT 0,
  total_diskon     INTEGER NOT NULL DEFAULT 0,
  -- status: belum_bayar | lunas
  status           TEXT NOT NULL DEFAULT 'belum_bayar',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fin_kop_item_tagihan ON fin_koperasi_tagihan_item(tagihan_id);
CREATE INDEX IF NOT EXISTS idx_fin_kop_item_status ON fin_koperasi_tagihan_item(status);

-- 7. Header transaksi pembayaran masuk
CREATE TABLE IF NOT EXISTS fin_transaksi (
  id                  TEXT PRIMARY KEY,
  siswa_id            TEXT NOT NULL REFERENCES siswa(id),
  -- kategori: dspt | spp | koperasi
  kategori            TEXT NOT NULL,
  -- metode_bayar: tunai | transfer
  metode_bayar        TEXT NOT NULL DEFAULT 'tunai',
  bukti_transfer_url  TEXT,
  jumlah_total        INTEGER NOT NULL DEFAULT 0,
  input_oleh          TEXT NOT NULL REFERENCES user(id),
  -- void
  is_void             INTEGER NOT NULL DEFAULT 0,
  void_at             TEXT,
  void_oleh           TEXT REFERENCES user(id),
  void_alasan         TEXT,
  nomor_kuitansi      TEXT UNIQUE,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fin_trx_siswa ON fin_transaksi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_fin_trx_kategori ON fin_transaksi(kategori);
CREATE INDEX IF NOT EXISTS idx_fin_trx_created ON fin_transaksi(created_at);
CREATE INDEX IF NOT EXISTS idx_fin_trx_void ON fin_transaksi(is_void);

-- 8. Detail line items per transaksi
CREATE TABLE IF NOT EXISTS fin_transaksi_detail (
  id            TEXT PRIMARY KEY,
  transaksi_id  TEXT NOT NULL REFERENCES fin_transaksi(id),
  -- ref_type: dspt | spp_tagihan | koperasi_item
  ref_type      TEXT NOT NULL,
  ref_id        TEXT NOT NULL,
  jumlah        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_fin_trx_detail_trx ON fin_transaksi_detail(transaksi_id);

-- 9. Diskon / keringanan biaya
CREATE TABLE IF NOT EXISTS fin_diskon (
  id           TEXT PRIMARY KEY,
  siswa_id     TEXT NOT NULL REFERENCES siswa(id),
  -- target_type: dspt | spp_tagihan | koperasi_item
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  jumlah       INTEGER NOT NULL DEFAULT 0,
  -- alasan: anak_guru | beasiswa | prasejahtera | lainnya
  alasan       TEXT NOT NULL,
  keterangan   TEXT,
  dibuat_oleh  TEXT NOT NULL REFERENCES user(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fin_diskon_siswa ON fin_diskon(siswa_id);

-- 10. Kas keluar / pengeluaran (hanya Bendahara Komite)
CREATE TABLE IF NOT EXISTS fin_kas_keluar (
  id           TEXT PRIMARY KEY,
  jumlah       INTEGER NOT NULL DEFAULT 0,
  keterangan   TEXT NOT NULL,
  kategori     TEXT,
  -- metode: tunai | transfer
  metode       TEXT NOT NULL DEFAULT 'tunai',
  bukti_url    TEXT,
  tanggal      TEXT NOT NULL,
  dibuat_oleh  TEXT NOT NULL REFERENCES user(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fin_kas_keluar_tanggal ON fin_kas_keluar(tanggal);

-- 11. Janji bayar per siswa per tagihan
CREATE TABLE IF NOT EXISTS fin_janji_bayar (
  id              TEXT PRIMARY KEY,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id),
  -- target_type: dspt | spp | koperasi
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  tanggal_janji   TEXT NOT NULL,
  catatan         TEXT,
  dibuat_oleh     TEXT NOT NULL REFERENCES user(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fin_janji_siswa ON fin_janji_bayar(siswa_id);
CREATE INDEX IF NOT EXISTS idx_fin_janji_tanggal ON fin_janji_bayar(tanggal_janji);

-- 12. Log import Excel
CREATE TABLE IF NOT EXISTS fin_import_log (
  id             TEXT PRIMARY KEY,
  filename       TEXT NOT NULL,
  -- tipe_data: dspt | spp | koperasi
  tipe_data      TEXT NOT NULL,
  jumlah_baris   INTEGER NOT NULL DEFAULT 0,
  jumlah_sukses  INTEGER NOT NULL DEFAULT 0,
  jumlah_gagal   INTEGER NOT NULL DEFAULT 0,
  error_detail   TEXT,  -- JSON array error per baris
  diimport_oleh  TEXT NOT NULL REFERENCES user(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. Sequence counter nomor kuitansi
CREATE TABLE IF NOT EXISTS fin_nomor_kuitansi_seq (
  id       TEXT PRIMARY KEY DEFAULT 'singleton',
  counter  INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO fin_nomor_kuitansi_seq (id, counter) VALUES ('singleton', 0);

-- ============================================================
-- RBAC: Feature IDs keuangan untuk role
-- ============================================================
-- Bendahara Komite: akses penuh semua fitur keuangan
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('bendahara_komite', 'keuangan-dashboard'),
  ('bendahara_komite', 'keuangan-dspt'),
  ('bendahara_komite', 'keuangan-spp'),
  ('bendahara_komite', 'keuangan-koperasi'),
  ('bendahara_komite', 'keuangan-kas-keluar'),
  ('bendahara_komite', 'keuangan-laporan'),
  ('bendahara_komite', 'keuangan-kuitansi'),
  ('super_admin', 'keuangan-dashboard'),
  ('super_admin', 'keuangan-dspt'),
  ('super_admin', 'keuangan-spp'),
  ('super_admin', 'keuangan-koperasi'),
  ('super_admin', 'keuangan-kas-keluar'),
  ('super_admin', 'keuangan-laporan'),
  ('super_admin', 'keuangan-kuitansi');

-- Pengurus Koperasi: hanya koperasi + kuitansi
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('pengurus_koperasi', 'keuangan-koperasi'),
  ('pengurus_koperasi', 'keuangan-kuitansi');
