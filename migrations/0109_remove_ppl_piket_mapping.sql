-- Kelola PPL hanya menangani delegasi KBM mapel–kelas.
-- Penempatan piket untuk semua akun, termasuk Guru PPL, dikelola langsung
-- melalui jadwal_guru_piket pada modul Jadwal Guru Piket.

DROP TRIGGER IF EXISTS trg_guru_ppl_mapping_validate_insert;
DROP TRIGGER IF EXISTS trg_guru_ppl_mapping_validate_update;
DROP INDEX IF EXISTS idx_guru_ppl_mapping_active_piket;
DROP INDEX IF EXISTS idx_guru_ppl_mapping_exact_piket;

DELETE FROM guru_ppl_kehadiran_override
WHERE mapping_id IN (
  SELECT id FROM guru_ppl_mapping WHERE jadwal_piket_id IS NOT NULL
);

DELETE FROM guru_ppl_mapping WHERE jadwal_piket_id IS NOT NULL;

CREATE TRIGGER trg_guru_ppl_mapping_validate_insert
BEFORE INSERT ON guru_ppl_mapping
BEGIN
  SELECT CASE WHEN NEW.guru_ppl_id = NEW.guru_utama_id
    THEN RAISE(ABORT, 'Guru PPL tidak boleh menggantikan dirinya sendiri') END;
  SELECT CASE WHEN NEW.penugasan_mengajar_id IS NULL OR NEW.jadwal_piket_id IS NOT NULL
    THEN RAISE(ABORT, 'Kelola PPL hanya menerima penugasan KBM mapel-kelas') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM penugasan_mengajar pm
    WHERE pm.id = NEW.penugasan_mengajar_id AND pm.guru_id = NEW.guru_utama_id
  ) THEN RAISE(ABORT, 'Penugasan KBM bukan milik guru utama') END;
END;

CREATE TRIGGER trg_guru_ppl_mapping_validate_update
BEFORE UPDATE OF guru_ppl_id, guru_utama_id, penugasan_mengajar_id, jadwal_piket_id ON guru_ppl_mapping
BEGIN
  SELECT CASE WHEN NEW.guru_ppl_id = NEW.guru_utama_id
    THEN RAISE(ABORT, 'Guru PPL tidak boleh menggantikan dirinya sendiri') END;
  SELECT CASE WHEN NEW.penugasan_mengajar_id IS NULL OR NEW.jadwal_piket_id IS NOT NULL
    THEN RAISE(ABORT, 'Kelola PPL hanya menerima penugasan KBM mapel-kelas') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM penugasan_mengajar pm
    WHERE pm.id = NEW.penugasan_mengajar_id AND pm.guru_id = NEW.guru_utama_id
  ) THEN RAISE(ABORT, 'Penugasan KBM bukan milik guru utama') END;
END;
