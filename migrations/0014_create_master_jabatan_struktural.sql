-- Migration: Create master_jabatan_struktural table
-- Tabel ini direferensikan oleh kolom jabatan_struktural_id di tabel user,
-- tapi belum pernah dibuat di remote database.

CREATE TABLE IF NOT EXISTS master_jabatan_struktural (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  urutan      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed jabatan struktural default
INSERT OR IGNORE INTO master_jabatan_struktural (id, nama, urutan) VALUES
  ('jbt_kepsek',   'Kepala Madrasah',       1),
  ('jbt_wakamad',  'Wakil Kepala Madrasah',  2),
  ('jbt_ktu',      'Kepala TU',              3),
  ('jbt_staff_tu', 'Staff TU',               4),
  ('jbt_bendahara','Bendahara',              5),
  ('jbt_guru',     'Guru',                   6),
  ('jbt_operator', 'Operator',               7);
