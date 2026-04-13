-- ============================================================
-- MIGRATION: Absensi Siswa v2 (Sparse Storage)
-- Hanya menyimpan siswa yang TIDAK hadir (SAKIT/ALFA/IZIN)
-- Siswa yang tidak tercatat = HADIR
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-absensi-v2.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS absensi_siswa (
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

CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl     ON absensi_siswa(tanggal, status);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_id_tgl  ON absensi_siswa(siswa_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_penugasan_tgl ON absensi_siswa(penugasan_id, tanggal);
