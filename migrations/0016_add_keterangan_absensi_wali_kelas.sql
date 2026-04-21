-- Migration: Keterangan Absensi oleh Wali Kelas
-- Wali kelas bisa menandai siswa SAKIT atau IZIN sebelum guru mengabsen,
-- sehingga guru melihat status otomatis dengan catatan dari wali kelas.

CREATE TABLE IF NOT EXISTS keterangan_absensi_wali_kelas (
  id           TEXT PRIMARY KEY,
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal      TEXT NOT NULL, -- YYYY-MM-DD
  status       TEXT NOT NULL CHECK(status IN ('SAKIT', 'IZIN')),
  keterangan   TEXT,
  dibuat_oleh  TEXT NOT NULL REFERENCES user(id),
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_keterangan_wali_tanggal
  ON keterangan_absensi_wali_kelas(tanggal);

CREATE INDEX IF NOT EXISTS idx_keterangan_wali_siswa
  ON keterangan_absensi_wali_kelas(siswa_id, tanggal);

-- Tambah feature ke role_features untuk wali_kelas
INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES ('wali_kelas', 'keterangan-absensi');
