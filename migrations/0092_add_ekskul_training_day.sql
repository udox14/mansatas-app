-- Production already has hari_latihan declared as INTEGER from a manual run.
-- SQLite cannot alter a column type directly, so rebuild the parent table while
-- preserving all rows and child-table foreign-key references.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE ekstrakurikuler_rebuild (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama            TEXT NOT NULL,
  deskripsi       TEXT,
  mode_nilai      TEXT NOT NULL DEFAULT 'angka' CHECK(mode_nilai IN ('angka','huruf')),
  hari_latihan    TEXT,
  status          TEXT NOT NULL DEFAULT 'aktif',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO ekstrakurikuler_rebuild (
  id, nama, deskripsi, mode_nilai, hari_latihan, status, created_at, updated_at
)
SELECT
  id,
  nama,
  deskripsi,
  mode_nilai,
  CASE
    WHEN hari_latihan IS NULL THEN NULL
    WHEN typeof(hari_latihan) = 'integer' THEN json_array(hari_latihan)
    WHEN json_valid(hari_latihan) THEN hari_latihan
    ELSE json_array(CAST(hari_latihan AS INTEGER))
  END,
  status,
  created_at,
  updated_at
FROM ekstrakurikuler;

DROP TABLE ekstrakurikuler;
ALTER TABLE ekstrakurikuler_rebuild RENAME TO ekstrakurikuler;
