-- Riwayat penugasan, kampus asal, dan koreksi kehadiran Guru PPL.
--
-- PENTING: file ini memuat compound statement CREATE TRIGGER (BEGIN ... END).
-- Terapkan sebagai file utuh melalui Wrangler/D1 migrations. Jangan mengeksekusi
-- trigger per potongan statement pada editor Console D1 karena titik koma di
-- dalam body trigger dapat dibaca sebagai akhir query dan menghasilkan
-- "incomplete input".

-- Feature ini sudah lama ada di role_features pada sebagian instalasi, tetapi
-- permission CRUD bisa belum tersalin jika hardening diterapkan sesudah seed.
INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES
  ('super_admin', 'kelola-ppl'),
  ('operator', 'kelola-ppl'),
  ('kepsek', 'kelola-ppl'),
  ('wakamad', 'kelola-ppl');

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
SELECT role, 'kelola-ppl', 1, 1, 1, 1
FROM role_features
WHERE feature_id = 'kelola-ppl';

CREATE TABLE IF NOT EXISTS guru_ppl_kampus (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama TEXT NOT NULL COLLATE NOCASE UNIQUE,
  singkatan TEXT COLLATE NOCASE,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_ppl_kampus_singkatan
  ON guru_ppl_kampus(singkatan COLLATE NOCASE)
  WHERE singkatan IS NOT NULL AND trim(singkatan) <> '';

CREATE TABLE IF NOT EXISTS guru_ppl_profile (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  kampus_id TEXT REFERENCES guru_ppl_kampus(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guru_ppl_profile_kampus
  ON guru_ppl_profile(kampus_id);

ALTER TABLE guru_ppl_mapping ADD COLUMN berlaku_mulai TEXT;
ALTER TABLE guru_ppl_mapping ADD COLUMN berlaku_selesai TEXT;
ALTER TABLE guru_ppl_mapping ADD COLUMN updated_at TEXT;
ALTER TABLE guru_ppl_mapping ADD COLUMN jadwal_snapshot TEXT;

UPDATE guru_ppl_mapping
SET berlaku_mulai = COALESCE(
  CASE
    WHEN created_at LIKE '%+%' THEN substr(created_at, 1, 10)
    ELSE date(created_at, '+7 hours')
  END,
  date('now', '+7 hours')
)
WHERE berlaku_mulai IS NULL;

-- Bekukan jadwal KBM lama agar rekap historis tidak berubah ketika jadwal aktif
-- kemudian disusun ulang. Mapping baru juga menyimpan snapshot dari server action.
UPDATE guru_ppl_mapping
SET jadwal_snapshot = (
  SELECT json_group_array(json_object('hari', src.hari, 'jamKe', src.jam_ke))
  FROM (
    SELECT jm.hari, jm.jam_ke
    FROM jadwal_mengajar jm
    WHERE jm.penugasan_id = guru_ppl_mapping.penugasan_mengajar_id
    ORDER BY jm.hari, jm.jam_ke
  ) src
)
WHERE penugasan_mengajar_id IS NOT NULL
  AND (jadwal_snapshot IS NULL OR trim(jadwal_snapshot) = '')
  AND EXISTS (
    SELECT 1 FROM jadwal_mengajar jm
    WHERE jm.penugasan_id = guru_ppl_mapping.penugasan_mengajar_id
  );

UPDATE guru_ppl_mapping
SET jadwal_snapshot = (
  SELECT json_group_array(json_object(
    'hari', jp.hari,
    'jamMulai', sp.jam_mulai,
    'jamSelesai', sp.jam_selesai,
    'shift', sp.nama_shift
  ))
  FROM jadwal_guru_piket jp
  JOIN pengaturan_shift_piket sp ON sp.id = jp.shift_id
  WHERE jp.id = guru_ppl_mapping.jadwal_piket_id
)
WHERE jadwal_piket_id IS NOT NULL
  AND (jadwal_snapshot IS NULL OR trim(jadwal_snapshot) = '')
  AND EXISTS (
    SELECT 1
    FROM jadwal_guru_piket jp
    WHERE jp.id = guru_ppl_mapping.jadwal_piket_id
  );

DROP INDEX IF EXISTS idx_guru_ppl_unique_penugasan;
DROP INDEX IF EXISTS idx_guru_ppl_unique_piket;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_ppl_mapping_exact_kbm
  ON guru_ppl_mapping(guru_ppl_id, penugasan_mengajar_id, berlaku_mulai, COALESCE(berlaku_selesai, '9999-12-31'))
  WHERE penugasan_mengajar_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_ppl_mapping_exact_piket
  ON guru_ppl_mapping(guru_ppl_id, jadwal_piket_id, berlaku_mulai, COALESCE(berlaku_selesai, '9999-12-31'))
  WHERE jadwal_piket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guru_ppl_mapping_period
  ON guru_ppl_mapping(guru_ppl_id, berlaku_mulai, berlaku_selesai);

CREATE INDEX IF NOT EXISTS idx_guru_ppl_mapping_penugasan_period
  ON guru_ppl_mapping(penugasan_mengajar_id, berlaku_mulai, berlaku_selesai)
  WHERE penugasan_mengajar_id IS NOT NULL;

-- Audit sesi nilai lama tetap menunjuk pada pembuat resmi sebelum kolom aktor
-- aktual diperkenalkan oleh migrasi konsolidasi.
UPDATE nilai_harian_header
SET diinput_oleh = COALESCE(diinput_oleh, created_by),
    diubah_oleh = COALESCE(diubah_oleh, created_by)
WHERE diinput_oleh IS NULL OR diubah_oleh IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_guru_ppl_mapping_validate_insert
BEFORE INSERT ON guru_ppl_mapping
BEGIN
  SELECT CASE WHEN NEW.guru_ppl_id = NEW.guru_utama_id
    THEN RAISE(ABORT, 'Guru PPL tidak boleh menggantikan dirinya sendiri') END;
  SELECT CASE WHEN NEW.berlaku_mulai IS NULL
      OR date(NEW.berlaku_mulai) IS NULL
      OR strftime('%Y-%m-%d', NEW.berlaku_mulai) <> NEW.berlaku_mulai
    THEN RAISE(ABORT, 'Tanggal mulai mapping PPL tidak valid') END;
  SELECT CASE WHEN NEW.berlaku_selesai IS NOT NULL
      AND (date(NEW.berlaku_selesai) IS NULL
        OR strftime('%Y-%m-%d', NEW.berlaku_selesai) <> NEW.berlaku_selesai)
    THEN RAISE(ABORT, 'Tanggal selesai mapping PPL tidak valid') END;
  SELECT CASE WHEN NEW.berlaku_selesai IS NOT NULL AND NEW.berlaku_selesai < NEW.berlaku_mulai
    THEN RAISE(ABORT, 'Rentang mapping PPL tidak valid') END;
  SELECT CASE WHEN (NEW.penugasan_mengajar_id IS NULL) = (NEW.jadwal_piket_id IS NULL)
    THEN RAISE(ABORT, 'Mapping PPL harus tepat satu jenis tugas') END;
  SELECT CASE WHEN NEW.penugasan_mengajar_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM penugasan_mengajar pm
    WHERE pm.id = NEW.penugasan_mengajar_id AND pm.guru_id = NEW.guru_utama_id
  ) THEN RAISE(ABORT, 'Penugasan KBM bukan milik guru utama') END;
  SELECT CASE WHEN NEW.jadwal_piket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jadwal_guru_piket jp
    WHERE jp.id = NEW.jadwal_piket_id AND jp.user_id = NEW.guru_utama_id
  ) THEN RAISE(ABORT, 'Jadwal piket bukan milik guru utama') END;
  SELECT CASE WHEN NEW.penugasan_mengajar_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM guru_ppl_mapping old
    WHERE old.penugasan_mengajar_id = NEW.penugasan_mengajar_id
      AND old.berlaku_mulai <= COALESCE(NEW.berlaku_selesai, '9999-12-31')
      AND NEW.berlaku_mulai <= COALESCE(old.berlaku_selesai, '9999-12-31')
  ) THEN RAISE(ABORT, 'Mapel-kelas sudah ditempati PPL lain pada periode tersebut') END;
  SELECT CASE WHEN NEW.jadwal_piket_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM guru_ppl_mapping old
    WHERE old.guru_ppl_id = NEW.guru_ppl_id
      AND old.jadwal_piket_id = NEW.jadwal_piket_id
      AND old.berlaku_mulai <= COALESCE(NEW.berlaku_selesai, '9999-12-31')
      AND NEW.berlaku_mulai <= COALESCE(old.berlaku_selesai, '9999-12-31')
  ) THEN RAISE(ABORT, 'Jadwal piket sudah dipetakan pada periode tersebut') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_guru_ppl_mapping_validate_update
BEFORE UPDATE OF guru_ppl_id, guru_utama_id, penugasan_mengajar_id, jadwal_piket_id, berlaku_mulai, berlaku_selesai ON guru_ppl_mapping
BEGIN
  SELECT CASE WHEN NEW.guru_ppl_id = NEW.guru_utama_id
    THEN RAISE(ABORT, 'Guru PPL tidak boleh menggantikan dirinya sendiri') END;
  SELECT CASE WHEN NEW.berlaku_mulai IS NULL
      OR date(NEW.berlaku_mulai) IS NULL
      OR strftime('%Y-%m-%d', NEW.berlaku_mulai) <> NEW.berlaku_mulai
    THEN RAISE(ABORT, 'Tanggal mulai mapping PPL tidak valid') END;
  SELECT CASE WHEN NEW.berlaku_selesai IS NOT NULL
      AND (date(NEW.berlaku_selesai) IS NULL
        OR strftime('%Y-%m-%d', NEW.berlaku_selesai) <> NEW.berlaku_selesai)
    THEN RAISE(ABORT, 'Tanggal selesai mapping PPL tidak valid') END;
  SELECT CASE WHEN NEW.berlaku_selesai IS NOT NULL AND NEW.berlaku_selesai < NEW.berlaku_mulai
    THEN RAISE(ABORT, 'Rentang mapping PPL tidak valid') END;
  SELECT CASE WHEN (NEW.penugasan_mengajar_id IS NULL) = (NEW.jadwal_piket_id IS NULL)
    THEN RAISE(ABORT, 'Mapping PPL harus tepat satu jenis tugas') END;
  SELECT CASE WHEN NEW.penugasan_mengajar_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM penugasan_mengajar pm
    WHERE pm.id = NEW.penugasan_mengajar_id AND pm.guru_id = NEW.guru_utama_id
  ) THEN RAISE(ABORT, 'Penugasan KBM bukan milik guru utama') END;
  SELECT CASE WHEN NEW.jadwal_piket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jadwal_guru_piket jp
    WHERE jp.id = NEW.jadwal_piket_id AND jp.user_id = NEW.guru_utama_id
  ) THEN RAISE(ABORT, 'Jadwal piket bukan milik guru utama') END;
  SELECT CASE WHEN NEW.penugasan_mengajar_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM guru_ppl_mapping old
    WHERE old.id <> NEW.id
      AND old.penugasan_mengajar_id = NEW.penugasan_mengajar_id
      AND old.berlaku_mulai <= COALESCE(NEW.berlaku_selesai, '9999-12-31')
      AND NEW.berlaku_mulai <= COALESCE(old.berlaku_selesai, '9999-12-31')
  ) THEN RAISE(ABORT, 'Mapel-kelas sudah ditempati PPL lain pada periode tersebut') END;
  SELECT CASE WHEN NEW.jadwal_piket_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM guru_ppl_mapping old
    WHERE old.id <> NEW.id
      AND old.guru_ppl_id = NEW.guru_ppl_id
      AND old.jadwal_piket_id = NEW.jadwal_piket_id
      AND old.berlaku_mulai <= COALESCE(NEW.berlaku_selesai, '9999-12-31')
      AND NEW.berlaku_mulai <= COALESCE(old.berlaku_selesai, '9999-12-31')
  ) THEN RAISE(ABORT, 'Jadwal piket sudah dipetakan pada periode tersebut') END;
END;

CREATE TABLE IF NOT EXISTS guru_ppl_kehadiran_override (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mapping_id TEXT NOT NULL REFERENCES guru_ppl_mapping(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('HADIR','TELAT','SAKIT','IZIN','ALFA')),
  catatan TEXT,
  diubah_oleh TEXT NOT NULL REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(mapping_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_guru_ppl_override_tanggal
  ON guru_ppl_kehadiran_override(tanggal, mapping_id);
