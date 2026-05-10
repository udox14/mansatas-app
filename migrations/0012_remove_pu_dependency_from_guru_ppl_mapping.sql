-- ============================================================
-- MIGRATION: Remove Program Unggulan dependency from guru_ppl_mapping
-- Dipakai jika sekolah tidak menggunakan modul Program Unggulan.
-- Aman: mempertahankan seluruh mapping PPL yang sudah ada.
-- Jalankan: wrangler d1 execute mansatas-db --remote --file=migrations/0012_remove_pu_dependency_from_guru_ppl_mapping.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS guru_ppl_mapping_new (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    guru_ppl_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    guru_utama_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    jadwal_mengajar_id TEXT REFERENCES jadwal_mengajar(id) ON DELETE CASCADE,
    jadwal_piket_id TEXT REFERENCES jadwal_guru_piket(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO guru_ppl_mapping_new (
    id, guru_ppl_id, guru_utama_id, jadwal_mengajar_id, jadwal_piket_id, created_at
)
SELECT
    id, guru_ppl_id, guru_utama_id, jadwal_mengajar_id, jadwal_piket_id, created_at
FROM guru_ppl_mapping;

DROP TABLE guru_ppl_mapping;
ALTER TABLE guru_ppl_mapping_new RENAME TO guru_ppl_mapping;

CREATE INDEX IF NOT EXISTS idx_guru_ppl_mapping_ppl ON guru_ppl_mapping(guru_ppl_id);
CREATE INDEX IF NOT EXISTS idx_guru_ppl_mapping_utama ON guru_ppl_mapping(guru_utama_id);
