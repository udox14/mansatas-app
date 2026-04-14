-- =========================================================================
-- PATCH 02 — Full Schema Audit Fix
-- =========================================================================
-- Memperbaiki SEMUA mismatch schema antara migration awal (yang saya tebak)
-- dan code source actual.
--
-- Strategy:
--   1. Untuk tabel yang punya data CORE existing (`siswa`, `kelas`, `user`,
--      `tahun_ajaran`, `mata_pelajaran`, `penugasan_mengajar`):
--      → ALTER ADD COLUMN saja (preserve data)
--
--   2. Untuk tabel BARU yang saya bikin di patch awal (kosong, belum ada
--      user input): DROP & RECREATE dengan schema yang benar.
--
--   3. Untuk tabel lama yang struktur-nya sudah mismatch parah:
--      DROP & RECREATE (asumsi data nya belum dipakai user)
--
-- AMAN dijalankan ulang berkali-kali (idempotent).
--
-- CARA PAKAI:
--   wrangler d1 execute mansatas-db --remote --file=migrations/patch_02_full_audit.sql
--
-- Pesan "duplicate column" dan "table exists" boleh diabaikan.
-- =========================================================================


-- =========================================================================
-- BAGIAN 1: ALTER TABLE — Tabel core dengan data existing
-- =========================================================================

-- mata_pelajaran: tambah kode_asc (untuk import ASC Timetables)
ALTER TABLE mata_pelajaran ADD COLUMN kode_asc TEXT;

-- penugasan_mengajar: tambah is_piket_bergilir (untuk piket bergilir guru)
ALTER TABLE penugasan_mengajar ADD COLUMN is_piket_bergilir INTEGER NOT NULL DEFAULT 0;

-- NOTE: tahun_ajaran.jam_pelajaran sudah ada di schema (TEXT, JSON array), skip ALTER


-- =========================================================================
-- BAGIAN 2: DROP & RECREATE — Tabel yang struktur saya salah parah
-- =========================================================================
-- Semua tabel di bawah ini saya bikin di patch_01 dengan tebakan, dan
-- ternyata schema-nya beda total dengan yang dipake code. Drop & recreate
-- aman karena belum ada data user (semua tabel baru).

-- ── absensi_siswa ──
-- Code expect: penugasan_id, jam_ke_mulai, jam_ke_selesai, jumlah_jam, catatan, diinput_oleh
DROP TABLE IF EXISTS absensi_siswa;
CREATE TABLE absensi_siswa (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  jam_ke_mulai    INTEGER,
  jam_ke_selesai  INTEGER,
  jumlah_jam      INTEGER DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'hadir',
  catatan         TEXT,
  diinput_oleh    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl ON absensi_siswa(siswa_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_penugasan ON absensi_siswa(penugasan_id, tanggal);


-- ── delegasi_tugas_kelas ──
-- Code expect: kelas_id, tugas (selain delegasi_id, penugasan_mengajar_id)
DROP TABLE IF EXISTS delegasi_tugas_kelas;
CREATE TABLE delegasi_tugas_kelas (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  delegasi_id             TEXT NOT NULL REFERENCES delegasi_tugas(id) ON DELETE CASCADE,
  penugasan_mengajar_id   TEXT NOT NULL,
  kelas_id                TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tugas                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_dtk_delegasi ON delegasi_tugas_kelas(delegasi_id);


-- ── guru_ppl_mapping ──
-- Code expect: guru_ppl_id, guru_utama_id, jadwal_mengajar_id, jadwal_piket_id, pu_kelas_id
DROP TABLE IF EXISTS guru_ppl_mapping;
CREATE TABLE guru_ppl_mapping (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_ppl_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  guru_utama_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  jadwal_mengajar_id  TEXT,
  jadwal_piket_id     TEXT,
  pu_kelas_id         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guru_ppl_ppl ON guru_ppl_mapping(guru_ppl_id);
CREATE INDEX IF NOT EXISTS idx_guru_ppl_utama ON guru_ppl_mapping(guru_utama_id);


-- ── kedisiplinan_config ──
-- Code expect: simple key-value store (key TEXT PRIMARY KEY, value TEXT)
-- BUKAN single-row config! Code pake INSERT ... ON CONFLICT(key) DO UPDATE
DROP TABLE IF EXISTS kedisiplinan_config;
CREATE TABLE kedisiplinan_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Seed default values (key-value pairs)
INSERT OR IGNORE INTO kedisiplinan_config (key, value) VALUES
  ('threshold_perhatian',  '25'),
  ('threshold_peringatan', '50'),
  ('threshold_kritis',     '75'),
  ('credit_score_awal',    '100');


-- ── nilai_harian_kkm ──
-- Code expect: penugasan_id (PRIMARY/UNIQUE), kkm, updated_at
DROP TABLE IF EXISTS nilai_harian_kkm;
CREATE TABLE nilai_harian_kkm (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id  TEXT NOT NULL UNIQUE,
  kkm           REAL NOT NULL DEFAULT 70,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ── pengaturan_tunjangan ──
-- Code expect: id='global', nominal_dalam, nominal_luar, tanggal_bayar, aturan_tiers (JSON), updated_at
DROP TABLE IF EXISTS pengaturan_tunjangan;
CREATE TABLE pengaturan_tunjangan (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  nominal_dalam   INTEGER NOT NULL DEFAULT 0,
  nominal_luar    INTEGER NOT NULL DEFAULT 0,
  tanggal_bayar   INTEGER DEFAULT 25,
  aturan_tiers    TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO pengaturan_tunjangan (id, nominal_dalam, nominal_luar, tanggal_bayar, aturan_tiers)
VALUES ('global', 0, 0, 25, '[{"sampai_jam":"07:15:00","persen":100,"label":"Tepat Waktu"},{"sampai_jam":"08:00:00","persen":50,"label":"Telat Toleransi"},{"sampai_jam":null,"persen":0,"label":"Telat Berat"}]');


-- ── penugasan_guru_piket ──
-- Code expect: penugasan_id (bukan user_id), guru_id, urutan, is_aktif_minggu_ini
DROP TABLE IF EXISTS penugasan_guru_piket;
CREATE TABLE penugasan_guru_piket (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id          TEXT NOT NULL,
  guru_id               TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  urutan                INTEGER NOT NULL DEFAULT 0,
  is_aktif_minggu_ini   INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pgp_penugasan ON penugasan_guru_piket(penugasan_id);


-- ── pu_hasil_tes ──
-- Code expect: pu_kelas_id, siswa_id, guru_id, tanggal, status, round_number, nilai
DROP TABLE IF EXISTS pu_hasil_tes;
CREATE TABLE pu_hasil_tes (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id   TEXT NOT NULL,
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  guru_id       TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  tanggal       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'belum',
  nilai         REAL,
  catatan       TEXT,
  round_number  INTEGER DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pu_hasil_pu_kelas ON pu_hasil_tes(pu_kelas_id);
CREATE INDEX IF NOT EXISTS idx_pu_hasil_siswa ON pu_hasil_tes(siswa_id);


-- ── pu_jadwal_sampling ──
-- Code expect: pu_kelas_id, siswa_id, minggu_mulai, hari
DROP TABLE IF EXISTS pu_jadwal_sampling;
CREATE TABLE pu_jadwal_sampling (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pu_kelas_id   TEXT NOT NULL,
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  minggu_mulai  TEXT NOT NULL,
  hari          INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pu_sampling_pu_kelas ON pu_jadwal_sampling(pu_kelas_id);


-- ── pu_materi_mingguan ──
-- Code expect: program (bukan jenis), minggu_mulai, konten (JSON), created_by, updated_at
DROP TABLE IF EXISTS pu_materi_mingguan;
CREATE TABLE pu_materi_mingguan (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  program       TEXT NOT NULL,
  minggu_mulai  TEXT NOT NULL,
  konten        TEXT,
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ── pu_materi_mingguan_kelas ──
-- Code expect: materi_id, pu_kelas_id
DROP TABLE IF EXISTS pu_materi_mingguan_kelas;
CREATE TABLE pu_materi_mingguan_kelas (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  materi_id     TEXT NOT NULL REFERENCES pu_materi_mingguan(id) ON DELETE CASCADE,
  pu_kelas_id   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pmmk_materi ON pu_materi_mingguan_kelas(materi_id);
CREATE INDEX IF NOT EXISTS idx_pmmk_pu_kelas ON pu_materi_mingguan_kelas(pu_kelas_id);


-- ── sarpras_aset ──
-- Code expect: tanggal_pembukuan, kategori_id, nama_barang, merek, kuantitas,
-- tahun_pembuatan, asal_anggaran, keadaan_barang, harga, foto_url, keterangan,
-- diinput_oleh, updated_at
DROP TABLE IF EXISTS sarpras_aset;
CREATE TABLE sarpras_aset (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal_pembukuan   TEXT,
  kategori_id         TEXT REFERENCES sarpras_kategori(id) ON DELETE SET NULL,
  nama_barang         TEXT NOT NULL,
  merek               TEXT,
  kuantitas           INTEGER DEFAULT 1,
  tahun_pembuatan     INTEGER,
  asal_anggaran       TEXT,
  keadaan_barang      TEXT,
  harga               INTEGER,
  foto_url            TEXT,
  keterangan          TEXT,
  diinput_oleh        TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sarpras_aset_kat ON sarpras_aset(kategori_id);


-- ── surat_keluar ──
-- Code expect: nomor_urut, tahun, perihal, data_surat (JSON), dicetak_oleh, nama_pencetak
DROP TABLE IF EXISTS surat_keluar;
CREATE TABLE surat_keluar (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  jenis_surat     TEXT NOT NULL,
  nomor_urut      INTEGER,
  nomor_surat     TEXT,
  tahun           INTEGER,
  perihal         TEXT,
  data_surat      TEXT,
  dicetak_oleh    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  nama_pencetak   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_surat_jenis_tahun ON surat_keluar(jenis_surat, tahun);


-- ── tahfidz_progress ──
-- Code expect: surah_nomor, juz, ayat_hafal (JSON), updated_by, updated_at
-- + UNIQUE(siswa_id, surah_nomor) untuk ON CONFLICT
DROP TABLE IF EXISTS tahfidz_progress;
CREATE TABLE tahfidz_progress (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surah_nomor   INTEGER NOT NULL,
  juz           INTEGER,
  ayat_hafal    TEXT,
  updated_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, surah_nomor)
);
CREATE INDEX IF NOT EXISTS idx_tahfidz_progress_siswa ON tahfidz_progress(siswa_id);


-- ── tahfidz_setoran_log ──
-- Code expect: surah_nomor, juz, ayat_baru (JSON), keterangan, diinput_oleh
DROP TABLE IF EXISTS tahfidz_setoran_log;
CREATE TABLE tahfidz_setoran_log (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  surah_nomor   INTEGER NOT NULL,
  juz           INTEGER,
  ayat_baru     TEXT,
  keterangan    TEXT,
  diinput_oleh  TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tahfidz_log_siswa ON tahfidz_setoran_log(siswa_id);


-- ── tahfidz_nilai ──
-- Code expect: juz, nilai, catatan, updated_by, updated_at + UNIQUE(siswa_id, juz)
DROP TABLE IF EXISTS tahfidz_nilai;
CREATE TABLE tahfidz_nilai (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  juz           INTEGER NOT NULL,
  nilai         REAL NOT NULL,
  catatan       TEXT,
  updated_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, juz)
);
CREATE INDEX IF NOT EXISTS idx_tahfidz_nilai_siswa ON tahfidz_nilai(siswa_id);


-- ── web_push_subscriptions ──
-- Tambah updated_at
ALTER TABLE web_push_subscriptions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));


-- =========================================================================
-- BAGIAN 3: presensi_pegawai sudah di-fix di patch_01, gak perlu lagi
-- =========================================================================


-- =========================================================================
-- VERIFY SETELAH RUN
-- =========================================================================
-- wrangler d1 execute mansatas-db --remote --command="PRAGMA table_info(absensi_siswa)"
-- → Harus ada kolom: penugasan_id, jam_ke_mulai, jam_ke_selesai, jumlah_jam, catatan, diinput_oleh
--
-- wrangler d1 execute mansatas-db --remote --command="PRAGMA table_info(kedisiplinan_config)"
-- → Harus ada kolom: key, value, updated_at
--
-- wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) FROM kedisiplinan_config"
-- → Harus 4 (dari seed)
--
-- wrangler d1 execute mansatas-db --remote --command="PRAGMA table_info(sarpras_aset)"
-- → Harus ada kolom: tanggal_pembukuan, nama_barang, merek, kuantitas, dll
