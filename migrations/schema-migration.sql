-- Migration: fix user table untuk Better Auth compatibility
-- Jalankan via: npx wrangler d1 execute mansatas-db --remote --file=schema-migration.sql

-- Drop auth tables (data masih kosong, aman)
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS "user";

-- Recreate user table tanpa CHECK constraint pada role
-- + tambah kolom banned untuk Better Auth admin plugin
CREATE TABLE IF NOT EXISTS "user" (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  emailVerified     INTEGER NOT NULL DEFAULT 0,
  image             TEXT,
  createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now')),
  role              TEXT NOT NULL DEFAULT 'wali_kelas',
  nama_lengkap      TEXT,
  avatar_url        TEXT,
  banned            INTEGER DEFAULT 0,
  banReason         TEXT,
  banExpires        TEXT
);

CREATE TABLE IF NOT EXISTS session (
  id                TEXT PRIMARY KEY,
  expiresAt         TEXT NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now')),
  ipAddress         TEXT,
  userAgent         TEXT,
  userId            TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id                       TEXT PRIMARY KEY,
  accountId                TEXT NOT NULL,
  providerId               TEXT NOT NULL,
  userId                   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken              TEXT,
  refreshToken             TEXT,
  idToken                  TEXT,
  accessTokenExpiresAt     TEXT,
  refreshTokenExpiresAt    TEXT,
  scope                    TEXT,
  password                 TEXT,
  createdAt                TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  TEXT NOT NULL,
  createdAt  TEXT DEFAULT (datetime('now')),
  updatedAt  TEXT DEFAULT (datetime('now'))
);