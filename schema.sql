-- ============================================================
-- MANSATAS - Cloudflare D1 Schema (SQLite)
-- Converted from Supabase PostgreSQL
-- ============================================================

-- Better Auth core tables
CREATE TABLE IF NOT EXISTS "user" (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  emailVerified     INTEGER NOT NULL DEFAULT 0,
  image             TEXT,
  createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now')),
  role              TEXT NOT NULL DEFAULT 'wali_murid',
  nama_lengkap      TEXT,
  avatar_url        TEXT,
  banned            INTEGER DEFAULT 0,
  banReason         TEXT,
  banExpires        TEXT
);

CREATE TABLE IF NOT EXISTS session (
  id                TEXT PRIMARY KEY,
  expiresAt         TEXT NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now')),
  ipAddress         TEXT,
  userAgent         TEXT,
  userId            TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id                       TEXT PRIMARY KEY,
  accountId                TEXT NOT NULL,
  providerId               TEXT NOT NULL,
  userId                   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken              TEXT,
  refreshToken             TEXT,
  idToken                  TEXT,
  accessTokenExpiresAt     TEXT,
  refreshTokenExpiresAt    TEXT,
  scope                    TEXT,
  password                 TEXT,
  createdAt                TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  TEXT NOT NULL,
  createdAt  TEXT DEFAULT (datetime('now')),
  updatedAt  TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- TABEL APLIKASI
-- ============================================================

CREATE TABLE IF NOT EXISTS tahun_ajaran (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama            TEXT NOT NULL,
  semester        INTEGER NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  daftar_jurusan  TEXT DEFAULT '["MIPA","SOSHUM","KEAGAMAAN","UMUM"]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kelas (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tingkat        INTEGER NOT NULL,
  nomor_kelas    TEXT NOT NULL DEFAULT '1',
  kelompok       TEXT NOT NULL DEFAULT 'UMUM',
  kapasitas      INTEGER NOT NULL DEFAULT 36,
  wali_kelas_id  TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS siswa (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nisn                TEXT NOT NULL UNIQUE,
  nis_lokal           TEXT,
  nama_lengkap        TEXT NOT NULL,
  jenis_kelamin       TEXT NOT NULL DEFAULT 'L' CHECK(jenis_kelamin IN ('L','P')),
  tempat_tinggal      TEXT NOT NULL DEFAULT 'Non-Pesantren'
                      CHECK(tempat_tinggal IN ('Pesantren','Non-Pesantren')),
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

CREATE TABLE IF NOT EXISTS mata_pelajaran (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama_mapel  TEXT NOT NULL UNIQUE,
  kode_mapel  TEXT,
  kelompok    TEXT NOT NULL DEFAULT 'UMUM',
  tingkat     TEXT NOT NULL DEFAULT 'Semua',
  kategori    TEXT NOT NULL DEFAULT 'Umum',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS penugasan_mengajar (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_id          TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  mapel_id         TEXT NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
  kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rekap_kehadiran_bulanan (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id         TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  bulan            INTEGER NOT NULL,
  sakit            INTEGER NOT NULL DEFAULT 0,
  izin             INTEGER NOT NULL DEFAULT 0,
  alpa             INTEGER NOT NULL DEFAULT 0,
  diinput_oleh     TEXT NOT NULL REFERENCES "user"(id),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, bulan, tahun_ajaran_id)
);

CREATE TABLE IF NOT EXISTS jurnal_guru_harian (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id      TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  siswa_id          TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal           TEXT NOT NULL,
  status_kehadiran  TEXT CHECK(status_kehadiran IN ('Sakit','Izin','Alpa','Terlambat')),
  catatan           TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS riwayat_kelas (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id         TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);

CREATE TABLE IF NOT EXISTS master_pelanggaran (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kategori          TEXT NOT NULL,
  nama_pelanggaran  TEXT NOT NULL,
  poin              INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS siswa_pelanggaran (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id               TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  master_pelanggaran_id  TEXT NOT NULL REFERENCES master_pelanggaran(id),
  tahun_ajaran_id        TEXT NOT NULL REFERENCES tahun_ajaran(id),
  tanggal                TEXT NOT NULL DEFAULT (date('now')),
  keterangan             TEXT,
  foto_url               TEXT,
  diinput_oleh           TEXT NOT NULL REFERENCES "user"(id),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS izin_keluar_komplek (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id       TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  waktu_keluar   TEXT NOT NULL DEFAULT (datetime('now')),
  waktu_kembali  TEXT,
  status         TEXT NOT NULL DEFAULT 'BELUM KEMBALI'
                 CHECK(status IN ('BELUM KEMBALI','SUDAH KEMBALI')),
  keterangan     TEXT,
  diinput_oleh   TEXT REFERENCES "user"(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS izin_tidak_masuk_kelas (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id       TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal        TEXT NOT NULL DEFAULT (date('now')),
  jam_pelajaran  TEXT NOT NULL,
  alasan         TEXT NOT NULL CHECK(alasan IN ('Sakit','Izin','Keperluan Keluarga','Lainnya')),
  keterangan     TEXT,
  diinput_oleh   TEXT REFERENCES "user"(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengaturan_akademik (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  mapel_snbp      TEXT DEFAULT '[]',
  mapel_span      TEXT DEFAULT '[]',
  bobot_rapor     INTEGER DEFAULT 60,
  bobot_um        INTEGER DEFAULT 40,
  daftar_jurusan  TEXT DEFAULT '["MIPA","SOSHUM","KEAGAMAAN","UMUM"]',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rekap_nilai_akademik (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id    TEXT NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
  nilai_smt1  TEXT DEFAULT '{}',
  nilai_smt2  TEXT DEFAULT '{}',
  nilai_smt3  TEXT DEFAULT '{}',
  nilai_smt4  TEXT DEFAULT '{}',
  nilai_smt5  TEXT DEFAULT '{}',
  nilai_um    TEXT DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_id       ON siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_status          ON siswa(status);
CREATE INDEX IF NOT EXISTS idx_siswa_nisn             ON siswa(nisn);
CREATE INDEX IF NOT EXISTS idx_kelas_tingkat          ON kelas(tingkat);
CREATE INDEX IF NOT EXISTS idx_rekap_kehadiran_siswa  ON rekap_kehadiran_bulanan(siswa_id, bulan, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_jurnal_penugasan        ON jurnal_guru_harian(penugasan_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_pelanggaran_siswa       ON siswa_pelanggaran(siswa_id, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_izin_keluar_siswa       ON izin_keluar_komplek(siswa_id, status);
CREATE INDEX IF NOT EXISTS idx_session_token           ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_userId          ON session(userId);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT OR IGNORE INTO pengaturan_akademik (id) VALUES ('global');