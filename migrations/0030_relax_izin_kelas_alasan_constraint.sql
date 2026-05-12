-- Migration: Izinkan alasan izin kelas mengikuti tabel alasan_izin_kelas
-- SQLite/D1 tidak bisa menghapus CHECK constraint langsung, jadi tabel dibuat ulang.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS izin_tidak_masuk_kelas_new (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id       TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal        TEXT NOT NULL DEFAULT (date('now')),
  jam_pelajaran  TEXT,
  alasan         TEXT NOT NULL,
  keterangan     TEXT,
  diinput_oleh   TEXT REFERENCES "user"(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO izin_tidak_masuk_kelas_new (
  id, siswa_id, tanggal, jam_pelajaran, alasan, keterangan, diinput_oleh, created_at, updated_at
)
SELECT
  id, siswa_id, tanggal, jam_pelajaran, alasan, keterangan, diinput_oleh, created_at, updated_at
FROM izin_tidak_masuk_kelas;

DROP TABLE izin_tidak_masuk_kelas;

ALTER TABLE izin_tidak_masuk_kelas_new RENAME TO izin_tidak_masuk_kelas;

CREATE INDEX IF NOT EXISTS idx_izin_tidak_masuk_kelas_tanggal
  ON izin_tidak_masuk_kelas(tanggal);

CREATE INDEX IF NOT EXISTS idx_izin_tidak_masuk_kelas_siswa_tanggal
  ON izin_tidak_masuk_kelas(siswa_id, tanggal);

PRAGMA foreign_keys = ON;
