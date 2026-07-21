-- Format SPB Komite dua halaman dengan rincian pembayaran dan realisasi pencairan.
ALTER TABLE komite_pengajuan ADD COLUMN tahun_anggaran TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN kode_rkas_program TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN realisasi_status TEXT NOT NULL DEFAULT 'belum'
  CHECK (realisasi_status IN ('belum','sudah'));
ALTER TABLE komite_pengajuan ADD COLUMN realisasi_tanggal TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN realisasi_metode TEXT
  CHECK (realisasi_metode IS NULL OR realisasi_metode IN ('Tunai','Transfer'));
ALTER TABLE komite_pengajuan ADD COLUMN realisasi_petugas TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN realisasi_catatan TEXT;

CREATE TABLE IF NOT EXISTS komite_pengajuan_rincian (
  id TEXT PRIMARY KEY,
  pengajuan_id TEXT NOT NULL REFERENCES komite_pengajuan(id) ON DELETE CASCADE,
  urutan INTEGER NOT NULL CHECK (urutan BETWEEN 1 AND 10),
  uraian TEXT NOT NULL,
  penerima_penyedia TEXT NOT NULL,
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (pengajuan_id, urutan)
);

CREATE INDEX IF NOT EXISTS idx_komite_rincian_pengajuan ON komite_pengajuan_rincian(pengajuan_id, urutan);

UPDATE komite_pengajuan
SET tahun_anggaran = COALESCE(tahun_anggaran, strftime('%Y','now') || '/' || (CAST(strftime('%Y','now') AS INTEGER) + 1)),
    kode_rkas_program = COALESCE(kode_rkas_program, '-')
WHERE tahun_anggaran IS NULL OR kode_rkas_program IS NULL;

INSERT OR IGNORE INTO komite_pengajuan_rincian (id, pengajuan_id, urutan, uraian, penerima_penyedia, jumlah)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
       id,
       1,
       COALESCE(NULLIF(uraian,''), judul),
       COALESCE(NULLIF(penerima_pembayaran,''), '-'),
       nominal
FROM komite_pengajuan
WHERE NOT EXISTS (
  SELECT 1 FROM komite_pengajuan_rincian r WHERE r.pengajuan_id = komite_pengajuan.id
);
