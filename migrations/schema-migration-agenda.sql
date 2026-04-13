-- ============================================================
-- MIGRATION: Agenda Guru (Kehadiran & Jurnal Mengajar Guru)
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-agenda.sql
-- ============================================================

-- Tabel utama agenda guru
-- Satu record = satu blok mengajar (penugasan) pada satu tanggal
-- ALFA tidak disimpan secara eksplisit — dihitung dari ketiadaan record
-- Admin bisa membuat record manual dengan status SAKIT/IZIN untuk override ALFA
CREATE TABLE IF NOT EXISTS agenda_guru (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  penugasan_id    TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tanggal         TEXT NOT NULL,                                          -- format: YYYY-MM-DD
  jam_ke_mulai    INTEGER NOT NULL,                                       -- jam ke awal blok
  jam_ke_selesai  INTEGER NOT NULL,                                       -- jam ke akhir blok
  materi          TEXT,                                                    -- isian bebas guru
  foto_url        TEXT,                                                    -- URL foto di R2
  status          TEXT NOT NULL DEFAULT 'TEPAT_WAKTU'
                  CHECK(status IN ('TEPAT_WAKTU','TELAT','ALFA','SAKIT','IZIN')),
  waktu_input     TEXT,                                                    -- datetime saat guru submit
  catatan_admin   TEXT,                                                    -- catatan jika admin edit
  diubah_oleh     TEXT REFERENCES "user"(id) ON DELETE SET NULL,          -- user terakhir yg edit
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, tanggal)
);

-- Indexes untuk query monitoring & rekap
CREATE INDEX IF NOT EXISTS idx_agenda_guru_tanggal   ON agenda_guru(guru_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_agenda_tanggal_status ON agenda_guru(tanggal, status);
CREATE INDEX IF NOT EXISTS idx_agenda_penugasan_tgl  ON agenda_guru(penugasan_id, tanggal);
