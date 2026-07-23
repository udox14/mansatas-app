-- Catatan internal siswa oleh guru mata pelajaran.

CREATE TABLE IF NOT EXISTS catatan_siswa (
  id                    TEXT PRIMARY KEY,
  siswa_id              TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  pencatat_id           TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  penugasan_id          TEXT REFERENCES penugasan_mengajar(id) ON DELETE SET NULL,
  tahun_ajaran_id       TEXT REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
  kelas_id_saat_dibuat  TEXT REFERENCES kelas(id) ON DELETE SET NULL,
  mapel_id_saat_dibuat  TEXT REFERENCES mata_pelajaran(id) ON DELETE SET NULL,
  pencatat_nama_snapshot TEXT NOT NULL,
  kelas_nama_snapshot   TEXT NOT NULL,
  mapel_nama_snapshot   TEXT NOT NULL,
  tahun_ajaran_snapshot TEXT NOT NULL,
  isi                   TEXT NOT NULL CHECK(length(trim(isi)) BETWEEN 1 AND 5000),
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);

CREATE INDEX IF NOT EXISTS idx_catatan_siswa_siswa_created
  ON catatan_siswa(siswa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catatan_siswa_pencatat_created
  ON catatan_siswa(pencatat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catatan_siswa_kelas_created
  ON catatan_siswa(kelas_id_saat_dibuat, created_at DESC);

CREATE TABLE IF NOT EXISTS catatan_siswa_read_state (
  user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kelas_id     TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  last_read_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  PRIMARY KEY (user_id, kelas_id)
);

CREATE INDEX IF NOT EXISTS idx_catatan_siswa_read_state_kelas
  ON catatan_siswa_read_state(kelas_id, user_id);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'catatan-siswa'),
  ('admin_tu', 'catatan-siswa'),
  ('kepsek', 'catatan-siswa'),
  ('wakamad', 'catatan-siswa'),
  ('guru', 'catatan-siswa'),
  ('wali_kelas', 'catatan-siswa'),
  ('guru_bk', 'catatan-siswa'),
  ('guru_ppl', 'catatan-siswa');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('super_admin', 'catatan-siswa', 0, 1, 0, 0),
  ('admin_tu', 'catatan-siswa', 0, 1, 0, 0),
  ('kepsek', 'catatan-siswa', 0, 1, 0, 0),
  ('wakamad', 'catatan-siswa', 0, 1, 0, 0),
  ('guru', 'catatan-siswa', 1, 1, 1, 1),
  ('wali_kelas', 'catatan-siswa', 1, 1, 1, 1),
  ('guru_bk', 'catatan-siswa', 0, 1, 0, 0),
  ('guru_ppl', 'catatan-siswa', 1, 1, 1, 1);
