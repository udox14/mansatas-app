-- PMB <-> daftar ulang/DSPT integration (additive; no historical backfill).
-- Run scripts/check-pmb-duplicates.sql first. Unique indexes intentionally fail
-- when historical duplicates still exist, so an operator can resolve them.

-- These three columns were already deployed before this numbered migration:
-- konfirmasi_daftar_ulang, konfirmasi_rapat, alasan_tidak_hadir.
-- Keep them in the fresh-install schema, but do not add them again here.
ALTER TABLE pmb_pendaftar ADD COLUMN nilai_rapor_s1 REAL;
ALTER TABLE pmb_pendaftar ADD COLUMN nilai_rapor_s2 REAL;
ALTER TABLE pmb_pendaftar ADD COLUMN nilai_rapor_s3 REAL;
ALTER TABLE pmb_pendaftar ADD COLUMN nilai_rapor_s4 REAL;
ALTER TABLE pmb_pendaftar ADD COLUMN nilai_rapor_s5 REAL;
ALTER TABLE pmb_pendaftar ADD COLUMN peringkat_rapor_s1 INTEGER;
ALTER TABLE pmb_pendaftar ADD COLUMN peringkat_rapor_s2 INTEGER;
ALTER TABLE pmb_pendaftar ADD COLUMN peringkat_rapor_s3 INTEGER;
ALTER TABLE pmb_pendaftar ADD COLUMN peringkat_rapor_s4 INTEGER;
ALTER TABLE pmb_pendaftar ADD COLUMN peringkat_rapor_s5 INTEGER;
ALTER TABLE pmb_pendaftar ADD COLUMN avg_nilai_rapor REAL;
ALTER TABLE pmb_pendaftar ADD COLUMN integritas_rapor_at TEXT;
ALTER TABLE pmb_pendaftar ADD COLUMN daftar_ulang_hardcopy_status TEXT;
ALTER TABLE pmb_pendaftar ADD COLUMN daftar_ulang_hardcopy_at TEXT;
ALTER TABLE pmb_pendaftar ADD COLUMN daftar_ulang_diproses_at TEXT;
ALTER TABLE pmb_pendaftar ADD COLUMN daftar_ulang_diproses_oleh TEXT REFERENCES "user"(id);

CREATE UNIQUE INDEX idx_pmb_pendaftar_tahun_nisn_unique
  ON pmb_pendaftar(tahun_ajaran, nisn) WHERE COALESCE(TRIM(nisn),'')<>'';
CREATE UNIQUE INDEX idx_pmb_pendaftar_tahun_nik_unique
  ON pmb_pendaftar(tahun_ajaran, nik) WHERE COALESCE(TRIM(nik),'')<>'';
CREATE UNIQUE INDEX idx_pmb_pendaftar_tahun_nomor_unique
  ON pmb_pendaftar(tahun_ajaran, no_pendaftaran) WHERE COALESCE(TRIM(no_pendaftaran),'')<>'';

ALTER TABLE fin_dspt ADD COLUMN pmb_pendaftar_id TEXT REFERENCES pmb_pendaftar(id);
ALTER TABLE fin_dspt ADD COLUMN nominal_mode TEXT DEFAULT 'manual';
ALTER TABLE fin_dspt ADD COLUMN nominal_package_id TEXT;
ALTER TABLE fin_dspt ADD COLUMN nominal_override_reason TEXT;
CREATE UNIQUE INDEX idx_fin_dspt_pmb_pendaftar_unique
  ON fin_dspt(pmb_pendaftar_id)
  WHERE pmb_pendaftar_id IS NOT NULL;

ALTER TABLE fin_dspt_audit_log ADD COLUMN reason TEXT;
ALTER TABLE fin_dspt_audit_log ADD COLUMN metadata TEXT;

CREATE TABLE fin_operation_idempotency (
  request_key TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  actor_id TEXT REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fin_operation_idempotency_created ON fin_operation_idempotency(created_at);

INSERT INTO system_settings (key, value, updated_at) VALUES
  ('keuangan_dspt_entry_mode', 'manual', CURRENT_TIMESTAMP),
  ('keuangan_dspt_default_amount', '0', CURRENT_TIMESTAMP),
  ('keuangan_dspt_packages', '[]', CURRENT_TIMESTAMP),
  ('keuangan_dspt_allow_cashier_override', '1', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO NOTHING;

INSERT OR IGNORE INTO pmb_pengaturan (key, value, is_active) VALUES
  ('jalur_reguler_dibuka', '1', 1),
  ('jalur_prestasi_dibuka', '1', 1),
  ('kelulusan_aktif', '0', 1),
  ('cetak_kartu_aktif', '0', 1),
  ('tanggal_pengumuman_reguler', '', 1),
  ('tanggal_pengumuman_prestasi', '', 1),
  ('landing_popup_aktif', '0', 1),
  ('landing_popup_mode', 'instruksi', 1),
  ('landing_popup_judul', '', 1),
  ('landing_popup_isi', '', 1),
  ('landing_popup_tombol_text', '', 1),
  ('landing_popup_tombol_link', '', 1),
  ('teks_batas_daftar_ulang', '', 1),
  ('link_berkas_pendukung', '', 1),
  ('nama_kepala_madrasah', '', 1),
  ('nip_kepala_madrasah', '', 1);
