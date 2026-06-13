-- Migration: Fitur SP (Surat Peringatan) — penetapan, cetak, riwayat, tindak lanjut, keputusan
-- Tabel: surat_peringatan, sp_tindak_lanjut, sp_keputusan + seed role_features 'sp'

-- SP yang diterbitkan (per-surat: SP1/SP2/SP3)
CREATE TABLE IF NOT EXISTS surat_peringatan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  level           TEXT NOT NULL,              -- 'sp1' | 'sp2' | 'sp3'
  nomor_urut      INTEGER NOT NULL,
  nomor_surat     TEXT NOT NULL,
  tahun           INTEGER NOT NULL,
  tanggal_sp      TEXT,
  total_poin      INTEGER DEFAULT 0,          -- snapshot poin saat ditetapkan
  alasan          TEXT,
  data_surat      TEXT NOT NULL DEFAULT '{}', -- JSON utk cetak (siswa, pejabat, print_settings)
  file_ttd_url    TEXT,                       -- SP sudah ditandatangani (webp terkompres di R2)
  ditetapkan_oleh TEXT NOT NULL REFERENCES "user"(id),
  nama_penetap    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tindak lanjut (pembinaan, panggilan ortu, dll) per siswa/SP
CREATE TABLE IF NOT EXISTS sp_tindak_lanjut (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id            TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surat_peringatan_id TEXT REFERENCES surat_peringatan(id) ON DELETE SET NULL,
  tanggal             TEXT,
  jenis               TEXT,                   -- 'pembinaan' | 'panggilan_ortu' | 'home_visit' | 'lainnya'
  catatan             TEXT,
  oleh                TEXT REFERENCES "user"(id),
  nama_oleh           TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Keputusan akhir per siswa (catat saja, status siswa diubah manual)
CREATE TABLE IF NOT EXISTS sp_keputusan (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id    TEXT NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
  keputusan   TEXT NOT NULL,                  -- 'naik' | 'pindah' | 'dikeluarkan'
  tanggal     TEXT,
  catatan     TEXT,
  oleh        TEXT REFERENCES "user"(id),
  nama_oleh   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sp_siswa ON surat_peringatan(siswa_id);
CREATE INDEX IF NOT EXISTS idx_sp_tahun ON surat_peringatan(tahun);
CREATE INDEX IF NOT EXISTS idx_sptl_siswa ON sp_tindak_lanjut(siswa_id);

-- Seed izin fitur 'sp'
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'sp'),
  ('kepsek', 'sp'),
  ('wakamad', 'sp'),
  ('admin_tu', 'sp'),
  ('guru_bk', 'sp');
