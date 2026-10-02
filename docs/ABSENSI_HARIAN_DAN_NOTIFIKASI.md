# Rekap harian dan notifikasi kehadiran

Rekap sebelum akhir KBM bersifat sementara. Sesudah jam aktif terakhir kelas
berakhir (WIB), gunakan catatan yang tersedia dengan prioritas Alfa, Sakit, Izin,
Hadir. Blok tanpa data bukan Hadir/Alfa. Perizinan resmi biasa dihitung Hadir;
alasan sakit tetap Sakit. Koreksi wali dan prioritas izin sekolah sehari penuh
dipertahankan. Detail sesi dan jumlah input tertunda tetap tersedia.

Aturan berlaku untuk histori tanpa mengubah catatan absensi sumber. Pengaturan
lama `attendance_skip_incomplete_for_daily_status` tidak digunakan lagi.

## Penerapan

1. Terapkan `0114_attendance_parent_notice_state.sql` bersama release aplikasi,
   sebelum aplikasi baru menerima input absensi. Waktu migration menjadi batas
   aktivasi notifikasi. INSERT OR IGNORE mempertahankannya pada release berikutnya.
2. Pastikan binding `NOTIFICATION_QUEUE`, consumer, dan cron existing setiap lima
   menit tersedia. Tidak ada perubahan konfigurasi Worker atau dependency baru.
3. Periksa jam selesai slot terakhir tiap kelas. Hari ini tanpa waktu akhir tetap
   sementara; tanggal lampau dianggap telah berakhir.
4. Periksa template notifikasi di pengaturan. Template bawaan lama diperbarui
   hanya jika judul dan isi masih identik; template custom tetap dipertahankan.

Runtime mempunyai fallback pembentukan schema/aktivasi saat pertama diakses,
tetapi migration sebelum release diperlukan untuk mencatat batas deployment
secara tepat. Jangan mengganti waktu aktivasi saat redeploy.

## Pengiriman

- Laporan awal: satu per siswa/tanggal, Alfa/Sakit/Izin dari guru, minimum lima
  menit dari catatan sesi pemicu. Periksa ulang sesi, perizinan, dan keputusan
  wali sebelum kirim. Kandidat batal tidak menghabiskan kesempatan laporan awal.
- Rekap: cron sesudah KBM, hanya untuk siswa dengan laporan awal berhasil dikirim.
- Pembaruan: perubahan status akhir setelah rekap terkirim, minimum lima menit;
  perubahan catatan/kelengkapan saja tidak mengirim ulang. Revisi monoton membuat
  Alfa → Hadir → Alfa tetap dapat diberitahukan tanpa bentrok deduplikasi.
- Tanggal sebelum tanggal aktivasi, sumber sebelum timestamp aktivasi, serta
  pesan absensi antrean versi lama dibatalkan tanpa dikirim ulang.

`attendance_parent_notice_state` menyimpan kandidat/jatuh tempo, keberhasilan
laporan awal, dan revisi rekap. `notification_dispatches` tetap menjadi ledger
pengiriman. Klaim atomik dan commit state+ledger mencegah proses paralel/retry
normal mengirim laporan ganda. Seperti pengiriman push existing, crash sesudah
provider menerima pesan tetapi sebelum commit database masih dapat menimbulkan
pengiriman ulang; provider eksternal tidak mendukung transaksi D1.

## Pemeriksaan operasional dan rollback

Pantau log kegagalan cron/queue, DLQ, dan `notification_dispatches.last_error`.
Periksa bahwa laporan pertama bukan kesimpulan tentang ketidakhadiran sehari
penuh, rekap tidak terkirim sebelum jam terakhir, serta koreksi menghasilkan
pembaruan sesuai revisi. Periksa contoh siswa dengan izin resmi dan input tertunda.

Jika perlu rollback, nonaktifkan ketiga event notifikasi absensi terlebih dahulu,
lalu kembalikan release aplikasi. Simpan tabel state, ledger, dan batas aktivasi;
jangan menghapus data atau mengulang aktivasi. Rollback kode mengembalikan hasil
perhitungan histori ke aturan release sebelumnya tanpa mengubah data sumber.

Pengujian utama: `lib/attendance-status.test.ts`,
`lib/attendance-daily-integration.test.ts`, `lib/attendance-xlsx.test.ts`,
`lib/notification-engine.test.ts`, dan test absensi/delegasi existing.
