-- Wali kelas dapat menentukan status harian ALFA saat absensi guru campur
-- (misalnya ada kombinasi ALFA, SAKIT, dan IZIN dalam satu hari).

PRAGMA foreign_keys = off;

CREATE TABLE IF NOT EXISTS keterangan_absensi_wali_kelas_new (
  id           TEXT PRIMARY KEY,
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal      TEXT NOT NULL,
  status       TEXT NOT NULL CHECK(status IN ('SAKIT', 'IZIN', 'ALFA')),
  keterangan   TEXT,
  dibuat_oleh  TEXT NOT NULL REFERENCES user(id),
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tanggal)
);

INSERT OR IGNORE INTO keterangan_absensi_wali_kelas_new
  (id, siswa_id, tanggal, status, keterangan, dibuat_oleh, created_at, updated_at)
SELECT id, siswa_id, tanggal, status, keterangan, dibuat_oleh, created_at, updated_at
FROM keterangan_absensi_wali_kelas;

DROP TABLE keterangan_absensi_wali_kelas;
ALTER TABLE keterangan_absensi_wali_kelas_new RENAME TO keterangan_absensi_wali_kelas;

CREATE INDEX IF NOT EXISTS idx_keterangan_wali_tanggal
  ON keterangan_absensi_wali_kelas(tanggal);

CREATE INDEX IF NOT EXISTS idx_keterangan_wali_siswa
  ON keterangan_absensi_wali_kelas(siswa_id, tanggal);

PRAGMA foreign_keys = on;
