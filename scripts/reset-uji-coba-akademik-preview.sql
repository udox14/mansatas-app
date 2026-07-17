-- READ-ONLY: hitung data uji coba 13-16 Juli 2026 yang termasuk scope reset.
-- Satu baris dengan scalar subquery menghindari batas compound SELECT D1.

SELECT
  (SELECT COUNT(*) FROM agenda_guru
   WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16') AS agenda_guru,
  (SELECT COUNT(*) FROM jurnal_guru_harian
   WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16') AS jurnal_guru_harian,
  (SELECT COUNT(*) FROM absensi_siswa
   WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16') AS absensi_siswa,
  (SELECT COUNT(*) FROM absensi_sesi_guru
   WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16') AS absensi_sesi_guru,
  (SELECT COUNT(*) FROM keterangan_absensi_wali_kelas
   WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16') AS keterangan_absensi,
  (SELECT COUNT(*) FROM rekap_kehadiran_bulanan
   WHERE bulan = 7
     AND date(updated_at) >= '2026-07-13'
     AND date(updated_at) <= '2026-07-16') AS rekap_kehadiran_bulanan,
  (SELECT COUNT(*) FROM delegasi_tugas_kelas
   WHERE delegasi_id IN (
     SELECT id FROM delegasi_tugas
     WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16'
   )) AS delegasi_tugas_kelas,
  (SELECT COUNT(*) FROM delegasi_tugas
   WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16') AS delegasi_tugas,
  (SELECT COUNT(*) FROM nilai_harian_detail
   WHERE header_id IN (
     SELECT id FROM nilai_harian_header
     WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16'
   )) AS nilai_harian_detail,
  (SELECT COUNT(*) FROM nilai_harian_header
   WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16') AS nilai_harian_header,
  (SELECT COUNT(*) FROM nilai_harian_kkm
   WHERE date(updated_at) >= '2026-07-13'
     AND date(updated_at) <= '2026-07-16') AS nilai_harian_kkm;
