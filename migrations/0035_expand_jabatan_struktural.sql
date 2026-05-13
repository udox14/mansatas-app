-- Expand centralized structural-position master data for Guru & Pegawai.
-- The user column may already exist from schema-migration-presensi.sql; keep this idempotent for fresh databases.

CREATE TABLE IF NOT EXISTS master_jabatan_struktural (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  urutan      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO master_jabatan_struktural (id, nama, urutan) VALUES
  ('jbt_kepsek', 'Kepala Madrasah', 1),
  ('jbt_waka_kurikulum', 'Wakamad Bidang Kurikulum', 2),
  ('jbt_waka_kesiswaan', 'Wakamad Bidang Kesiswaan', 3),
  ('jbt_waka_sarpras', 'Wakamad Bidang Sarana Prasarana', 4),
  ('jbt_waka_humas', 'Wakamad Bidang Humas', 5),
  ('jbt_ktu', 'Kepala TU', 6),
  ('jbt_bendahara', 'Bendahara', 7),
  ('jbt_operator', 'Operator', 8),
  ('jbt_staff_tu', 'Staff TU', 9),
  ('jbt_wali_kelas', 'Wali Kelas', 10),
  ('jbt_guru_bk', 'Guru BK', 11),
  ('jbt_guru', 'Guru', 12);
