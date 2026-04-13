-- ============================================================
-- MIGRATION: Guru PPL Mapping
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=migrations/0011_add_guru_ppl_mapping.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS guru_ppl_mapping (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    guru_ppl_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    guru_utama_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    jadwal_mengajar_id TEXT REFERENCES jadwal_mengajar(id) ON DELETE CASCADE,
    jadwal_piket_id TEXT REFERENCES jadwal_guru_piket(id) ON DELETE CASCADE,
    pu_kelas_id TEXT REFERENCES pu_kelas_unggulan(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guru_ppl_mapping_ppl ON guru_ppl_mapping(guru_ppl_id);
CREATE INDEX IF NOT EXISTS idx_guru_ppl_mapping_utama ON guru_ppl_mapping(guru_utama_id);
