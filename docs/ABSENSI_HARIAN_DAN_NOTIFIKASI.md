# Rekap harian dan notifikasi kehadiran

Rekap sebelum akhir KBM bersifat sementara. Sesudah jam aktif terakhir kelas
berakhir (WIB), gunakan catatan yang tersedia dengan prioritas Alfa, Sakit, Izin,
Hadir. Blok tanpa data bukan Hadir/Alfa. Perizinan resmi biasa dihitung Hadir;
alasan sakit tetap Sakit. Izin sekolah sehari penuh tetap diprioritaskan. Koreksi
Alfa yang masih berlaku ke Hadir, Sakit, atau Izin memerlukan persetujuan.
Detail sesi dan jumlah input tertunda tetap tersedia. Formulir absensi guru
dan pelaksana delegasi memakai status per sesi dan perizinan sebagai sumber.

Untuk histori, koreksi wali lama menjadi Hadir diabaikan saat hasil otomatis
adalah Alfa, Sakit, atau Izin. Koreksi lama lain tetap berlaku. Hitung ulang
terjadi saat dibaca, dengan catatan sumber dan koreksi lama tetap tersimpan.
Pengaturan
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
5. Untuk persetujuan koreksi Alfa, terapkan `0125_attendance_correction_approval.sql`
   sebelum merilis kode yang membaca kolom baru. Rilis keduanya dalam satu
   jendela, karena kode lama menulis koreksi tanpa penanda versi baru.

Runtime mempunyai fallback pembentukan schema/aktivasi saat pertama diakses,
tetapi migration sebelum release diperlukan untuk mencatat batas deployment
secara tepat. Jangan mengganti waktu aktivasi saat redeploy.

## Pengiriman

- Laporan awal: satu per siswa/tanggal, Alfa/Sakit/Izin dari guru, minimum lima
  menit dari catatan sesi pemicu. Periksa ulang sesi dan perizinan sebelum kirim.
  Laporan awal Alfa mengikuti status sesi meski rekap hariannya dikoreksi.
  Kandidat batal tidak menghabiskan kesempatan laporan awal.
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
