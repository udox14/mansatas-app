-- Audit log perubahan nominal DSPT dari Kasir Daftar Ulang
CREATE TABLE IF NOT EXISTS fin_dspt_audit_log (
  id           TEXT PRIMARY KEY,
  dspt_id      TEXT NOT NULL REFERENCES fin_dspt(id),
  siswa_id     TEXT NOT NULL REFERENCES siswa(id),
  field_name   TEXT NOT NULL DEFAULT 'nominal_target',
  old_value    INTEGER,
  new_value    INTEGER NOT NULL,
  action       TEXT NOT NULL CHECK(action IN ('create', 'update')),
  source       TEXT NOT NULL DEFAULT 'kasir_daftar_ulang',
  dibuat_oleh  TEXT NOT NULL REFERENCES "user"(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fin_dspt_audit_log_dspt
  ON fin_dspt_audit_log(dspt_id, created_at);

CREATE INDEX IF NOT EXISTS idx_fin_dspt_audit_log_siswa
  ON fin_dspt_audit_log(siswa_id, created_at);

CREATE INDEX IF NOT EXISTS idx_fin_dspt_audit_log_user
  ON fin_dspt_audit_log(dibuat_oleh, created_at);
