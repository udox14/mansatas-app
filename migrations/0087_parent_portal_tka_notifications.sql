ALTER TABLE parent_notifications ADD COLUMN archived_at TEXT;

CREATE TABLE IF NOT EXISTS parent_tka_approvals (
  id TEXT PRIMARY KEY,
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  selection_fingerprint TEXT NOT NULL,
  selection_snapshot TEXT NOT NULL,
  statement_version TEXT NOT NULL,
  approved_by_parent_identifier TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(siswa_id, tahun_ajaran_id, selection_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_parent_tka_approvals_lookup
  ON parent_tka_approvals(siswa_id, tahun_ajaran_id, approved_at DESC);

UPDATE parent_notifications
SET message = trim(replace(replace(
  message,
  'Mohon konfirmasi kepada wali kelas atau pihak madrasah.',
  ''
), 'Mohon konfirmasi kepada wali kelas.', ''))
WHERE type = 'absensi';

UPDATE notification_event_settings
SET body_template = trim(replace(replace(
  body_template,
  'Mohon konfirmasi kepada wali kelas atau pihak madrasah.',
  ''
), 'Mohon konfirmasi kepada wali kelas.', ''))
WHERE event_key = 'attendance_parent_alert';
