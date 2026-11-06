ALTER TABLE keterangan_absensi_wali_kelas ADD COLUMN policy_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE keterangan_absensi_wali_kelas ADD COLUMN approval_id TEXT;

CREATE TABLE attendance_correction_requests (
  id TEXT PRIMARY KEY,
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id TEXT NOT NULL REFERENCES kelas(id),
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id),
  tanggal TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  requested_status TEXT NOT NULL CHECK (requested_status IN ('HADIR', 'SAKIT', 'IZIN')),
  reason TEXT NOT NULL,
  alfa_key TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'STALE')),
  requested_by TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by TEXT,
  reviewed_by_name TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  decision_id TEXT UNIQUE
);

CREATE UNIQUE INDEX attendance_correction_one_pending
  ON attendance_correction_requests(siswa_id, tanggal) WHERE status = 'PENDING';
CREATE INDEX attendance_correction_inbox
  ON attendance_correction_requests(status, requested_at, id);
CREATE INDEX attendance_correction_student_history
  ON attendance_correction_requests(siswa_id, tanggal, requested_at);

INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES ('kepsek', 'keterangan-absensi');
