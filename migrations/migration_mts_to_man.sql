-- =========================================================================
-- MIGRATION: MTS → MAN 1 Tasikmalaya (MANSATAS App)
-- =========================================================================
-- Safe & non-destructive. Semua tabel existing di live DB MAN TIDAK disentuh.
-- Operasi hanya:
--   (1) CREATE TABLE IF NOT EXISTS — untuk tabel yang belum ada
--   (2) ALTER TABLE ADD COLUMN     — untuk kolom baru (akan error kalau sudah ada, diabaikan)
--   (3) INSERT OR IGNORE           — untuk seed data minimal
--
-- CARA PAKAI:
--   # Backup dulu!
--   wrangler d1 export mansatas-db --remote --output=backup_$(date +%Y%m%d).sql
--
--   # Dry run lokal dulu (opsional)
--   wrangler d1 execute mansatas-db --file=migrations/migration_mts_to_man.sql
--
--   # Production
--   wrangler d1 execute mansatas-db --remote --file=migrations/migration_mts_to_man.sql
--
-- CATATAN:
--   - ALTER TABLE ADD COLUMN di SQLite WILL FAIL kalau kolom sudah ada.
--     Kalau kamu lihat error "duplicate column name", ABAIKAN — itu tandanya
--     kolom sudah pernah ditambahkan sebelumnya. Migration akan lanjut ke
--     statement berikutnya.
--   - Kalau ada error "table already exists" — sama, abaikan.
-- =========================================================================

-- =========================================================================
-- BAGIAN 1: ALTER TABLE — tambah kolom baru ke tabel existing
-- =========================================================================

-- user table: kolom baru untuk modul baru (no_hp, jabatan, dll)
ALTER TABLE "user" ADD COLUMN no_hp TEXT;
ALTER TABLE "user" ADD COLUMN nip TEXT;
ALTER TABLE "user" ADD COLUMN jabatan_struktural TEXT;
ALTER TABLE "user" ADD COLUMN tanggal_lahir TEXT;
ALTER TABLE "user" ADD COLUMN jenis_kelamin TEXT;
ALTER TABLE "user" ADD COLUMN status_pegawai TEXT;
ALTER TABLE "user" ADD COLUMN tmt_cpns TEXT;
ALTER TABLE "user" ADD COLUMN tmt_pns TEXT;
ALTER TABLE "user" ADD COLUMN pangkat_golongan TEXT;
ALTER TABLE "user" ADD COLUMN pendidikan_terakhir TEXT;
ALTER TABLE "user" ADD COLUMN gaji_pokok INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN mulai_bekerja TEXT;

-- =========================================================================
-- BAGIAN 2: CREATE TABLE IF NOT EXISTS — tabel baru
-- =========================================================================

-- Web Push Subscriptions
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_user ON web_push_subscriptions(user_id);

-- Jadwal Notifikasi (untuk cron)
CREATE TABLE IF NOT EXISTS jadwal_notifikasi (
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

-- Rapat: Undangan & Peserta
CREATE TABLE IF NOT EXISTS undangan_rapat (
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

CREATE TABLE IF NOT EXISTS peserta_rapat (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  rapat_id    TEXT NOT NULL REFERENCES undangan_rapat(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kehadiran   TEXT DEFAULT 'belum',
  waktu_hadir TEXT,
  catatan     TEXT
);
CREATE INDEX IF NOT EXISTS idx_peserta_rapat ON peserta_rapat(rapat_id);
CREATE INDEX IF NOT EXISTS idx_peserta_user ON peserta_rapat(user_id);

-- Nilai Harian (header + detail + KKM)
CREATE TABLE IF NOT EXISTS nilai_harian_header (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL,
  tanggal         TEXT NOT NULL,
  jenis_penilaian TEXT NOT NULL,
  topik           TEXT,
  bobot           REAL DEFAULT 1.0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nilai_harian_detail (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  header_id       TEXT NOT NULL REFERENCES nilai_harian_header(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  nilai           REAL,
  catatan         TEXT
);
CREATE INDEX IF NOT EXISTS idx_nilai_det_header ON nilai_harian_detail(header_id);
CREATE INDEX IF NOT EXISTS idx_nilai_det_siswa ON nilai_harian_detail(siswa_id);

CREATE TABLE IF NOT EXISTS nilai_harian_kkm (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mapel_id        TEXT NOT NULL,
  tingkat         INTEGER NOT NULL,
  kkm             REAL NOT NULL DEFAULT 70,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tahfidz
CREATE TABLE IF NOT EXISTS tahfidz_siswa (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
  target_juz      INTEGER DEFAULT 1,
  target_surah    TEXT,
  guru_id         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  kelompok        TEXT,
  status          TEXT DEFAULT 'aktif',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tahfidz_progress (
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
CREATE INDEX IF NOT EXISTS idx_tahfidz_progress_siswa ON tahfidz_progress(siswa_id);

CREATE TABLE IF NOT EXISTS tahfidz_nilai (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  semester        INTEGER NOT NULL,
  nilai           REAL NOT NULL,
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tahfidz_setoran_log (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  guru_id         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Master Roles & Permissions
CREATE TABLE IF NOT EXISTS master_roles (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  value               TEXT NOT NULL UNIQUE,
  label               TEXT NOT NULL,
  is_custom           INTEGER NOT NULL DEFAULT 0,
  mobile_nav_links    TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_features (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  role        TEXT NOT NULL,
  feature_id  TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(role, feature_id)
);
CREATE INDEX IF NOT EXISTS idx_role_features_role ON role_features(role);

CREATE TABLE IF NOT EXISTS user_feature_overrides (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  feature_id  TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, feature_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS master_jabatan_struktural (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  urutan      INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Presensi Pegawai + Tunjangan
CREATE TABLE IF NOT EXISTS presensi_pegawai (
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
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_presensi_user_tgl ON presensi_pegawai(user_id, tanggal);

CREATE TABLE IF NOT EXISTS pengaturan_presensi (
  id                      TEXT PRIMARY KEY DEFAULT '1',
  jam_masuk_standar       TEXT NOT NULL DEFAULT '07:00',
  jam_keluar_standar      TEXT NOT NULL DEFAULT '14:00',
  toleransi_menit         INTEGER NOT NULL DEFAULT 15,
  lokasi_lat              REAL,
  lokasi_lng              REAL,
  radius_meter            INTEGER DEFAULT 100,
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengaturan_tunjangan (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama                TEXT NOT NULL,
  minimal_kehadiran   INTEGER NOT NULL DEFAULT 20,
  nominal             INTEGER NOT NULL DEFAULT 0,
  urutan              INTEGER DEFAULT 0,
  aktif               INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengaturan_shift_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL,
  jam_mulai   TEXT NOT NULL,
  jam_selesai TEXT NOT NULL,
  hari        INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS penugasan_piket (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  shift_id      TEXT REFERENCES pengaturan_shift_piket(id) ON DELETE SET NULL,
  tanggal       TEXT NOT NULL,
  status        TEXT DEFAULT 'terjadwal',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jadwal_guru_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hari        INTEGER NOT NULL,
  jam_mulai   TEXT NOT NULL,
  jam_selesai TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS penugasan_guru_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal     TEXT NOT NULL,
  jam_mulai   TEXT,
  jam_selesai TEXT,
  status      TEXT DEFAULT 'aktif',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Surat Keluar
CREATE TABLE IF NOT EXISTS surat_keluar (
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
CREATE INDEX IF NOT EXISTS idx_surat_tanggal ON surat_keluar(tanggal_surat);
CREATE INDEX IF NOT EXISTS idx_surat_siswa ON surat_keluar(siswa_id);

-- Agenda Guru & Piket
CREATE TABLE IF NOT EXISTS agenda_guru (
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
CREATE INDEX IF NOT EXISTS idx_agenda_penugasan ON agenda_guru(penugasan_id, tanggal);

CREATE TABLE IF NOT EXISTS agenda_piket (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal     TEXT NOT NULL,
  jam_mulai   TEXT,
  jam_selesai TEXT,
  catatan     TEXT,
  foto_url    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Absensi Siswa (harian)
CREATE TABLE IF NOT EXISTS absensi_siswa (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'hadir',
  keterangan      TEXT,
  pencatat_id     TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl ON absensi_siswa(siswa_id, tanggal);

-- Kedisiplinan Config
CREATE TABLE IF NOT EXISTS kedisiplinan_config (
  id                      TEXT PRIMARY KEY DEFAULT '1',
  threshold_perhatian     INTEGER NOT NULL DEFAULT 25,
  threshold_peringatan    INTEGER NOT NULL DEFAULT 50,
  threshold_kritis        INTEGER NOT NULL DEFAULT 75,
  credit_score_awal       INTEGER NOT NULL DEFAULT 100,
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Buku Tamu
CREATE TABLE IF NOT EXISTS buku_tamu (
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

-- Sarpras
CREATE TABLE IF NOT EXISTS sarpras_kategori (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sarpras_aset (
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
CREATE INDEX IF NOT EXISTS idx_sarpras_aset_kategori ON sarpras_aset(kategori_id);

-- Delegasi Tugas
CREATE TABLE IF NOT EXISTS delegasi_tugas (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dari_user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kepada_user_id  TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  keterangan      TEXT,
  status          TEXT DEFAULT 'aktif',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_delegasi_dari_tgl ON delegasi_tugas(dari_user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_delegasi_kepada_tgl ON delegasi_tugas(kepada_user_id, tanggal);

CREATE TABLE IF NOT EXISTS delegasi_tugas_kelas (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  delegasi_id             TEXT NOT NULL REFERENCES delegasi_tugas(id) ON DELETE CASCADE,
  penugasan_mengajar_id   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delegasi_kelas_del ON delegasi_tugas_kelas(delegasi_id);

-- Program Unggulan (PU) — system baru MTs, dipake juga di MAN
CREATE TABLE IF NOT EXISTS pu_kelas_unggulan (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  aktif         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kelas_id, jenis)
);

CREATE TABLE IF NOT EXISTS pu_guru_kelas (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id   TEXT NOT NULL REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pu_materi (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis         TEXT NOT NULL,
  minggu_ke     INTEGER NOT NULL,
  judul         TEXT NOT NULL,
  konten        TEXT,
  meta_json     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pu_materi_mingguan (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis         TEXT NOT NULL,
  minggu_ke     INTEGER NOT NULL,
  tahun_ajaran_id TEXT,
  judul         TEXT,
  konten        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pu_materi_mingguan_kelas (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  materi_mingguan_id  TEXT NOT NULL REFERENCES pu_materi_mingguan(id) ON DELETE CASCADE,
  kelas_id            TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'pending',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pu_hasil_tes (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  minggu_ke     INTEGER,
  nilai         REAL,
  catatan       TEXT,
  tanggal       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pu_jadwal_sampling (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  tanggal       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pu_jadwal_sampling_v3 (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  jenis         TEXT NOT NULL,
  tanggal       TEXT NOT NULL,
  meta_json     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Guru PPL mapping
CREATE TABLE IF NOT EXISTS guru_ppl_mapping (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ppl_user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  guru_user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ppl_user_id, guru_user_id)
);

-- Siswa PPDB
CREATE TABLE IF NOT EXISTS siswa_ppdb (
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

-- Kelas Binaan BK (versi baru)
CREATE TABLE IF NOT EXISTS kelas_binaan_bk_new (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_bk_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guru_bk_id, kelas_id)
);

-- Siswa new (legacy table untuk import staging — kalau dipake)
CREATE TABLE IF NOT EXISTS siswa_new (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nisn            TEXT,
  nama_lengkap    TEXT,
  data_json       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================================
-- BAGIAN 3: SEED DATA — master_roles, pengaturan default, kedisiplinan config
-- =========================================================================

-- Seed master_roles (12 role: 8 existing + 4 baru)
INSERT OR IGNORE INTO master_roles (value, label, is_custom) VALUES
  ('super_admin',      'Super Admin',            0),
  ('admin_tu',         'Admin Tata Usaha',       0),
  ('kepsek',           'Kepala Madrasah',        0),
  ('wakamad',          'Wakil Kepala Madrasah',  0),
  ('guru',             'Guru Mata Pelajaran',    0),
  ('guru_bk',          'Guru BK',                0),
  ('guru_piket',       'Guru Piket',             0),
  ('guru_tahfidz',     'Guru Tahfidz',           0),
  ('wali_kelas',       'Wali Kelas',             0),
  ('resepsionis',      'Resepsionis',            0),
  ('guru_ppl',         'Guru PPL',               0),
  ('satpam',           'Satpam',                 0),
  ('pramubakti',       'Pramubakti',             0),
  ('operator',         'Operator EMIS',          0),
  ('bendahara_komite', 'Bendahara Komite',       0);

-- Seed pengaturan_presensi default (single row)
INSERT OR IGNORE INTO pengaturan_presensi (id, jam_masuk_standar, jam_keluar_standar, toleransi_menit)
VALUES ('1', '07:00', '14:00', 15);

-- Seed kedisiplinan_config default (single row)
INSERT OR IGNORE INTO kedisiplinan_config (id, threshold_perhatian, threshold_peringatan, threshold_kritis, credit_score_awal)
VALUES ('1', 25, 50, 75, 100);

-- Seed master_jabatan_struktural default
INSERT OR IGNORE INTO master_jabatan_struktural (nama, urutan) VALUES
  ('Kepala Madrasah',                   1),
  ('Wakil Kepala Madrasah Kurikulum',   2),
  ('Wakil Kepala Madrasah Kesiswaan',   3),
  ('Wakil Kepala Madrasah Sarpras',     4),
  ('Wakil Kepala Madrasah Humas',       5),
  ('Kepala Tata Usaha',                 6),
  ('Bendahara Komite',                  7),
  ('Operator EMIS',                     8);

-- =========================================================================
-- BAGIAN 4: AUTO-ASSIGN TAHFIDZ — semua kelas tingkat 10 dapat Program Tahfidz
-- =========================================================================
INSERT OR IGNORE INTO pu_kelas_unggulan (kelas_id, jenis, aktif)
SELECT id, 'TAHFIDZ', 1 FROM kelas WHERE tingkat = 10;

-- =========================================================================
-- SELESAI
-- =========================================================================
-- Cek hasil setelah migration:
--   wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) as total FROM master_roles"
--   → harus 15
--   wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) as total FROM pu_kelas_unggulan WHERE jenis='TAHFIDZ'"
--   → harus sama dengan jumlah kelas tingkat 10
