-- RESET DATA UJI COBA AKADEMIK, KHUSUS 13-16 JULI 2026 (INKLUSIF)
-- Scope sengaja dibatasi. Data Mei-Juni dan tanggal lain tidak disentuh.
-- Jalankan hanya setelah backup dan hasil preview disetujui.
-- Urutan child -> parent menjaga foreign key tanpa menghapus
-- penugasan_mengajar atau jadwal_mengajar.

-- 4. Nilai harian pada tanggal uji coba
DELETE FROM nilai_harian_detail
WHERE header_id IN (
  SELECT id FROM nilai_harian_header
  WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16'
);

DELETE FROM nilai_harian_header
WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16';

-- KKM tidak punya kolom tanggal akademik; gunakan waktu perubahan terakhir.
DELETE FROM nilai_harian_kkm
WHERE date(updated_at) >= '2026-07-13' AND date(updated_at) <= '2026-07-16';

-- 2. Absensi dan keterangan kehadiran pada tanggal uji coba
DELETE FROM absensi_siswa
WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16';

DELETE FROM absensi_sesi_guru
WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16';

DELETE FROM keterangan_absensi_wali_kelas
WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16';

-- Rekap ini bulanan: pengaman bulan=7 memastikan Mei-Juni tidak terhapus.
DELETE FROM rekap_kehadiran_bulanan
WHERE bulan = 7
  AND date(updated_at) >= '2026-07-13'
  AND date(updated_at) <= '2026-07-16';

-- 3. Delegasi tugas pada tanggal uji coba
DELETE FROM delegasi_tugas_kelas
WHERE delegasi_id IN (
  SELECT id FROM delegasi_tugas
  WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16'
);

DELETE FROM delegasi_tugas
WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16';

-- 1. Agenda guru pada tanggal uji coba (agenda piket tidak termasuk scope)
DELETE FROM agenda_guru
WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16';

DELETE FROM jurnal_guru_harian
WHERE tanggal >= '2026-07-13' AND tanggal <= '2026-07-16';
