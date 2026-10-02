-- Migration 0115: D1 Performance Indexes & Schema Formalization
-- Menambahkan index kritis untuk mencegah full table scan pada tabel-tabel besar
-- dan memformalkan tabel parent session / credentials agar tidak perlu DDL runtime berulang.

-- 1. Index untuk rekap ketidakhadiran siswa (mencegah scan 311.000+ baris pada absensi_sesi_siswa)
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_siswa_siswa_status_tgl
  ON absensi_sesi_siswa(siswa_id, status, tanggal);

-- 2. Index untuk filter log aktivitas keamanan / audit berdasarkan tingkat keparahan
CREATE INDEX IF NOT EXISTS idx_activity_logs_severity_created
  ON activity_logs(severity, created_at DESC);

-- 3. Formalisasi tabel parent session & credentials
CREATE TABLE IF NOT EXISTS parent_session (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  nisn TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parent_session_siswa
  ON parent_session(siswa_id);

CREATE TABLE IF NOT EXISTS parent_credentials (
  siswa_id TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
