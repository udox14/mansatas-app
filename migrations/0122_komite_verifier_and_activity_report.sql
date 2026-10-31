-- Additive verifier workflow. Historical reviews are retained.
ALTER TABLE komite_pengajuan ADD COLUMN workflow_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE komite_pengajuan ADD COLUMN chairman_id_snapshot TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN chairman_name_snapshot TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_at TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_name TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN laporan_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE komite_pengajuan_reviews ADD COLUMN workflow_version INTEGER NOT NULL DEFAULT 1;
DROP INDEX IF EXISTS uq_komite_review_stage_version;
CREATE UNIQUE INDEX IF NOT EXISTS uq_komite_review_stage_flow ON komite_pengajuan_reviews(pengajuan_id,version_number,stage,workflow_version);
-- Runtime initialization atomically audits and transitions pending proposals.
