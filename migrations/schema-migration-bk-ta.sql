-- ============================================================
-- MIGRATION: BK - Tambah tahun_ajaran_id ke kelas_binaan_bk
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=schema-migration-bk-ta.sql
-- ============================================================

-- 1. Buat tabel baru dengan tahun_ajaran_id
CREATE TABLE IF NOT EXISTS kelas_binaan_bk_new (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_bk_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kelas_id        TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guru_bk_id, kelas_id, tahun_ajaran_id)
);

-- 2. Migrate data lama — assign ke TA yang aktif saat ini
INSERT OR IGNORE INTO kelas_binaan_bk_new (id, guru_bk_id, kelas_id, tahun_ajaran_id, created_at)
SELECT
  kb.id,
  kb.guru_bk_id,
  kb.kelas_id,
  (SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1),
  kb.created_at
FROM kelas_binaan_bk kb
WHERE (SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1) IS NOT NULL;

-- 3. Drop tabel lama, rename baru
DROP TABLE kelas_binaan_bk;
ALTER TABLE kelas_binaan_bk_new RENAME TO kelas_binaan_bk;

-- 4. Re-create indexes
CREATE INDEX IF NOT EXISTS idx_kelas_binaan_guru  ON kelas_binaan_bk(guru_bk_id, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_kelas_binaan_kelas ON kelas_binaan_bk(kelas_id, tahun_ajaran_id);
