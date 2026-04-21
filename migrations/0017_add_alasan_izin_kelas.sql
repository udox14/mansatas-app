-- Migration: Tabel alasan izin tidak masuk kelas (configurable by super admin)

CREATE TABLE IF NOT EXISTS alasan_izin_kelas (
  id      TEXT PRIMARY KEY,
  alasan  TEXT NOT NULL UNIQUE,
  urutan  INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed data dari alasan yang sebelumnya hardcoded
INSERT OR IGNORE INTO alasan_izin_kelas (id, alasan, urutan) VALUES
  (lower(hex(randomblob(16))), 'KELUAR KOMPLEK BERSAMA ORANG TUA', 1),
  (lower(hex(randomblob(16))), 'SAKIT DI UKS',                    2),
  (lower(hex(randomblob(16))), 'SAKIT (PULANG)',                   3),
  (lower(hex(randomblob(16))), 'BIMBINGAN LOMBA',                  4),
  (lower(hex(randomblob(16))), 'KEGIATAN DI DALAM',                5),
  (lower(hex(randomblob(16))), 'KEGIATAN DI LUAR',                 6);
