-- Snapshot lengkap absensi siswa per sesi mengajar.
-- Berbeda dari absensi_siswa yang sparse, tabel ini menyimpan HADIR juga agar
-- rekap asli guru tetap utuh walaupun keanggotaan kelas berubah di kemudian hari.

CREATE TABLE IF NOT EXISTS absensi_sesi_siswa (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  siswa_id        TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,
  jam_ke_mulai    INTEGER NOT NULL,
  jam_ke_selesai  INTEGER NOT NULL,
  jumlah_jam      INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL CHECK(status IN ('HADIR','SAKIT','ALFA','IZIN')),
  catatan         TEXT,
  diinput_oleh    TEXT NOT NULL REFERENCES "user"(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, siswa_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_absensi_sesi_siswa_penugasan_tgl
  ON absensi_sesi_siswa(penugasan_id, tanggal);
