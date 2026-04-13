-- ============================================================
-- MIGRATION: Tambah kolom PPDB lengkap ke tabel siswa
-- Menggunakan table-rebuild (bukan ALTER TABLE) karena D1 punya
-- limit internal pada operasi ALTER TABLE multi-kolom.
--
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-ppdb.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE siswa_new (
  -- ---- KOLOM LAMA (tidak berubah) ----
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nisn                TEXT NOT NULL UNIQUE,
  nis_lokal           TEXT,
  nama_lengkap        TEXT NOT NULL,
  jenis_kelamin       TEXT NOT NULL DEFAULT 'L' CHECK(jenis_kelamin IN ('L','P')),
  tempat_tinggal      TEXT NOT NULL DEFAULT 'Non-Pesantren'
                      CHECK(tempat_tinggal IN (
                        'Non-Pesantren',
                        'Pesantren',
                        'Pesantren Sukahideng',
                        'Pesantren Sukamanah',
                        'Pesantren Sukaguru',
                        'Pesantren Al-Ma''mur'
                      )),
  kelas_id            TEXT REFERENCES kelas(id) ON DELETE SET NULL,
  wali_murid_id       TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'aktif',
  foto_url            TEXT,
  minat_jurusan       TEXT,
  nik                 TEXT,
  tempat_lahir        TEXT,
  tanggal_lahir       TEXT,
  agama               TEXT,
  jumlah_saudara      INTEGER,
  anak_ke             INTEGER,
  status_anak         TEXT,
  alamat_lengkap      TEXT,
  rt                  TEXT,
  rw                  TEXT,
  desa_kelurahan      TEXT,
  kecamatan           TEXT,
  kabupaten_kota      TEXT,
  provinsi            TEXT,
  kode_pos            TEXT,
  nomor_whatsapp      TEXT,
  nomor_kk            TEXT,
  nama_ayah           TEXT,
  nik_ayah            TEXT,
  tempat_lahir_ayah   TEXT,
  tanggal_lahir_ayah  TEXT,
  status_ayah         TEXT,
  pendidikan_ayah     TEXT,
  pekerjaan_ayah      TEXT,
  penghasilan_ayah    TEXT,
  nama_ibu            TEXT,
  nik_ibu             TEXT,
  tempat_lahir_ibu    TEXT,
  tanggal_lahir_ibu   TEXT,
  status_ibu          TEXT,
  pendidikan_ibu      TEXT,
  pekerjaan_ibu       TEXT,
  penghasilan_ibu     TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  tanggal_keluar      TEXT,
  alasan_keluar       TEXT,
  keterangan_keluar   TEXT,

  -- ---- KOLOM BARU: Identitas & Pendaftaran ----
  no_pendaftaran      TEXT,
  tanggal_daftar      TEXT,
  tahun_daftar        TEXT,

  -- ---- KOLOM BARU: Data Diri Tambahan ----
  no_akta_lahir       TEXT,
  kewarganegaraan     TEXT,
  berkebutuhan_khusus TEXT,
  hobi                TEXT,
  email_siswa         TEXT,
  nomor_hp_siswa      TEXT,
  no_telepon_rumah    TEXT,
  tinggi_badan        REAL,
  berat_badan         REAL,
  lingkar_kepala      REAL,

  -- ---- KOLOM BARU: Alamat Tambahan ----
  dusun               TEXT,
  tempat_tinggal_ppdb TEXT,
  moda_transportasi   TEXT,

  -- ---- KOLOM BARU: Bantuan Sosial ----
  no_kks              TEXT,
  penerima_kps_pkh    TEXT,
  no_kps_pkh          TEXT,
  penerima_kip        TEXT,
  no_kip              TEXT,
  nama_di_kip         TEXT,
  terima_fisik_kip    TEXT,

  -- ---- KOLOM BARU: Ortu Tambahan ----
  berkebutuhan_khusus_ayah  TEXT,
  no_hp_ayah                TEXT,
  berkebutuhan_khusus_ibu   TEXT,
  no_hp_ibu                 TEXT,

  -- ---- KOLOM BARU: Data Wali ----
  nama_wali           TEXT,
  nik_wali            TEXT,
  tempat_lahir_wali   TEXT,
  tanggal_lahir_wali  TEXT,
  pendidikan_wali     TEXT,
  pekerjaan_wali      TEXT,
  penghasilan_wali    TEXT,
  no_hp_wali          TEXT,

  -- ---- KOLOM BARU: Sekolah Asal ----
  asal_sekolah        TEXT,
  akreditasi_sekolah  TEXT,
  no_un               TEXT,
  no_seri_ijazah      TEXT,
  no_seri_skhu        TEXT,
  tahun_lulus         TEXT,

  -- ---- KOLOM BARU: Pilihan Sekolah/Jurusan ----
  sekolah_pilihan_2   TEXT,
  jurusan_pilihan_1   TEXT,
  jurusan_pilihan_2   TEXT,

  -- ---- KOLOM BARU: Geolokasi ----
  latitude            TEXT,
  longitude           TEXT,
  radius              TEXT,
  rentang_jarak       TEXT,
  waktu_tempuh        TEXT,

  -- ---- KOLOM BARU: Penerimaan & Nilai ----
  jalur_masuk         TEXT,
  nilai_rapor         REAL,
  nilai_us            REAL,
  nilai_un            REAL,
  nilai_rerata_rapor  REAL,
  jumlah_nilai        REAL,
  nilai_jarak         REAL,
  nilai_prestasi      REAL,
  nilai_tes           REAL,
  nilai_wawancara     REAL,
  nilai_akhir         REAL,

  -- ---- KOLOM BARU: Status PPDB ----
  status_hasil        TEXT,
  status_daftar_ulang TEXT,
  catatan             TEXT,
  keterangan          TEXT
);

-- Salin semua data lama (kolom baru otomatis NULL)
INSERT INTO siswa_new SELECT
  id, nisn, nis_lokal, nama_lengkap, jenis_kelamin, tempat_tinggal,
  kelas_id, wali_murid_id, status, foto_url, minat_jurusan,
  nik, tempat_lahir, tanggal_lahir, agama,
  jumlah_saudara, anak_ke, status_anak,
  alamat_lengkap, rt, rw, desa_kelurahan, kecamatan, kabupaten_kota,
  provinsi, kode_pos, nomor_whatsapp, nomor_kk,
  nama_ayah, nik_ayah, tempat_lahir_ayah, tanggal_lahir_ayah, status_ayah,
  pendidikan_ayah, pekerjaan_ayah, penghasilan_ayah,
  nama_ibu, nik_ibu, tempat_lahir_ibu, tanggal_lahir_ibu, status_ibu,
  pendidikan_ibu, pekerjaan_ibu, penghasilan_ibu,
  created_at, updated_at,
  tanggal_keluar, alasan_keluar, keterangan_keluar,
  NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL
FROM siswa;

DROP TABLE siswa;
ALTER TABLE siswa_new RENAME TO siswa;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_id   ON siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_status     ON siswa(status);
CREATE INDEX IF NOT EXISTS idx_siswa_nisn       ON siswa(nisn);
CREATE INDEX IF NOT EXISTS idx_siswa_keluar     ON siswa(status, tanggal_keluar);

PRAGMA foreign_keys = ON;
