-- ============================================================
-- MIGRATION: PMB (Penerimaan Murid Baru) — public intake tables
-- Dipakai bersama oleh:
--   1. Public app  (C:\DATA\mansatas-pmb)  → Cloudflare Pages, bind D1 `DB`
--   2. Admin panel (app/dashboard/pmb)     → mansatas-app
--
-- Prefix `pmb_` untuk hindari bentrok dgn `siswa_ppdb` (extension EMIS).
-- Pendaftar BUKAN siswa — pindah ke tabel `siswa` hanya saat DITERIMA
-- (kolom pmb_pendaftar.siswa_id diisi saat konversi).
--
-- Jalankan:
--   wrangler d1 execute mansatas-db --local  --file=migrations/schema-migration-pmb.sql
--   wrangler d1 execute mansatas-db --remote --file=migrations/schema-migration-pmb.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ============================================================
-- pmb_pendaftar — data pendaftaran (basis: tabel `pendaftar` app lama)
-- ============================================================
CREATE TABLE IF NOT EXISTS pmb_pendaftar (
  id                           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  created_at                   TEXT DEFAULT (datetime('now')),
  updated_at                   TEXT DEFAULT (datetime('now')),

  -- ---- Pendaftaran & Status ----
  no_pendaftaran               TEXT,
  tahun_ajaran                 TEXT,                    -- mis. '2026/2027' (dari pmb_pengaturan.tahun_pmb saat submit)
  jalur                        TEXT NOT NULL,           -- REGULER | PRESTASI
  status_verifikasi            INTEGER,                 -- NULL=pending, 1=diterima, 0=ditolak
  berkas_ditolak               TEXT DEFAULT NULL,       -- alasan tolak berkas
  status_kelulusan             TEXT DEFAULT 'PENDING',  -- PENDING | DITERIMA | TIDAK DITERIMA
  daftar_ulang_status          TEXT DEFAULT NULL,       -- NULL | SELESAI
  siswa_id                     TEXT,                    -- FK → siswa(id), diisi saat konversi

  -- ---- Data Diri ----
  nisn                         TEXT NOT NULL,
  nik                          TEXT NOT NULL,
  nama_lengkap                 TEXT NOT NULL,
  jenis_kelamin                TEXT,
  tempat_lahir                 TEXT,
  tanggal_lahir                TEXT,                    -- YYYY-MM-DD (dipakai juga utk password siswa)
  ukuran_baju                  TEXT,
  agama                        TEXT DEFAULT 'Islam',
  jumlah_saudara               INTEGER,
  anak_ke                      INTEGER,
  status_anak                  TEXT,

  -- ---- Alamat ----
  provinsi                     TEXT,
  kabupaten_kota               TEXT,
  kecamatan                    TEXT,
  desa_kelurahan               TEXT,
  rt                           TEXT,
  rw                           TEXT,
  alamat_lengkap               TEXT,
  kode_pos                     TEXT,

  -- ---- Keluarga ----
  no_kk                        TEXT,
  nama_ayah                    TEXT,
  nik_ayah                     TEXT,
  tempat_lahir_ayah            TEXT,
  tanggal_lahir_ayah           TEXT,
  status_ayah                  TEXT,
  pendidikan_ayah              TEXT,
  pekerjaan_ayah               TEXT,
  penghasilan_ayah             REAL,
  nama_ibu                     TEXT,
  nik_ibu                      TEXT,
  tempat_lahir_ibu             TEXT,
  tanggal_lahir_ibu            TEXT,
  status_ibu                   TEXT,
  pendidikan_ibu               TEXT,
  pekerjaan_ibu                TEXT,
  penghasilan_ibu              REAL,
  no_telepon_ortu              TEXT,
  nama_wali                    TEXT,
  nik_wali                     TEXT,
  tempat_lahir_wali            TEXT,
  tanggal_lahir_wali           TEXT,
  pendidikan_wali              TEXT,
  pekerjaan_wali               TEXT,
  penghasilan_wali             REAL,
  no_telepon_wali              TEXT,

  -- ---- Sekolah Asal & Pesantren ----
  asal_sekolah                 TEXT,
  npsn_sekolah                 TEXT,
  status_sekolah               TEXT,
  alamat_sekolah               TEXT,
  pilihan_pesantren            TEXT,

  -- ---- Berkas (R2 URL, key prefix pmb/) ----
  foto_url                     TEXT,
  scan_kk_url                  TEXT,
  scan_akta_url                TEXT,
  scan_kelakuan_baik_url       TEXT,
  scan_ktp_ortu_url            TEXT,
  scan_rapor_url               TEXT,
  scan_sertifikat_prestasi_url TEXT,

  -- ---- Tes (diisi admin via plotting) ----
  tanggal_tes                  TEXT,
  sesi_tes                     TEXT,
  ruang_tes                    TEXT,
  nilai_rapor                  REAL,

  FOREIGN KEY (siswa_id) REFERENCES siswa(id)
);

CREATE INDEX IF NOT EXISTS idx_pmb_pendaftar_nisn        ON pmb_pendaftar(nisn);
CREATE INDEX IF NOT EXISTS idx_pmb_pendaftar_nik         ON pmb_pendaftar(nik);
CREATE INDEX IF NOT EXISTS idx_pmb_pendaftar_jalur       ON pmb_pendaftar(jalur);
CREATE INDEX IF NOT EXISTS idx_pmb_pendaftar_verifikasi  ON pmb_pendaftar(status_verifikasi);
CREATE INDEX IF NOT EXISTS idx_pmb_pendaftar_kelulusan   ON pmb_pendaftar(status_kelulusan);
CREATE INDEX IF NOT EXISTS idx_pmb_pendaftar_no          ON pmb_pendaftar(no_pendaftaran);
CREATE INDEX IF NOT EXISTS idx_pmb_pendaftar_tahun       ON pmb_pendaftar(tahun_ajaran);

-- ============================================================
-- pmb_prestasi — child (achievements jalur PRESTASI)
-- ============================================================
CREATE TABLE IF NOT EXISTS pmb_prestasi (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pendaftar_id    TEXT NOT NULL,
  kategori        TEXT,             -- Akademik | Non-Akademik | Keagamaan | Tahfidz
  nama_lomba      TEXT,
  penyelenggara   TEXT,
  tingkat         TEXT,             -- Sekolah | Kecamatan | Kabupaten | Provinsi | Nasional | Internasional
  tahun_perolehan TEXT,
  sertifikat_url  TEXT,
  FOREIGN KEY (pendaftar_id) REFERENCES pmb_pendaftar(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pmb_prestasi_pendaftar ON pmb_prestasi(pendaftar_id);

-- ============================================================
-- pmb_pengaturan — key/value (tahun_pmb, jadwal, teks homepage, link WA)
-- ============================================================
CREATE TABLE IF NOT EXISTS pmb_pengaturan (
  key       TEXT PRIMARY KEY,
  value     TEXT,
  is_active INTEGER DEFAULT 1
);

-- Seed nilai default (INSERT OR IGNORE: tidak menimpa jika sudah ada)
INSERT OR IGNORE INTO pmb_pengaturan (key, value, is_active) VALUES
  ('tahun_pmb',            '2026/2027', 1),  -- SUMBER TUNGGAL tahun & prefix no_pendaftaran (2026/2027 -> 2627)
  ('pmb_dibuka',           '1',         1),  -- 1=pendaftaran buka, 0=tutup
  ('tanggal_buka',         '',          1),
  ('tanggal_tutup',        '',          1),
  ('tanggal_pengumuman',   '',          1),
  ('teks_hero',            'Penerimaan Murid Baru MAN 1 Tasikmalaya', 1),
  ('link_grup_wa',         '',          1),
  ('kontak_wa',            '',          1);

-- ============================================================
-- pmb_jadwal_tes — config sesi tes utk plotting (admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS pmb_jadwal_tes (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal      TEXT NOT NULL,
  sesi         TEXT NOT NULL,     -- mis. 'Sesi 1: 07:30-09:00'
  ruang        TEXT NOT NULL,
  kapasitas    INTEGER DEFAULT 36,
  jalur        TEXT,              -- REGULER | PRESTASI | NULL(semua)
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pmb_jadwal_tanggal ON pmb_jadwal_tes(tanggal);

-- ============================================================
-- Seed akses fitur 'pmb' utk role panitia (role_features sudah terisi di DB,
-- jadi fallback MENU_ITEMS tidak berlaku — harus di-insert eksplisit).
-- ============================================================
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'pmb'),
  ('admin_tu',    'pmb'),
  ('kepsek',      'pmb'),
  ('wakamad',     'pmb');

PRAGMA foreign_keys = ON;
