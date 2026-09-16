-- Sederhanakan penugasan PPL menjadi mapping aktif langsung tanpa periode.
-- Kolom tanggal dipertahankan internal untuk audit/monitoring, tetapi admin tidak
-- perlu lagi mengatur periode. Tanggal mulai diisi otomatis saat mapping dibuat
-- dan mapping aktif ditandai berlaku_selesai IS NULL.
-- Jalankan file utuh melalui Wrangler karena memuat CREATE TRIGGER.

DROP TRIGGER IF EXISTS trg_guru_ppl_mapping_validate_insert;
DROP TRIGGER IF EXISTS trg_guru_ppl_mapping_validate_update;

DROP INDEX IF EXISTS idx_guru_ppl_mapping_exact_kbm;
DROP INDEX IF EXISTS idx_guru_ppl_mapping_exact_piket;

-- Penugasan yang sedang berlaku saat migrasi dijadikan mapping permanen.
UPDATE guru_ppl_mapping
SET berlaku_selesai = NULL,
    updated_at = datetime('now')
WHERE berlaku_mulai <= date('now', '+7 hours')
  AND (berlaku_selesai IS NULL OR berlaku_selesai >= date('now', '+7 hours'));

-- Jika data lama sudah mengandung lebih dari satu mapping aktif untuk KBM yang
-- sama, pertahankan mapping terbaru dan arsipkan sisanya agar index dapat dibuat.
UPDATE guru_ppl_mapping
SET berlaku_selesai = date('now', '+7 hours', '-1 day'),
    updated_at = datetime('now')
WHERE berlaku_selesai IS NULL
  AND penugasan_mengajar_id IS NOT NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY penugasan_mengajar_id
        ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
      ) AS urutan
      FROM guru_ppl_mapping
      WHERE berlaku_selesai IS NULL AND penugasan_mengajar_id IS NOT NULL
    ) ranked
    WHERE urutan = 1
  );

UPDATE guru_ppl_mapping
SET berlaku_selesai = date('now', '+7 hours', '-1 day'),
    updated_at = datetime('now')
WHERE berlaku_selesai IS NULL
  AND jadwal_piket_id IS NOT NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY guru_ppl_id, jadwal_piket_id
        ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
      ) AS urutan
      FROM guru_ppl_mapping
      WHERE berlaku_selesai IS NULL AND jadwal_piket_id IS NOT NULL
    ) ranked
    WHERE urutan = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_ppl_mapping_active_kbm
  ON guru_ppl_mapping(penugasan_mengajar_id)
  WHERE penugasan_mengajar_id IS NOT NULL AND berlaku_selesai IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_ppl_mapping_active_piket
  ON guru_ppl_mapping(guru_ppl_id, jadwal_piket_id)
  WHERE jadwal_piket_id IS NOT NULL AND berlaku_selesai IS NULL;

CREATE TRIGGER trg_guru_ppl_mapping_validate_insert
BEFORE INSERT ON guru_ppl_mapping
BEGIN
  SELECT CASE WHEN NEW.guru_ppl_id = NEW.guru_utama_id
    THEN RAISE(ABORT, 'Guru PPL tidak boleh menggantikan dirinya sendiri') END;
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
END;

CREATE TRIGGER trg_guru_ppl_mapping_validate_update
BEFORE UPDATE OF guru_ppl_id, guru_utama_id, penugasan_mengajar_id, jadwal_piket_id ON guru_ppl_mapping
BEGIN
  SELECT CASE WHEN NEW.guru_ppl_id = NEW.guru_utama_id
    THEN RAISE(ABORT, 'Guru PPL tidak boleh menggantikan dirinya sendiri') END;
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
END;
