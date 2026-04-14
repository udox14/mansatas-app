PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE tahun_ajaran (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama            TEXT NOT NULL,
  semester        INTEGER NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  daftar_jurusan  TEXT DEFAULT '["MIPA","SOSHUM","KEAGAMAAN","UMUM"]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
, jam_pelajaran TEXT NOT NULL DEFAULT '[]');
CREATE TABLE kelas (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tingkat        INTEGER NOT NULL,
  nomor_kelas    TEXT NOT NULL DEFAULT '1',
  kelompok       TEXT NOT NULL DEFAULT 'UMUM',
  kapasitas      INTEGER NOT NULL DEFAULT 36,
  wali_kelas_id  TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE mata_pelajaran (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama_mapel  TEXT NOT NULL UNIQUE,
  kode_mapel  TEXT,
  kelompok    TEXT NOT NULL DEFAULT 'UMUM',
  tingkat     TEXT NOT NULL DEFAULT 'Semua',
  kategori    TEXT NOT NULL DEFAULT 'Umum',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE penugasan_mengajar (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_id          TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  mapel_id         TEXT NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
  kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE rekap_kehadiran_bulanan (
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
CREATE TABLE jurnal_guru_harian (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id      TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  siswa_id          TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal           TEXT NOT NULL,
  status_kehadiran  TEXT CHECK(status_kehadiran IN ('Sakit','Izin','Alpa','Terlambat')),
  catatan           TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE riwayat_kelas (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id         TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);
CREATE TABLE master_pelanggaran (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kategori          TEXT NOT NULL,
  nama_pelanggaran  TEXT NOT NULL,
  poin              INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE siswa_pelanggaran (
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
CREATE TABLE izin_keluar_komplek (
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
CREATE TABLE izin_tidak_masuk_kelas (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id       TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal        TEXT NOT NULL DEFAULT (date('now')),
  jam_pelajaran  TEXT NOT NULL, -- JSON array: "[1,2,3]"
  alasan         TEXT NOT NULL CHECK(alasan IN ('Sakit','Izin','Keperluan Keluarga','Lainnya')),
  keterangan     TEXT,
  diinput_oleh   TEXT REFERENCES "user"(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pengaturan_akademik (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  mapel_snbp      TEXT DEFAULT '[]',  -- JSON array
  mapel_span      TEXT DEFAULT '[]',  -- JSON array
  bobot_rapor     INTEGER DEFAULT 60,
  bobot_um        INTEGER DEFAULT 40,
  daftar_jurusan  TEXT DEFAULT '["MIPA","SOSHUM","KEAGAMAAN","UMUM"]',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE rekap_nilai_akademik (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id    TEXT NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
  nilai_smt1  TEXT DEFAULT '{}',  -- JSON object
  nilai_smt2  TEXT DEFAULT '{}',
  nilai_smt3  TEXT DEFAULT '{}',
  nilai_smt4  TEXT DEFAULT '{}',
  nilai_smt5  TEXT DEFAULT '{}',
  nilai_um    TEXT DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
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
, no_hp TEXT, nip TEXT, jabatan_struktural TEXT, tanggal_lahir TEXT, jenis_kelamin TEXT, status_pegawai TEXT, tmt_cpns TEXT, tmt_pns TEXT, pangkat_golongan TEXT, pendidikan_terakhir TEXT, gaji_pokok INTEGER DEFAULT 0, mulai_bekerja TEXT);
CREATE TABLE session (
  id                TEXT PRIMARY KEY,
  expiresAt         TEXT NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now')),
  ipAddress         TEXT,
  userAgent         TEXT,
  userId            TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE TABLE account (
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
CREATE TABLE verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  TEXT NOT NULL,
  createdAt  TEXT DEFAULT (datetime('now')),
  updatedAt  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS "siswa" (
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
, tanggal_keluar TEXT, alasan_keluar  TEXT, keterangan_keluar TEXT);
CREATE TABLE jadwal_mengajar (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  hari            INTEGER NOT NULL CHECK(hari BETWEEN 1 AND 6), -- 1=Senin..6=Sabtu
  jam_ke          INTEGER NOT NULL,                             -- nomor jam pelajaran
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, hari, jam_ke)
);
CREATE TABLE bk_topik (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bidang     TEXT NOT NULL CHECK(bidang IN ('Pribadi','Karir','Sosial','Akademik')),
  nama       TEXT NOT NULL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(bidang, nama)
);
CREATE TABLE bk_rekaman (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  guru_bk_id      TEXT NOT NULL REFERENCES "user"(id),
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id),
  bidang          TEXT NOT NULL CHECK(bidang IN ('Pribadi','Karir','Sosial','Akademik')),
  topik_id        TEXT REFERENCES bk_topik(id) ON DELETE SET NULL,
  deskripsi       TEXT,
  penanganan      TEXT NOT NULL DEFAULT '[]',
  -- JSON array of {tipe, tanggal, catatan}
  -- tipe: KONSELING | KONSELING_KELOMPOK | HOME_VISIT
  tindak_lanjut   TEXT NOT NULL DEFAULT 'BELUM',
  -- BELUM | SUDAH | KOLABORASI_ORANG_TUA | PEMANGGILAN_ORANG_TUA
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
, catatan_tindak_lanjut TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS "kelas_binaan_bk" (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_bk_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kelas_id        TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guru_bk_id, kelas_id, tahun_ajaran_id)
);
CREATE TABLE siswa_psikotes (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
  -- CFIT
  iq_score        INTEGER,
  iq_klasifikasi  TEXT,
  -- Bakat
  bakat_ver       INTEGER,
  bakat_num       INTEGER,
  bakat_skl       INTEGER,
  bakat_abs       INTEGER,
  bakat_mek       INTEGER,
  bakat_rr        INTEGER,
  bakat_kkk       INTEGER,
  -- Minat
  minat_ps        INTEGER,
  minat_nat       INTEGER,
  minat_mek       INTEGER,
  minat_bis       INTEGER,
  minat_art       INTEGER,
  minat_si        INTEGER,
  minat_v         INTEGER,
  minat_m         INTEGER,
  minat_k         INTEGER,
  -- RIASEC & Rekomendasi
  riasec          TEXT,
  mapel_pilihan   TEXT,
  rekom_raw       TEXT,  -- nilai asli dari excel: "MIA/IIS"
  rekom_jurusan   TEXT,  -- hasil mapping ke jurusan DB: "MIPA"
  -- Kepribadian
  mbti            TEXT,
  gaya_belajar    TEXT,
  -- Usia saat tes
  usia_thn        INTEGER,
  usia_bln        INTEGER,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE psikotes_rekom_mapping (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  label_excel TEXT NOT NULL UNIQUE,  -- "MIA", "IIS", "MIA/IIS", "IIS/MIA"
  jurusan_db  TEXT NOT NULL,         -- "MIPA", "SOSHUM", dll
  keterangan  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tka_mapel_pilihan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  mapel_pilihan1  TEXT,
  mapel_pilihan2  TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);
CREATE TABLE tka_hasil (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  siswa_id          TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id   TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  nomor_peserta     TEXT,
  nilai_bind        REAL,
  kategori_bind     TEXT,
  nilai_mat         REAL,
  kategori_mat      TEXT,
  nilai_bing        REAL,
  kategori_bing     TEXT,
  mapel_pilihan1    TEXT,
  nilai_pilihan1    REAL,
  kategori_pilihan1 TEXT,
  mapel_pilihan2    TEXT,
  nilai_pilihan2    REAL,
  kategori_pilihan2 TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(siswa_id, tahun_ajaran_id)
);
CREATE TABLE penerimaan_pt (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id),
  jalur           TEXT NOT NULL,
  -- SNBP | SNBT | SPAN_PTKIN | UM_PTKIN | MANDIRI | PMB_PTS | LAINNYA
  kampus_id       TEXT NOT NULL,    -- id dari kampus.json
  kampus_nama     TEXT NOT NULL,    -- nama lengkap (denormalized)
  program_studi   TEXT,
  status          TEXT NOT NULL DEFAULT 'DITERIMA',
  -- DITERIMA | TIDAK_DITERIMA | MENGUNDURKAN_DIRI
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE web_push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE jadwal_notifikasi (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama          TEXT NOT NULL,
  jenis         TEXT NOT NULL,
  waktu         TEXT NOT NULL,
  hari          TEXT,
  target_roles  TEXT,
  pesan_judul   TEXT NOT NULL,
  pesan_body    TEXT NOT NULL,
  url_tujuan    TEXT,
  aktif         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE undangan_rapat (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  judul         TEXT NOT NULL,
  agenda        TEXT,
  tanggal       TEXT NOT NULL,
  waktu_mulai   TEXT,
  waktu_selesai TEXT,
  tempat        TEXT,
  pengundang_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'aktif',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE peserta_rapat (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  rapat_id    TEXT NOT NULL REFERENCES undangan_rapat(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kehadiran   TEXT DEFAULT 'belum',
  waktu_hadir TEXT,
  catatan     TEXT
);
CREATE TABLE nilai_harian_header (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL,
  tanggal         TEXT NOT NULL,
  jenis_penilaian TEXT NOT NULL,
  topik           TEXT,
  bobot           REAL DEFAULT 1.0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE nilai_harian_detail (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  header_id       TEXT NOT NULL REFERENCES nilai_harian_header(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  nilai           REAL,
  catatan         TEXT
);
CREATE TABLE nilai_harian_kkm (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mapel_id        TEXT NOT NULL,
  tingkat         INTEGER NOT NULL,
  kkm             REAL NOT NULL DEFAULT 70,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tahfidz_siswa (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
  target_juz      INTEGER DEFAULT 1,
  target_surah    TEXT,
  guru_id         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  kelompok        TEXT,
  status          TEXT DEFAULT 'aktif',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tahfidz_progress (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surah           TEXT NOT NULL,
  ayat_mulai      INTEGER,
  ayat_selesai    INTEGER,
  status          TEXT DEFAULT 'hafal',
  tanggal         TEXT NOT NULL,
  guru_id         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tahfidz_nilai (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  semester        INTEGER NOT NULL,
  nilai           REAL NOT NULL,
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tahfidz_setoran_log (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  guru_id         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE master_roles (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  value               TEXT NOT NULL UNIQUE,
  label               TEXT NOT NULL,
  is_custom           INTEGER NOT NULL DEFAULT 0,
  mobile_nav_links    TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE role_features (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  role        TEXT NOT NULL,
  feature_id  TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(role, feature_id)
);
CREATE TABLE user_roles (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, role)
);
CREATE TABLE master_jabatan_struktural (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  urutan      INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE presensi_pegawai (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  jam_masuk       TEXT,
  jam_keluar      TEXT,
  status          TEXT NOT NULL DEFAULT 'hadir',
  keterangan      TEXT,
  foto_masuk      TEXT,
  foto_keluar     TEXT,
  lokasi_masuk    TEXT,
  lokasi_keluar   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')), jam_pulang TEXT, is_telat INTEGER NOT NULL DEFAULT 0, is_pulang_cepat INTEGER NOT NULL DEFAULT 0, diinput_oleh TEXT REFERENCES "user"(id) ON DELETE SET NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tanggal)
);
CREATE TABLE pengaturan_tunjangan (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama                TEXT NOT NULL,
  minimal_kehadiran   INTEGER NOT NULL DEFAULT 20,
  nominal             INTEGER NOT NULL DEFAULT 0,
  urutan              INTEGER DEFAULT 0,
  aktif               INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pengaturan_shift_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL,
  jam_mulai   TEXT NOT NULL,
  jam_selesai TEXT NOT NULL,
  hari        INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE penugasan_piket (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  shift_id      TEXT REFERENCES pengaturan_shift_piket(id) ON DELETE SET NULL,
  tanggal       TEXT NOT NULL,
  status        TEXT DEFAULT 'terjadwal',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE jadwal_guru_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hari        INTEGER NOT NULL,
  jam_mulai   TEXT NOT NULL,
  jam_selesai TEXT NOT NULL
);
CREATE TABLE penugasan_guru_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal     TEXT NOT NULL,
  jam_mulai   TEXT,
  jam_selesai TEXT,
  status      TEXT DEFAULT 'aktif',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE surat_keluar (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis_surat     TEXT NOT NULL,
  nomor_surat     TEXT,
  tanggal_surat   TEXT NOT NULL,
  siswa_id        TEXT REFERENCES siswa(id) ON DELETE SET NULL,
  penandatangan   TEXT,
  data_json       TEXT,
  pembuat_id      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'draft',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE agenda_guru (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL,
  tanggal         TEXT NOT NULL,
  jam_mulai       TEXT,
  jam_selesai     TEXT,
  materi          TEXT,
  catatan         TEXT,
  foto_url        TEXT,
  status          TEXT DEFAULT 'hadir',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE agenda_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal     TEXT NOT NULL,
  jam_mulai   TEXT,
  jam_selesai TEXT,
  catatan     TEXT,
  foto_url    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE absensi_siswa (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'hadir',
  keterangan      TEXT,
  pencatat_id     TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tanggal)
);
CREATE TABLE kedisiplinan_config (
  id                      TEXT PRIMARY KEY DEFAULT '1',
  threshold_perhatian     INTEGER NOT NULL DEFAULT 25,
  threshold_peringatan    INTEGER NOT NULL DEFAULT 50,
  threshold_kritis        INTEGER NOT NULL DEFAULT 75,
  credit_score_awal       INTEGER NOT NULL DEFAULT 100,
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE buku_tamu (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal         TEXT NOT NULL,
  jam             TEXT,
  nama            TEXT NOT NULL,
  asal_instansi   TEXT,
  keperluan       TEXT,
  tujuan_user_id  TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  foto_url        TEXT,
  pencatat_id     TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sarpras_kategori (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sarpras_aset (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kategori_id     TEXT REFERENCES sarpras_kategori(id) ON DELETE SET NULL,
  nama            TEXT NOT NULL,
  kode_aset       TEXT UNIQUE,
  jumlah          INTEGER DEFAULT 1,
  kondisi         TEXT DEFAULT 'baik',
  lokasi          TEXT,
  tanggal_perolehan TEXT,
  nilai_perolehan INTEGER DEFAULT 0,
  keterangan      TEXT,
  foto_url        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE delegasi_tugas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dari_user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kepada_user_id  TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  keterangan      TEXT,
  status          TEXT DEFAULT 'aktif',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE delegasi_tugas_kelas (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  delegasi_id             TEXT NOT NULL REFERENCES delegasi_tugas(id) ON DELETE CASCADE,
  penugasan_mengajar_id   TEXT NOT NULL
);
CREATE TABLE pu_kelas_unggulan (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  aktif         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kelas_id, jenis)
);
CREATE TABLE pu_guru_kelas (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id   TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pu_materi (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis         TEXT NOT NULL,
  minggu_ke     INTEGER NOT NULL,
  judul         TEXT NOT NULL,
  konten        TEXT,
  meta_json     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pu_materi_mingguan (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis         TEXT NOT NULL,
  minggu_ke     INTEGER NOT NULL,
  tahun_ajaran_id TEXT,
  judul         TEXT,
  konten        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pu_materi_mingguan_kelas (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  materi_mingguan_id  TEXT NOT NULL REFERENCES pu_materi_mingguan(id) ON DELETE CASCADE,
  kelas_id            TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'pending',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pu_hasil_tes (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  minggu_ke     INTEGER,
  nilai         REAL,
  catatan       TEXT,
  tanggal       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pu_jadwal_sampling (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  tanggal       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pu_jadwal_sampling_v3 (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  tanggal       TEXT NOT NULL,
  meta_json     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE guru_ppl_mapping (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ppl_user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  guru_user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ppl_user_id, guru_user_id)
);
CREATE TABLE siswa_ppdb (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  no_pendaftaran  TEXT UNIQUE,
  nama_lengkap    TEXT NOT NULL,
  nisn            TEXT,
  jenis_kelamin   TEXT,
  tempat_lahir    TEXT,
  tanggal_lahir   TEXT,
  asal_sekolah    TEXT,
  alamat          TEXT,
  nomor_whatsapp  TEXT,
  status          TEXT DEFAULT 'pending',
  data_json       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE kelas_binaan_bk_new (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_bk_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guru_bk_id, kelas_id)
);
CREATE TABLE siswa_new (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nisn            TEXT,
  nama_lengkap    TEXT,
  data_json       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE user_feature_overrides (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  feature_id  TEXT NOT NULL,
  action      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, feature_id)
);
CREATE TABLE pengaturan_presensi (
  id                          TEXT PRIMARY KEY DEFAULT 'global',
  jam_masuk                   TEXT NOT NULL DEFAULT '07:00',
  jam_pulang                  TEXT NOT NULL DEFAULT '14:00',
  batas_telat_menit           INTEGER NOT NULL DEFAULT 15,
  batas_pulang_cepat_menit    INTEGER NOT NULL DEFAULT 15,
  hari_kerja                  TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_kelas_tingkat         ON kelas(tingkat);
CREATE INDEX idx_rekap_kehadiran_siswa ON rekap_kehadiran_bulanan(siswa_id, bulan, tahun_ajaran_id);
CREATE INDEX idx_jurnal_penugasan       ON jurnal_guru_harian(penugasan_id, tanggal);
CREATE INDEX idx_pelanggaran_siswa      ON siswa_pelanggaran(siswa_id, tahun_ajaran_id);
CREATE INDEX idx_izin_keluar_siswa      ON izin_keluar_komplek(siswa_id, status);
CREATE INDEX idx_siswa_kelas_id  ON siswa(kelas_id);
CREATE INDEX idx_siswa_status    ON siswa(status);
CREATE INDEX idx_siswa_nisn      ON siswa(nisn);
CREATE INDEX idx_penugasan_ta_id
  ON penugasan_mengajar(tahun_ajaran_id);
CREATE INDEX idx_penugasan_guru_ta
  ON penugasan_mengajar(guru_id, tahun_ajaran_id);
CREATE INDEX idx_siswa_kelas_status
  ON siswa(kelas_id, status);
CREATE INDEX idx_rekap_nilai_siswa
  ON rekap_nilai_akademik(siswa_id);
CREATE INDEX idx_jadwal_ta_hari     ON jadwal_mengajar(tahun_ajaran_id, hari);
CREATE INDEX idx_jadwal_penugasan   ON jadwal_mengajar(penugasan_id);
CREATE INDEX idx_bk_topik_bidang      ON bk_topik(bidang);
CREATE INDEX idx_bk_rekaman_siswa     ON bk_rekaman(siswa_id, tahun_ajaran_id);
CREATE INDEX idx_bk_rekaman_guru      ON bk_rekaman(guru_bk_id, tahun_ajaran_id);
CREATE INDEX idx_kelas_binaan_guru  ON kelas_binaan_bk(guru_bk_id, tahun_ajaran_id);
CREATE INDEX idx_kelas_binaan_kelas ON kelas_binaan_bk(kelas_id, tahun_ajaran_id);
CREATE INDEX idx_psikotes_siswa    ON siswa_psikotes(siswa_id);
CREATE INDEX idx_psikotes_rekom    ON siswa_psikotes(rekom_jurusan);
CREATE INDEX idx_psikotes_gaya     ON siswa_psikotes(gaya_belajar);
CREATE INDEX idx_psikotes_iq       ON siswa_psikotes(iq_klasifikasi);
CREATE INDEX idx_siswa_keluar ON siswa(status, tanggal_keluar)
  WHERE status = 'keluar';
CREATE INDEX idx_tka_mapel_ta ON tka_mapel_pilihan(tahun_ajaran_id);
CREATE INDEX idx_tka_mapel_siswa ON tka_mapel_pilihan(siswa_id);
CREATE INDEX idx_tka_hasil_ta ON tka_hasil(tahun_ajaran_id);
CREATE INDEX idx_tka_hasil_siswa ON tka_hasil(siswa_id);
CREATE INDEX idx_pt_ta       ON penerimaan_pt(tahun_ajaran_id);
CREATE INDEX idx_pt_jalur    ON penerimaan_pt(jalur, tahun_ajaran_id);
CREATE INDEX idx_pt_kampus   ON penerimaan_pt(kampus_id, tahun_ajaran_id);
CREATE INDEX idx_pt_siswa    ON penerimaan_pt(siswa_id, tahun_ajaran_id);
CREATE INDEX idx_push_user ON web_push_subscriptions(user_id);
CREATE INDEX idx_peserta_rapat ON peserta_rapat(rapat_id);
CREATE INDEX idx_peserta_user ON peserta_rapat(user_id);
CREATE INDEX idx_nilai_det_header ON nilai_harian_detail(header_id);
CREATE INDEX idx_nilai_det_siswa ON nilai_harian_detail(siswa_id);
CREATE INDEX idx_tahfidz_progress_siswa ON tahfidz_progress(siswa_id);
CREATE INDEX idx_role_features_role ON role_features(role);
CREATE INDEX idx_presensi_user_tgl ON presensi_pegawai(user_id, tanggal);
CREATE INDEX idx_surat_tanggal ON surat_keluar(tanggal_surat);
CREATE INDEX idx_surat_siswa ON surat_keluar(siswa_id);
CREATE INDEX idx_agenda_penugasan ON agenda_guru(penugasan_id, tanggal);
CREATE INDEX idx_absensi_siswa_tgl ON absensi_siswa(siswa_id, tanggal);
CREATE INDEX idx_sarpras_aset_kategori ON sarpras_aset(kategori_id);
CREATE INDEX idx_delegasi_dari_tgl ON delegasi_tugas(dari_user_id, tanggal);
CREATE INDEX idx_delegasi_kepada_tgl ON delegasi_tugas(kepada_user_id, tanggal);
CREATE INDEX idx_delegasi_kelas_del ON delegasi_tugas_kelas(delegasi_id);
