-- ============================================================
-- MIGRATION: Presensi & Tunjangan Pegawai
-- Jalankan di D1 console / wrangler d1 execute
-- ============================================================

-- 1. Master Jabatan Struktural (dinamis, admin bisa CRUD)
CREATE TABLE IF NOT EXISTS master_jabatan_struktural (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama        TEXT NOT NULL UNIQUE,
  urutan      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default jabatan
INSERT OR IGNORE INTO master_jabatan_struktural (id, nama, urutan) VALUES
  ('jbt_kepsek', 'Kepala Madrasah', 1),
  ('jbt_wakamad', 'Wakil Kepala Madrasah', 2),
  ('jbt_ktu', 'Kepala TU', 3),
  ('jbt_staff_tu', 'Staff TU', 4);

-- 2. Tambah kolom di tabel user
--    jabatan_struktural_id → FK ke master_jabatan_struktural
--    domisili_pegawai → 'dalam' atau 'luar' (untuk hitung tunjangan)
ALTER TABLE "user" ADD COLUMN jabatan_struktural_id TEXT REFERENCES master_jabatan_struktural(id) ON DELETE SET NULL;
ALTER TABLE "user" ADD COLUMN domisili_pegawai TEXT CHECK(domisili_pegawai IN ('dalam', 'luar'));

-- 3. Pengaturan Presensi (singleton)
CREATE TABLE IF NOT EXISTS pengaturan_presensi (
  id                        TEXT PRIMARY KEY DEFAULT 'global',
  jam_masuk                 TEXT NOT NULL DEFAULT '07:00',
  jam_pulang                TEXT NOT NULL DEFAULT '14:00',
  batas_telat_menit         INTEGER NOT NULL DEFAULT 15,
  batas_pulang_cepat_menit  INTEGER NOT NULL DEFAULT 15,
  hari_kerja                TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO pengaturan_presensi (id) VALUES ('global');

-- 4. Pengaturan Tunjangan (singleton)
--    aturan_tiers: JSON array of {min_persen, max_persen, persen_tunjangan}
--    Contoh: [{"min":90,"max":100,"persen":100},{"min":75,"max":89,"persen":75}]
CREATE TABLE IF NOT EXISTS pengaturan_tunjangan (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  nominal_dalam   INTEGER NOT NULL DEFAULT 0,
  nominal_luar    INTEGER NOT NULL DEFAULT 0,
  tanggal_bayar   INTEGER NOT NULL DEFAULT 25,
  aturan_tiers    TEXT NOT NULL DEFAULT '[{"min":90,"max":100,"persen":100},{"min":75,"max":89,"persen":75},{"min":50,"max":74,"persen":50},{"min":0,"max":49,"persen":0}]',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO pengaturan_tunjangan (id) VALUES ('global');

-- 5. Presensi Pegawai (record harian)
CREATE TABLE IF NOT EXISTS presensi_pegawai (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tanggal           TEXT NOT NULL,
  jam_masuk         TEXT,
  jam_pulang        TEXT,
  status            TEXT NOT NULL DEFAULT 'hadir'
                    CHECK(status IN ('hadir','sakit','izin','alfa','dinas_luar')),
  is_telat          INTEGER NOT NULL DEFAULT 0,
  is_pulang_cepat   INTEGER NOT NULL DEFAULT 0,
  catatan           TEXT,
  diinput_oleh      TEXT NOT NULL REFERENCES "user"(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tanggal)
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_presensi_user_tanggal ON presensi_pegawai(user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_tanggal ON presensi_pegawai(tanggal);
CREATE INDEX IF NOT EXISTS idx_user_jabatan ON "user"(jabatan_struktural_id);
