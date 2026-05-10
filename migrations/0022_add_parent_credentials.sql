-- Password custom orang tua (fallback default tetap NISN jika belum ada row)
CREATE TABLE IF NOT EXISTS parent_credentials (
  siswa_id TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

