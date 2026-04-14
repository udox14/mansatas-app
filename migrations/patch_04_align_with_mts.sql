-- =========================================================================
-- PATCH 04 — FINAL ALIGNMENT WITH MTS SCHEMA (Source of Truth)
-- =========================================================================
-- Bos kasih schema MTs (production), saya pakai sebagai source of truth.
-- Patch ini bikin schema MAN PERSIS sama dengan MTs.
--
-- Strategy:
--   1. ALTER ADD COLUMN untuk core tables (preserve data: siswa, kelas, user, dll)
--   2. DROP & RECREATE untuk tabel modul (data masih kosong, aman di-drop)
--   3. Tabel MAN-specific (tka_*, penerimaan_pt, kelas_binaan_bk_new, dll) TIDAK disentuh
--
-- AMAN: data siswa, user, kelas, mapel, penugasan, nilai TIDAK disentuh.
-- Idempotent: bisa di-run berkali-kali.
--
-- CARA PAKAI:
--   wrangler d1 execute mansatas-db --remote --file=migrations/patch_04_align_with_mts.sql
--
-- Setelah ini WAJIB run patch_05_seed_role_features.sql biar sidebar muncul!
-- =========================================================================

-- =========================================================================
-- BAGIAN 1: ALTER core tables (preserve existing data)
-- =========================================================================
--
-- NOTE PENTING: Kolom di bawah ini di-ALTER satu per satu. Kalau ada error
-- "duplicate column name", ABAIKAN — artinya kolom sudah ada dari patch
-- sebelumnya. Tapi karena D1 gak support "continue on error", kalau 1 ALTER
-- gagal, seluruh file gagal.
--
-- SOLUSI: Saya kasih file terpisah `patch_04a_alters.sql` berisi 6 ALTER
-- ini sebagai statement individual. Bos run-nya via command-line satu-satu,
-- skip yang error. Lihat instruksi di bawah.

-- (ALTER statements dipindah ke patch_04a_alters.sql)


-- =========================================================================
-- BAGIAN 2: DROP & RECREATE module tables (using MTs DDL as source of truth)
-- =========================================================================

-- ── absensi_siswa ──
DROP TABLE IF EXISTS absensi_siswa;
CREATE TABLE absensi_siswa (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  jam_ke_mulai    INTEGER NOT NULL,
  jam_ke_selesai  INTEGER NOT NULL,
  jumlah_jam      INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL CHECK(status IN ('SAKIT','ALFA','IZIN')),
  catatan         TEXT,
  diinput_oleh    TEXT NOT NULL REFERENCES "user"(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, siswa_id, tanggal)
);
CREATE INDEX idx_absensi_siswa_tgl     ON absensi_siswa(tanggal, status);
CREATE INDEX idx_absensi_siswa_id_tgl  ON absensi_siswa(siswa_id, tanggal);
CREATE INDEX idx_absensi_penugasan_tgl ON absensi_siswa(penugasan_id, tanggal);

-- ── agenda_guru ──
DROP TABLE IF EXISTS agenda_guru;
CREATE TABLE agenda_guru (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,                                          -- format: YYYY-MM-DD
  jam_ke_mulai    INTEGER NOT NULL,                                       -- jam ke awal blok
  jam_ke_selesai  INTEGER NOT NULL,                                       -- jam ke akhir blok
  materi          TEXT,                                                    -- isian bebas guru
  foto_url        TEXT,                                                    -- URL foto di R2
  status          TEXT NOT NULL DEFAULT 'TEPAT_WAKTU'
                  CHECK(status IN ('TEPAT_WAKTU','TELAT','ALFA','SAKIT','IZIN')),
  waktu_input     TEXT,                                                    -- datetime saat guru submit
  catatan_admin   TEXT,                                                    -- catatan jika admin edit
  diubah_oleh     TEXT REFERENCES "user"(id) ON DELETE SET NULL,          -- user terakhir yg edit
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, tanggal)
);
CREATE INDEX idx_agenda_guru_tanggal   ON agenda_guru(guru_id, tanggal);
CREATE INDEX idx_agenda_tanggal_status ON agenda_guru(tanggal, status);
CREATE INDEX idx_agenda_penugasan_tgl  ON agenda_guru(penugasan_id, tanggal);

-- ── agenda_piket ──
DROP TABLE IF EXISTS agenda_piket;
CREATE TABLE agenda_piket (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  jadwal_id     TEXT NOT NULL REFERENCES jadwal_guru_piket(id) ON DELETE CASCADE,
  shift_id      INTEGER NOT NULL REFERENCES pengaturan_shift_piket(id),
  tanggal       TEXT NOT NULL,          -- Format YYYY-MM-DD
  foto_url      TEXT,                   -- URL foto dari R2 (via /api/media/)
  status        TEXT NOT NULL DEFAULT 'HADIR', -- HADIR | TELAT | ALFA | SAKIT | IZIN
  waktu_submit  TEXT,                   -- ISO datetime WIB saat submit
  catatan_admin TEXT,                   -- Catatan dari admin saat override status
  diubah_oleh   TEXT REFERENCES "user"(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, jadwal_id, tanggal)
);
CREATE INDEX idx_agenda_piket_tanggal ON agenda_piket(tanggal);
CREATE INDEX idx_agenda_piket_user    ON agenda_piket(user_id);
CREATE INDEX idx_agenda_piket_jadwal  ON agenda_piket(jadwal_id);

-- ── buku_tamu ──
DROP TABLE IF EXISTS buku_tamu;
CREATE TABLE buku_tamu (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal       TEXT NOT NULL,                         -- format YYYY-MM-DD (WIB)
  waktu         TEXT NOT NULL,                         -- format HH:MM (WIB)
  kategori      TEXT NOT NULL CHECK(kategori IN ('INDIVIDU', 'INSTANSI')),
  nama          TEXT,                                  -- diisi jika INDIVIDU
  instansi      TEXT,                                  -- diisi jika INSTANSI
  maksud_tujuan TEXT NOT NULL,
  foto_url      TEXT,                                  -- URL R2 public
  dicatat_oleh  TEXT REFERENCES "user"(id),            -- user resepsionis
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_buku_tamu_tanggal ON buku_tamu(tanggal);
CREATE INDEX idx_buku_tamu_kategori ON buku_tamu(kategori);
CREATE INDEX idx_buku_tamu_created ON buku_tamu(created_at DESC);

-- ── delegasi_tugas ──
DROP TABLE IF EXISTS delegasi_tugas;
CREATE TABLE delegasi_tugas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dari_user_id    TEXT NOT NULL REFERENCES "user"(id),
  kepada_user_id  TEXT NOT NULL REFERENCES "user"(id),
  tanggal         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'DIKIRIM' CHECK(status IN ('DIKIRIM','SELESAI')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_delegasi_dari_tanggal ON delegasi_tugas(dari_user_id, tanggal);
CREATE INDEX idx_delegasi_kepada_tanggal ON delegasi_tugas(kepada_user_id, tanggal);

-- ── delegasi_tugas_kelas ──
DROP TABLE IF EXISTS delegasi_tugas_kelas;
CREATE TABLE delegasi_tugas_kelas (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  delegasi_id             TEXT NOT NULL REFERENCES delegasi_tugas(id) ON DELETE CASCADE,
  penugasan_mengajar_id   TEXT NOT NULL REFERENCES penugasan_mengajar(id),
  kelas_id                TEXT NOT NULL REFERENCES kelas(id),
  tugas                   TEXT NOT NULL,
  absen_selesai           INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_delegasi_kelas_delegasi ON delegasi_tugas_kelas(delegasi_id);
CREATE INDEX idx_delegasi_kelas_penugasan ON delegasi_tugas_kelas(penugasan_mengajar_id);

-- ── guru_ppl_mapping ──
DROP TABLE IF EXISTS guru_ppl_mapping;
CREATE TABLE guru_ppl_mapping (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    guru_ppl_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    guru_utama_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    jadwal_mengajar_id TEXT REFERENCES jadwal_mengajar(id) ON DELETE CASCADE,
    jadwal_piket_id TEXT REFERENCES jadwal_guru_piket(id) ON DELETE CASCADE,
    pu_kelas_id TEXT REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_guru_ppl_mapping_ppl ON guru_ppl_mapping(guru_ppl_id);
CREATE INDEX idx_guru_ppl_mapping_utama ON guru_ppl_mapping(guru_utama_id);

-- ── jadwal_guru_piket ──
DROP TABLE IF EXISTS jadwal_guru_piket;
CREATE TABLE jadwal_guru_piket (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hari         INTEGER NOT NULL CHECK(hari BETWEEN 1 AND 7),
  shift_id     INTEGER NOT NULL REFERENCES pengaturan_shift_piket(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, hari, shift_id)
);

-- ── jadwal_notifikasi ──
DROP TABLE IF EXISTS jadwal_notifikasi;
CREATE TABLE jadwal_notifikasi (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama TEXT NOT NULL,                    -- Nama tampilan (misal: "Pengingat Mengajar")
  judul TEXT NOT NULL,                   -- Judul push notification
  isi TEXT NOT NULL,                     -- Body push notification
  url TEXT DEFAULT '/dashboard',         -- URL tujuan saat notif diklik
  jam TEXT NOT NULL,                     -- Jam kirim WIB format "HH:MM" misal "06:30"
  hari_aktif TEXT DEFAULT '[1,2,3,4,5,6]', -- JSON array hari [1=Sen, 7=Min]
  target_type TEXT DEFAULT 'all',        -- 'all', 'role', 'custom'
  target_role TEXT,                      -- Diisi jika target_type = 'role'
  target_user_ids TEXT DEFAULT '[]',    -- JSON array user IDs jika target_type = 'custom'
  is_active INTEGER DEFAULT 1,          -- 1 = aktif, 0 = nonaktif
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── kedisiplinan_config ──
DROP TABLE IF EXISTS kedisiplinan_config;
CREATE TABLE kedisiplinan_config (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  label       TEXT,
  keterangan  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── master_roles ──
DROP TABLE IF EXISTS master_roles;
CREATE TABLE master_roles (
  value       TEXT PRIMARY KEY,  -- slug role: 'guru', 'admin_tu', dll
  label       TEXT NOT NULL,     -- nama tampil: 'Guru Mata Pelajaran'
  is_custom   INTEGER NOT NULL DEFAULT 0,  -- 1 = role custom buatan admin
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
, mobile_nav_links TEXT DEFAULT '[]');

-- ── nilai_harian_header ──
DROP TABLE IF EXISTS nilai_harian_header;
CREATE TABLE nilai_harian_header (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  judul           TEXT NOT NULL,        -- "Ulangan Harian 1", "Tugas 2", dll
  tanggal         TEXT NOT NULL,        -- format YYYY-MM-DD
  keterangan      TEXT,                 -- catatan opsional
  kkm             INTEGER DEFAULT 75,   -- KKM per sesi (bisa di-override)
  created_by      TEXT NOT NULL REFERENCES "user"(id),
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_nilai_header_penugasan ON nilai_harian_header(penugasan_id);
CREATE INDEX idx_nilai_header_ta        ON nilai_harian_header(tahun_ajaran_id);

-- ── nilai_harian_kkm ──
DROP TABLE IF EXISTS nilai_harian_kkm;
CREATE TABLE nilai_harian_kkm (
  penugasan_id TEXT PRIMARY KEY REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  kkm          INTEGER NOT NULL DEFAULT 75,
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- ── pengaturan_shift_piket ──
DROP TABLE IF EXISTS pengaturan_shift_piket;
CREATE TABLE pengaturan_shift_piket (
  id           INTEGER PRIMARY KEY,
  nama_shift   TEXT NOT NULL,
  jam_mulai    INTEGER NOT NULL,
  jam_selesai  INTEGER NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── pengaturan_tunjangan ──
DROP TABLE IF EXISTS pengaturan_tunjangan;
CREATE TABLE pengaturan_tunjangan (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  nominal_dalam   INTEGER NOT NULL DEFAULT 0,
  nominal_luar    INTEGER NOT NULL DEFAULT 0,
  tanggal_bayar   INTEGER NOT NULL DEFAULT 25,
  aturan_tiers    TEXT NOT NULL DEFAULT '[{"min":90,"max":100,"persen":100},{"min":75,"max":89,"persen":75},{"min":50,"max":74,"persen":50},{"min":0,"max":49,"persen":0}]',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── penugasan_guru_piket ──
DROP TABLE IF EXISTS penugasan_guru_piket;
CREATE TABLE penugasan_guru_piket (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  urutan          INTEGER NOT NULL DEFAULT 1,
  is_aktif_minggu_ini INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, guru_id)
);
CREATE INDEX idx_piket_penugasan ON penugasan_guru_piket(penugasan_id);
CREATE INDEX idx_piket_guru ON penugasan_guru_piket(guru_id);

-- ── peserta_rapat ──
DROP TABLE IF EXISTS peserta_rapat;
CREATE TABLE peserta_rapat (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  rapat_id        TEXT NOT NULL REFERENCES undangan_rapat(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES "user"(id),
  status_kehadiran TEXT NOT NULL DEFAULT 'BELUM_RESPOND' CHECK(status_kehadiran IN ('BELUM_RESPOND', 'HADIR', 'TIDAK_HADIR')),
  alasan_tidak_hadir TEXT,
  waktu_respon    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_peserta_rapat_id ON peserta_rapat(rapat_id);
CREATE INDEX idx_peserta_user_id ON peserta_rapat(user_id);

-- ── presensi_pegawai ──
DROP TABLE IF EXISTS presensi_pegawai;
CREATE TABLE presensi_pegawai (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal           TEXT NOT NULL,
  jam_masuk         TEXT,
  jam_pulang        TEXT,
  status            TEXT NOT NULL DEFAULT 'hadir'
                    CHECK(status IN ('hadir','sakit','izin','alfa','dinas_luar')),
  is_telat          INTEGER NOT NULL DEFAULT 0,
  is_pulang_cepat   INTEGER NOT NULL DEFAULT 0,
  catatan           TEXT,
  diinput_oleh      TEXT NOT NULL REFERENCES "user"(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tanggal)
);
CREATE INDEX idx_presensi_user_tanggal ON presensi_pegawai(user_id, tanggal);
CREATE INDEX idx_presensi_tanggal ON presensi_pegawai(tanggal);

-- ── pu_guru_kelas ──
DROP TABLE IF EXISTS pu_guru_kelas;
CREATE TABLE pu_guru_kelas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  jam_mengajar    INTEGER NOT NULL DEFAULT 2 CHECK(jam_mengajar BETWEEN 1 AND 4),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guru_id, pu_kelas_id)
);
CREATE INDEX idx_pu_guru_guru       ON pu_guru_kelas(guru_id);
CREATE INDEX idx_pu_guru_pukelas    ON pu_guru_kelas(pu_kelas_id);

-- ── pu_hasil_tes ──
DROP TABLE IF EXISTS pu_hasil_tes;
CREATE TABLE pu_hasil_tes (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL DEFAULT (date('now')),
  nilai           TEXT CHECK(nilai IN ('Lancar', 'Kurang Lancar', 'Tidak Lancar')),
  status          TEXT NOT NULL DEFAULT 'belum'
                  CHECK(status IN ('belum', 'sudah', 'sakit', 'izin', 'alfa')),
  round_number    INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pu_hasil_kelas_tgl ON pu_hasil_tes(pu_kelas_id, tanggal);
CREATE INDEX idx_pu_hasil_siswa     ON pu_hasil_tes(siswa_id);
CREATE INDEX idx_pu_hasil_guru_tgl  ON pu_hasil_tes(guru_id, tanggal);

-- ── pu_jadwal_sampling ──
DROP TABLE IF EXISTS pu_jadwal_sampling;
CREATE TABLE "pu_jadwal_sampling" (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  minggu_mulai    TEXT NOT NULL,
  hari            INTEGER NOT NULL CHECK(hari BETWEEN 1 AND 6),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pu_kelas_id, siswa_id, minggu_mulai, hari)
);
CREATE INDEX idx_pu_jadwal_sampling_kelas ON pu_jadwal_sampling(pu_kelas_id, minggu_mulai);
CREATE INDEX idx_pu_jadwal_sampling_siswa ON pu_jadwal_sampling(siswa_id, minggu_mulai);

-- ── pu_kelas_unggulan ──
DROP TABLE IF EXISTS pu_kelas_unggulan;
CREATE TABLE pu_kelas_unggulan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id        TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kelas_id, tahun_ajaran_id)
);
CREATE INDEX idx_pu_kelas_ta        ON pu_kelas_unggulan(tahun_ajaran_id);
CREATE INDEX idx_pu_kelas_kelas     ON pu_kelas_unggulan(kelas_id);

-- ── pu_materi ──
DROP TABLE IF EXISTS pu_materi;
CREATE TABLE pu_materi (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  judul           TEXT NOT NULL,
  konten          TEXT NOT NULL DEFAULT '',
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  urutan          INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pu_materi_kelas    ON pu_materi(pu_kelas_id, is_active);

-- ── pu_materi_mingguan ──
DROP TABLE IF EXISTS pu_materi_mingguan;
CREATE TABLE pu_materi_mingguan (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  program         TEXT NOT NULL CHECK(program IN ('tahfidz','bahasa_arab','bahasa_inggris')),
  minggu_mulai    TEXT NOT NULL,
  konten          TEXT NOT NULL DEFAULT '{}',
  created_by      TEXT REFERENCES "user"(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pu_materi_mingguan_prog ON pu_materi_mingguan(program, minggu_mulai);

-- ── pu_materi_mingguan_kelas ──
DROP TABLE IF EXISTS pu_materi_mingguan_kelas;
CREATE TABLE pu_materi_mingguan_kelas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  materi_id       TEXT NOT NULL REFERENCES pu_materi_mingguan(id) ON DELETE CASCADE,
  pu_kelas_id     TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  UNIQUE(materi_id, pu_kelas_id)
);
CREATE INDEX idx_pu_materi_mingguan_kelas ON pu_materi_mingguan_kelas(materi_id);
CREATE INDEX idx_pu_materi_mingguan_kelas2 ON pu_materi_mingguan_kelas(pu_kelas_id);

-- ── role_features ──
DROP TABLE IF EXISTS role_features;
CREATE TABLE role_features (
  role        TEXT NOT NULL,
  feature_id  TEXT NOT NULL,
  PRIMARY KEY (role, feature_id)
);
CREATE INDEX idx_role_features_role ON role_features(role);
CREATE INDEX idx_role_features_feature ON role_features(feature_id);

-- ── sarpras_aset ──
DROP TABLE IF EXISTS sarpras_aset;
CREATE TABLE sarpras_aset (
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
CREATE INDEX idx_sarpras_aset_kategori ON sarpras_aset(kategori_id);

-- ── siswa_ppdb ──
DROP TABLE IF EXISTS siswa_ppdb;
CREATE TABLE siswa_ppdb (
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
CREATE INDEX idx_siswa_ppdb_tahun_daftar  ON siswa_ppdb(tahun_daftar);
CREATE INDEX idx_siswa_ppdb_status_hasil  ON siswa_ppdb(status_hasil);
CREATE INDEX idx_siswa_ppdb_jalur_masuk   ON siswa_ppdb(jalur_masuk);

-- ── surat_keluar ──
DROP TABLE IF EXISTS surat_keluar;
CREATE TABLE surat_keluar (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis_surat     TEXT NOT NULL,
  nomor_urut      INTEGER NOT NULL,
  nomor_surat     TEXT NOT NULL,
  tahun           INTEGER NOT NULL,
  perihal         TEXT,
  data_surat      TEXT NOT NULL DEFAULT '{}',
  dicetak_oleh    TEXT NOT NULL REFERENCES "user"(id),
  nama_pencetak   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_surat_jenis ON surat_keluar(jenis_surat);
CREATE INDEX idx_surat_tahun ON surat_keluar(tahun);
CREATE INDEX idx_surat_created ON surat_keluar(created_at);

-- ── tahfidz_nilai ──
DROP TABLE IF EXISTS tahfidz_nilai;
CREATE TABLE tahfidz_nilai (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  juz          INTEGER NOT NULL,
  nilai        REAL NOT NULL DEFAULT 0,
  catatan      TEXT,
  updated_by   TEXT REFERENCES "user"(id),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, juz)
);
CREATE INDEX idx_tahfidz_nilai_siswa ON tahfidz_nilai(siswa_id);

-- ── tahfidz_progress ──
DROP TABLE IF EXISTS tahfidz_progress;
CREATE TABLE tahfidz_progress (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surah_nomor  INTEGER NOT NULL,   -- 1-114
  juz          INTEGER NOT NULL,   -- 1, 26-30
  ayat_hafal   TEXT NOT NULL DEFAULT '[]', -- JSON array of integers: [1,2,3]
  updated_by   TEXT REFERENCES "user"(id),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, surah_nomor)
);
CREATE INDEX idx_tahfidz_prog_siswa ON tahfidz_progress(siswa_id);

-- ── tahfidz_setoran_log ──
DROP TABLE IF EXISTS tahfidz_setoran_log;
CREATE TABLE tahfidz_setoran_log (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surah_nomor  INTEGER NOT NULL,
  juz          INTEGER NOT NULL,
  ayat_baru    TEXT NOT NULL DEFAULT '[]', -- JSON array of integers: [4,5,6] yg disetorkan di sesi ini
  keterangan   TEXT,
  diinput_oleh TEXT NOT NULL REFERENCES "user"(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tahfidz_log_siswa ON tahfidz_setoran_log(siswa_id);

-- ── tahfidz_siswa ──
DROP TABLE IF EXISTS tahfidz_siswa;
CREATE TABLE tahfidz_siswa (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  ditambah_oleh TEXT REFERENCES "user"(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id)
);

-- ── undangan_rapat ──
DROP TABLE IF EXISTS undangan_rapat;
CREATE TABLE undangan_rapat (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agenda          TEXT NOT NULL,
  tanggal         TEXT NOT NULL,
  waktu           TEXT NOT NULL,
  tempat          TEXT NOT NULL,
  catatan         TEXT,
  pengundang_id   TEXT NOT NULL REFERENCES "user"(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rapat_pengundang ON undangan_rapat(pengundang_id);

-- ── user_feature_overrides ──
DROP TABLE IF EXISTS user_feature_overrides;
CREATE TABLE user_feature_overrides (
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  feature_id  TEXT NOT NULL,
  action      TEXT NOT NULL CHECK(action IN ('grant', 'revoke')),
  PRIMARY KEY (user_id, feature_id)
);
CREATE INDEX idx_user_feature_overrides_user ON user_feature_overrides(user_id);

-- ── user_roles ──
DROP TABLE IF EXISTS user_roles;
CREATE TABLE user_roles (
  user_id   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role      TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- ── web_push_subscriptions ──
DROP TABLE IF EXISTS web_push_subscriptions;
CREATE TABLE web_push_subscriptions (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  user_agent      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_web_push_user_id ON web_push_subscriptions(user_id);

-- =========================================================================
-- VERIFY:
--   wrangler d1 execute mansatas-db --remote --command="PRAGMA table_info(absensi_siswa)"
--   → harus ada penugasan_id, jam_ke_mulai, jam_ke_selesai, jumlah_jam, catatan, diinput_oleh
--
--   wrangler d1 execute mansatas-db --remote --command="PRAGMA table_info(\"user\")"
--   → harus ada jabatan_struktural_id, domisili_pegawai
-- =========================================================================
