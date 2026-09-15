-- Pemulihan aman untuk instalasi 0106 yang terhenti saat Console D1 memproses
-- compound statement CREATE TRIGGER. Jalankan file ini secara utuh dengan
-- `wrangler d1 execute ... --file=...`, bukan per statement di Console D1.
--
-- CREATE IF NOT EXISTS membuat migrasi ini aman baik untuk database yang 0106-nya
-- sudah lengkap maupun yang baru berhenti tepat sebelum trigger UPDATE dibuat.

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
