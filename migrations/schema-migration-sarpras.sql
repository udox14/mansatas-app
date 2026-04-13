-- ============================================================
-- Migrasi Skema: Fitur SARPRAS (Sarana & Prasarana)
-- ============================================================

-- Tabel kategori barang (misal: Elektronik, Mebel, ATK)
CREATE TABLE IF NOT EXISTS sarpras_kategori (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tabel data aset
CREATE TABLE IF NOT EXISTS sarpras_aset (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal_pembukuan  TEXT NOT NULL,
  kategori_id        TEXT NOT NULL REFERENCES sarpras_kategori(id),
  nama_barang        TEXT NOT NULL,
  merek              TEXT,
  kuantitas          INTEGER NOT NULL DEFAULT 1,
  tahun_pembuatan    TEXT,
  asal_anggaran      TEXT, -- Bisa diisi 'ANGGARAN' atau 'HIBAH' atau teks baru
  keadaan_barang     TEXT, -- Bisa diisi 'BAIK', 'KURANG BAIK', 'RUSAK' atau teks baru
  harga              INTEGER,
  foto_url           TEXT,
  keterangan         TEXT, -- Bisa diisi bebas
  diinput_oleh       TEXT REFERENCES "user"(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indeks
CREATE INDEX IF NOT EXISTS idx_sarpras_aset_kategori ON sarpras_aset(kategori_id);
