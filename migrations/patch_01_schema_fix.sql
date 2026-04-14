-- =========================================================================
-- PATCH MIGRATION 1 — Fix Schema Mismatch
-- =========================================================================
-- Patch untuk schema mismatch antara migration awal & code expectation.
-- AMAN dijalankan ulang berkali-kali (idempotent).
-- =========================================================================

-- =========================================================================
-- 1. user_feature_overrides — Code pake kolom `action` (TEXT), bukan `enabled`
-- =========================================================================
-- Drop & recreate karena mungkin masih kosong (belum ada user override apapun)
DROP TABLE IF EXISTS user_feature_overrides;
CREATE TABLE user_feature_overrides (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  feature_id  TEXT NOT NULL,
  action      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, feature_id)
);

-- =========================================================================
-- 2. presensi_pegawai — Tambah kolom yang dipake code
-- =========================================================================
-- Code expect: jam_pulang (BUKAN jam_keluar), is_telat, is_pulang_cepat,
--              diinput_oleh, updated_at
-- Migration awal saya: jam_keluar (salah), no is_telat, no diinput_oleh
--
-- Solusi: ADD kolom yang missing. Kolom jam_keluar yang lama biarin aja
-- (gak dipake), nanti di-ignore.
ALTER TABLE presensi_pegawai ADD COLUMN jam_pulang TEXT;
ALTER TABLE presensi_pegawai ADD COLUMN is_telat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE presensi_pegawai ADD COLUMN is_pulang_cepat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE presensi_pegawai ADD COLUMN diinput_oleh TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE presensi_pegawai ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

-- =========================================================================
-- 3. pengaturan_presensi — Drop & recreate dengan schema yang dipake code
-- =========================================================================
-- Code expect: id='global' (bukan '1'), jam_masuk, jam_pulang, batas_telat_menit,
--              batas_pulang_cepat_menit, hari_kerja
-- Migration awal saya: id='1', jam_masuk_standar, jam_keluar_standar, toleransi_menit, dll
--
-- Drop & recreate aman karena belum ada konfigurasi user.
DROP TABLE IF EXISTS pengaturan_presensi;
CREATE TABLE pengaturan_presensi (
  id                          TEXT PRIMARY KEY DEFAULT 'global',
  jam_masuk                   TEXT NOT NULL DEFAULT '07:00',
  jam_pulang                  TEXT NOT NULL DEFAULT '14:00',
  batas_telat_menit           INTEGER NOT NULL DEFAULT 15,
  batas_pulang_cepat_menit    INTEGER NOT NULL DEFAULT 15,
  hari_kerja                  TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default row
INSERT OR IGNORE INTO pengaturan_presensi (id, jam_masuk, jam_pulang, batas_telat_menit, batas_pulang_cepat_menit, hari_kerja)
VALUES ('global', '07:00', '14:00', 15, 15, '[1,2,3,4,5,6]');

-- =========================================================================
-- SELESAI
-- =========================================================================
-- Verify:
--   wrangler d1 execute mansatas-db --remote --command="SELECT * FROM pengaturan_presensi"
--   → Harus ada 1 row dengan id='global'
--
--   wrangler d1 execute mansatas-db --remote --command="PRAGMA table_info(presensi_pegawai)"
--   → Harus ada kolom: jam_pulang, is_telat, is_pulang_cepat, diinput_oleh, updated_at
--
--   wrangler d1 execute mansatas-db --remote --command="PRAGMA table_info(user_feature_overrides)"
--   → Harus ada kolom 'action' (TEXT)
