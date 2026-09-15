-- Konsolidasi delegasi Guru PPL pada level penugasan mapel-kelas.
-- Jalankan sebelum kode aplikasi yang menggunakan penugasan_mengajar_id/ppl_user_id.

ALTER TABLE guru_ppl_mapping
  ADD COLUMN penugasan_mengajar_id TEXT REFERENCES penugasan_mengajar(id) ON DELETE CASCADE;

UPDATE guru_ppl_mapping
SET penugasan_mengajar_id = (
  SELECT jm.penugasan_id
  FROM jadwal_mengajar jm
  WHERE jm.id = guru_ppl_mapping.jadwal_mengajar_id
)
WHERE jadwal_mengajar_id IS NOT NULL
  AND penugasan_mengajar_id IS NULL;

-- Pemilik resmi selalu mengikuti penugasan/jadwal sumber, termasuk data lama
-- yang sempat menyimpan pasangan guru tidak konsisten.
UPDATE guru_ppl_mapping
SET guru_utama_id = (
  SELECT pm.guru_id
  FROM penugasan_mengajar pm
  WHERE pm.id = guru_ppl_mapping.penugasan_mengajar_id
)
WHERE penugasan_mengajar_id IS NOT NULL;

UPDATE guru_ppl_mapping
SET guru_utama_id = (
  SELECT jp.user_id
  FROM jadwal_guru_piket jp
  WHERE jp.id = guru_ppl_mapping.jadwal_piket_id
)
WHERE penugasan_mengajar_id IS NULL
  AND jadwal_piket_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jadwal_guru_piket jp
    WHERE jp.id = guru_ppl_mapping.jadwal_piket_id
  );

-- Satu mapel-kelas cukup satu kali walaupun sebelumnya dipilih per jam pelajaran.
DELETE FROM guru_ppl_mapping
WHERE penugasan_mengajar_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id)
    FROM guru_ppl_mapping
    WHERE penugasan_mengajar_id IS NOT NULL
    GROUP BY guru_ppl_id, penugasan_mengajar_id
  );

DELETE FROM guru_ppl_mapping
WHERE penugasan_mengajar_id IS NULL
  AND jadwal_piket_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id)
    FROM guru_ppl_mapping
    WHERE penugasan_mengajar_id IS NULL
      AND jadwal_piket_id IS NOT NULL
    GROUP BY guru_ppl_id, jadwal_piket_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_ppl_unique_penugasan
  ON guru_ppl_mapping(guru_ppl_id, penugasan_mengajar_id)
  WHERE penugasan_mengajar_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_ppl_unique_piket
  ON guru_ppl_mapping(guru_ppl_id, jadwal_piket_id)
  WHERE jadwal_piket_id IS NOT NULL;

ALTER TABLE agenda_guru
  ADD COLUMN ppl_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_guru_ppl_user
  ON agenda_guru(ppl_user_id, tanggal);

ALTER TABLE nilai_harian_header
  ADD COLUMN diinput_oleh TEXT REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE nilai_harian_header
  ADD COLUMN diubah_oleh TEXT REFERENCES "user"(id) ON DELETE SET NULL;

UPDATE nilai_harian_header
SET diinput_oleh = created_by
WHERE diinput_oleh IS NULL;

CREATE INDEX IF NOT EXISTS idx_nilai_harian_diinput_oleh
  ON nilai_harian_header(diinput_oleh);
