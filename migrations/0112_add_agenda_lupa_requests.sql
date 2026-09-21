-- Pengajuan lupa mengisi Agenda Guru.
-- Additive: tidak mengubah atau menghapus histori agenda yang sudah ada.

CREATE TABLE IF NOT EXISTS agenda_lupa_pengajuan (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  guru_id          TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  penugasan_id     TEXT NOT NULL REFERENCES penugasan_mengajar(id) ON DELETE CASCADE,
  tanggal          TEXT NOT NULL,
  jam_ke_mulai     INTEGER NOT NULL,
  jam_ke_selesai   INTEGER NOT NULL,
  materi           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  submitted_at     TEXT NOT NULL,
  reviewed_by      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  reviewed_at      TEXT,
  review_note      TEXT,
  agenda_id        TEXT REFERENCES agenda_guru(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(penugasan_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_agenda_lupa_status
  ON agenda_lupa_pengajuan(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_agenda_lupa_guru_bulan
  ON agenda_lupa_pengajuan(guru_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_agenda_lupa_agenda
  ON agenda_lupa_pengajuan(agenda_id);

INSERT OR IGNORE INTO system_settings (key, value, updated_at)
VALUES ('agenda_forgotten_monthly_limit', '2', CURRENT_TIMESTAMP);

-- Wakamad lain tetap disaring oleh jabatan struktural pada application layer.
INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES ('wakamad', 'monitoring-agenda');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES ('wakamad', 'monitoring-agenda', 0, 1, 1, 0);
