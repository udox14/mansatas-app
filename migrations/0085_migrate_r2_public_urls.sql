-- Convert historical public R2 development URLs to the authenticated media proxy.
-- This migration is idempotent. Verify the final SELECT in staging before disabling r2.dev.

UPDATE "user" SET avatar_url = '/api/media/' || substr(avatar_url, instr(avatar_url, 'r2.dev/') + 7)
WHERE avatar_url LIKE 'https://%.r2.dev/%';
UPDATE "user" SET signature_url = '/api/media/' || substr(signature_url, instr(signature_url, 'r2.dev/') + 7)
WHERE signature_url LIKE 'https://%.r2.dev/%';
UPDATE siswa SET foto_url = '/api/media/' || substr(foto_url, instr(foto_url, 'r2.dev/') + 7)
WHERE foto_url LIKE 'https://%.r2.dev/%';
UPDATE siswa_pelanggaran SET foto_url = '/api/media/' || substr(foto_url, instr(foto_url, 'r2.dev/') + 7)
WHERE foto_url LIKE 'https://%.r2.dev/%';
UPDATE agenda_guru SET foto_url = '/api/media/' || substr(foto_url, instr(foto_url, 'r2.dev/') + 7)
WHERE foto_url LIKE 'https://%.r2.dev/%';
UPDATE ekstrakurikuler_pertemuan SET foto_url = '/api/media/' || substr(foto_url, instr(foto_url, 'r2.dev/') + 7)
WHERE foto_url LIKE 'https://%.r2.dev/%';
UPDATE fin_payment_submissions SET bukti_url = '/api/media/' || substr(bukti_url, instr(bukti_url, 'r2.dev/') + 7)
WHERE bukti_url LIKE 'https://%.r2.dev/%';
UPDATE fin_transaksi SET bukti_transfer_url = '/api/media/' || substr(bukti_transfer_url, instr(bukti_transfer_url, 'r2.dev/') + 7)
WHERE bukti_transfer_url LIKE 'https://%.r2.dev/%';
UPDATE fin_kas_keluar SET bukti_url = '/api/media/' || substr(bukti_url, instr(bukti_url, 'r2.dev/') + 7)
WHERE bukti_url LIKE 'https://%.r2.dev/%';
UPDATE sarpras_aset SET foto_url = '/api/media/' || substr(foto_url, instr(foto_url, 'r2.dev/') + 7)
WHERE foto_url LIKE 'https://%.r2.dev/%';
UPDATE buku_tamu SET foto_url = '/api/media/' || substr(foto_url, instr(foto_url, 'r2.dev/') + 7)
WHERE foto_url LIKE 'https://%.r2.dev/%';
UPDATE surat_peringatan SET file_ttd_url = '/api/media/' || substr(file_ttd_url, instr(file_ttd_url, 'r2.dev/') + 7)
WHERE file_ttd_url LIKE 'https://%.r2.dev/%';

UPDATE pmb_pendaftar SET
  foto_url = CASE WHEN foto_url LIKE 'https://%.r2.dev/%' THEN '/api/media/' || substr(foto_url, instr(foto_url, 'r2.dev/') + 7) ELSE foto_url END,
  scan_kk_url = CASE WHEN scan_kk_url LIKE 'https://%.r2.dev/%' THEN '/api/media/' || substr(scan_kk_url, instr(scan_kk_url, 'r2.dev/') + 7) ELSE scan_kk_url END,
  scan_akta_url = CASE WHEN scan_akta_url LIKE 'https://%.r2.dev/%' THEN '/api/media/' || substr(scan_akta_url, instr(scan_akta_url, 'r2.dev/') + 7) ELSE scan_akta_url END,
  scan_kelakuan_baik_url = CASE WHEN scan_kelakuan_baik_url LIKE 'https://%.r2.dev/%' THEN '/api/media/' || substr(scan_kelakuan_baik_url, instr(scan_kelakuan_baik_url, 'r2.dev/') + 7) ELSE scan_kelakuan_baik_url END,
  scan_ktp_ortu_url = CASE WHEN scan_ktp_ortu_url LIKE 'https://%.r2.dev/%' THEN '/api/media/' || substr(scan_ktp_ortu_url, instr(scan_ktp_ortu_url, 'r2.dev/') + 7) ELSE scan_ktp_ortu_url END,
  scan_rapor_url = CASE WHEN scan_rapor_url LIKE 'https://%.r2.dev/%' THEN '/api/media/' || substr(scan_rapor_url, instr(scan_rapor_url, 'r2.dev/') + 7) ELSE scan_rapor_url END,
  scan_sertifikat_prestasi_url = CASE WHEN scan_sertifikat_prestasi_url LIKE 'https://%.r2.dev/%' THEN '/api/media/' || substr(scan_sertifikat_prestasi_url, instr(scan_sertifikat_prestasi_url, 'r2.dev/') + 7) ELSE scan_sertifikat_prestasi_url END;

UPDATE pmb_prestasi SET sertifikat_url = '/api/media/' || substr(sertifikat_url, instr(sertifikat_url, 'r2.dev/') + 7)
WHERE sertifikat_url LIKE 'https://%.r2.dev/%';

-- Preflight: must return zero before the public development URL is disabled.
SELECT 'user.avatar_url' source, COUNT(*) remaining FROM "user" WHERE avatar_url LIKE 'https://%.r2.dev/%'
UNION ALL SELECT 'user.signature_url', COUNT(*) FROM "user" WHERE signature_url LIKE 'https://%.r2.dev/%'
UNION ALL SELECT 'siswa.foto_url', COUNT(*) FROM siswa WHERE foto_url LIKE 'https://%.r2.dev/%'
UNION ALL SELECT 'pmb_pendaftar', COUNT(*) FROM pmb_pendaftar WHERE
  foto_url LIKE 'https://%.r2.dev/%' OR scan_kk_url LIKE 'https://%.r2.dev/%' OR scan_akta_url LIKE 'https://%.r2.dev/%'
  OR scan_kelakuan_baik_url LIKE 'https://%.r2.dev/%' OR scan_ktp_ortu_url LIKE 'https://%.r2.dev/%'
  OR scan_rapor_url LIKE 'https://%.r2.dev/%' OR scan_sertifikat_prestasi_url LIKE 'https://%.r2.dev/%';
