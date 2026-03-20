-- ============================================================
-- Migration: Perluas CHECK constraint tempat_tinggal di tabel siswa
-- SQLite tidak support DROP CONSTRAINT, jadi perlu recreate tabel
--
-- Jalankan via:
-- wrangler d1 execute mansatas-db --remote --file=schema-migration-tempat-tinggal.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- 1. Buat tabel sementara dengan constraint baru
CREATE TABLE siswa_new (
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
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Copy semua data dari tabel lama
INSERT INTO siswa_new SELECT * FROM siswa;

-- 3. Hapus tabel lama
DROP TABLE siswa;

-- 4. Rename tabel baru
ALTER TABLE siswa_new RENAME TO siswa;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_id  ON siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_status    ON siswa(status);
CREATE INDEX IF NOT EXISTS idx_siswa_nisn      ON siswa(nisn);

PRAGMA foreign_keys = ON;
