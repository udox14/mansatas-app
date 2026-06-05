-- WhatsApp outbox, anti-duplikat ALFA, dan broadcast manual
-- Provider default aplikasi: WABLAS. Kolom template/category tetap disiapkan
-- agar bisa fallback ke Meta Cloud API tanpa migrasi ulang.
CREATE TABLE IF NOT EXISTS wa_campaigns (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title              TEXT NOT NULL,
  purpose            TEXT NOT NULL DEFAULT 'school_announcement'
                     CHECK(purpose IN ('school_announcement', 'billing_reminder', 'achievement_info', 'attendance_alfa', 'custom')),
  template_name      TEXT,
  language_code      TEXT NOT NULL DEFAULT 'id',
  category           TEXT NOT NULL DEFAULT 'utility'
                     CHECK(category IN ('utility', 'marketing', 'authentication', 'service')),
  body_text          TEXT NOT NULL,
  target_scope       TEXT NOT NULL DEFAULT 'all'
                     CHECK(target_scope IN ('all', 'kelas', 'tingkat', 'siswa')),
  kelas_id           TEXT REFERENCES kelas(id) ON DELETE SET NULL,
  tingkat            INTEGER,
  total_recipients   INTEGER NOT NULL DEFAULT 0,
  total_enqueued     INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK(status IN ('draft', 'queued', 'processing', 'completed', 'failed', 'canceled')),
  created_by         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wa_campaign_recipients (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id        TEXT NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
  siswa_id           TEXT REFERENCES siswa(id) ON DELETE SET NULL,
  recipient_phone    TEXT NOT NULL,
  recipient_name     TEXT,
  status             TEXT NOT NULL DEFAULT 'queued'
                     CHECK(status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'canceled')),
  outbox_id          TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, recipient_phone)
);

CREATE TABLE IF NOT EXISTS wa_outbox (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id        TEXT REFERENCES wa_campaigns(id) ON DELETE SET NULL,
  purpose            TEXT NOT NULL DEFAULT 'custom',
  category           TEXT NOT NULL DEFAULT 'utility'
                     CHECK(category IN ('utility', 'marketing', 'authentication', 'service')),
  recipient_phone    TEXT NOT NULL,
  recipient_name     TEXT,
  template_name      TEXT,
  language_code      TEXT NOT NULL DEFAULT 'id',
  body_text          TEXT,
  payload_json       TEXT,
  siswa_ids          TEXT,
  attendance_date    TEXT,
  status             TEXT NOT NULL DEFAULT 'queued'
                     CHECK(status IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'canceled')),
  retry_count        INTEGER NOT NULL DEFAULT 0,
  max_retry          INTEGER NOT NULL DEFAULT 3,
  scheduled_at       TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at            TEXT,
  provider_message_id TEXT,
  error_message      TEXT,
  created_by         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wa_daily_locks (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal            TEXT NOT NULL,
  recipient_phone    TEXT NOT NULL,
  purpose            TEXT NOT NULL,
  outbox_id          TEXT REFERENCES wa_outbox(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tanggal, recipient_phone, purpose)
);

CREATE INDEX IF NOT EXISTS idx_wa_outbox_status_due
  ON wa_outbox(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_wa_outbox_attendance
  ON wa_outbox(purpose, attendance_date, recipient_phone);

CREATE INDEX IF NOT EXISTS idx_wa_outbox_campaign
  ON wa_outbox(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_campaign
  ON wa_campaign_recipients(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_wa_daily_locks_lookup
  ON wa_daily_locks(tanggal, recipient_phone, purpose);

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('super_admin', 'whatsapp'),
  ('admin_tu', 'whatsapp'),
  ('bendahara_komite', 'whatsapp');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
  ('super_admin', 'whatsapp', 1, 1, 1, 1),
  ('admin_tu', 'whatsapp', 1, 1, 1, 0),
  ('bendahara_komite', 'whatsapp', 1, 1, 1, 0);
