-- FCM (Firebase Cloud Messaging) device tokens
-- Kanal Android native (Capacitor). VAPID tetap dipakai untuk web/PWA/iOS.
-- Satu tabel untuk pegawai (owner_type='staff', user_id) dan orang tua (owner_type='parent', siswa_id).

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token TEXT NOT NULL UNIQUE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('staff','parent')),
  user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE,   -- diisi saat staff
  siswa_id TEXT REFERENCES siswa(id) ON DELETE CASCADE,    -- diisi saat parent
  platform TEXT,                                            -- 'android' | 'ios' | 'web'
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user  ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_siswa ON fcm_tokens(siswa_id);
