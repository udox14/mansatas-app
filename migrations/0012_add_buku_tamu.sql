-- Migration: Buku Tamu Digital
-- Fitur pencatatan tamu yang berkunjung ke sekolah (khusus Resepsionis)

CREATE TABLE IF NOT EXISTS buku_tamu (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tanggal       TEXT NOT NULL,                         -- format YYYY-MM-DD (WIB)
  waktu         TEXT NOT NULL,                         -- format HH:MM (WIB)
  kategori      TEXT NOT NULL CHECK(kategori IN ('INDIVIDU', 'INSTANSI')),
  nama          TEXT,                                  -- diisi jika INDIVIDU
  instansi      TEXT,                                  -- diisi jika INSTANSI
  maksud_tujuan TEXT NOT NULL,
  foto_url      TEXT,                                  -- URL R2 public
  dicatat_oleh  TEXT REFERENCES "user"(id),            -- user resepsionis
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_buku_tamu_tanggal ON buku_tamu(tanggal);
CREATE INDEX IF NOT EXISTS idx_buku_tamu_kategori ON buku_tamu(kategori);
CREATE INDEX IF NOT EXISTS idx_buku_tamu_created ON buku_tamu(created_at DESC);

-- ============================================================
-- Seed role_features: buku-tamu (input form — Resepsionis)
-- ============================================================
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
  ('resepsionis', 'buku-tamu'),
  ('super_admin',  'buku-tamu'),
  ('admin_tu',     'buku-tamu'),
  ('kepsek',       'buku-tamu'),
  ('wakamad',      'buku-tamu');
