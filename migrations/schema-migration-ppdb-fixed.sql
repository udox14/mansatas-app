-- ============================================================
-- MIGRATION: Tambah data PPDB lengkap ke tabel siswa
-- FIXED: Kolom PPDB dipisah ke tabel `siswa_ppdb` karena
--        Cloudflare D1 membatasi maksimal 100 kolom per tabel.
--        Tabel siswa (49 kol) + siswa_ppdb (65 kol) = aman.
--
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-ppdb-fixed.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ============================================================
-- Tabel siswa TIDAK DIUBAH strukturnya (tetap 49 kolom, aman).
-- Semua kolom PPDB baru masuk ke tabel siswa_ppdb di bawah.
-- ============================================================

CREATE TABLE IF NOT EXISTS siswa_ppdb (
  siswa_id            TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,

  -- ---- Identitas & Pendaftaran ----
  no_pendaftaran      TEXT,
  tanggal_daftar      TEXT,
  tahun_daftar        TEXT,

  -- ---- Data Diri Tambahan ----
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

  -- ---- Alamat Tambahan ----
  dusun               TEXT,
  tempat_tinggal_ppdb TEXT,
  moda_transportasi   TEXT,

  -- ---- Bantuan Sosial ----
  no_kks              TEXT,
  penerima_kps_pkh    TEXT,
  no_kps_pkh          TEXT,
  penerima_kip        TEXT,
  no_kip              TEXT,
  nama_di_kip         TEXT,
  terima_fisik_kip    TEXT,

  -- ---- Ortu Tambahan ----
  berkebutuhan_khusus_ayah  TEXT,
  no_hp_ayah                TEXT,
  berkebutuhan_khusus_ibu   TEXT,
  no_hp_ibu                 TEXT,

  -- ---- Data Wali ----
  nama_wali           TEXT,
  nik_wali            TEXT,
  tempat_lahir_wali   TEXT,
  tanggal_lahir_wali  TEXT,
  pendidikan_wali     TEXT,
  pekerjaan_wali      TEXT,
  penghasilan_wali    TEXT,
  no_hp_wali          TEXT,

  -- ---- Sekolah Asal ----
  asal_sekolah        TEXT,
  akreditasi_sekolah  TEXT,
  no_un               TEXT,
  no_seri_ijazah      TEXT,
  no_seri_skhu        TEXT,
  tahun_lulus         TEXT,

  -- ---- Pilihan Sekolah/Jurusan ----
  sekolah_pilihan_2   TEXT,
  jurusan_pilihan_1   TEXT,
  jurusan_pilihan_2   TEXT,

  -- ---- Geolokasi ----
  latitude            TEXT,
  longitude           TEXT,
  radius              TEXT,
  rentang_jarak       TEXT,
  waktu_tempuh        TEXT,

  -- ---- Penerimaan & Nilai ----
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

  -- ---- Status PPDB ----
  status_hasil        TEXT,
  status_daftar_ulang TEXT,
  catatan             TEXT,
  keterangan          TEXT,

  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index untuk lookup dan filter umum
CREATE INDEX IF NOT EXISTS idx_siswa_ppdb_tahun_daftar  ON siswa_ppdb(tahun_daftar);
CREATE INDEX IF NOT EXISTS idx_siswa_ppdb_status_hasil  ON siswa_ppdb(status_hasil);
CREATE INDEX IF NOT EXISTS idx_siswa_ppdb_jalur_masuk   ON siswa_ppdb(jalur_masuk);

PRAGMA foreign_keys = ON;
