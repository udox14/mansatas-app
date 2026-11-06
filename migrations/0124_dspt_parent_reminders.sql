CREATE TABLE parent_web_push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_parent_web_push_siswa ON parent_web_push_subscriptions(siswa_id, id);
CREATE INDEX idx_web_push_endpoint ON web_push_subscriptions(endpoint);

CREATE TABLE dspt_notice_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE dspt_notices (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience_json TEXT NOT NULL,
  audience_label TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  failed_at TEXT
);
CREATE INDEX idx_dspt_notices_created ON dspt_notices(created_at DESC, id DESC);

CREATE TABLE dspt_notice_recipients (
  notice_id TEXT NOT NULL REFERENCES dspt_notices(id),
  siswa_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','in_app','skipped')),
  PRIMARY KEY(notice_id, siswa_id)
);

CREATE TABLE dspt_notice_devices (
  notice_id TEXT NOT NULL,
  siswa_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('fcm','webpush')),
  device_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at TEXT,
  PRIMARY KEY(notice_id, channel, device_id),
  FOREIGN KEY(notice_id, siswa_id) REFERENCES dspt_notice_recipients(notice_id, siswa_id)
);
CREATE INDEX idx_dspt_notice_devices_work ON dspt_notice_devices(notice_id, channel, state, siswa_id, retry_at);
CREATE INDEX idx_dspt_notice_devices_student ON dspt_notice_devices(notice_id, siswa_id, channel);
CREATE INDEX idx_fin_payment_submissions_dspt_review
  ON fin_payment_submissions(siswa_id) WHERE kategori = 'dspt' AND status = 'menunggu_konfirmasi';
