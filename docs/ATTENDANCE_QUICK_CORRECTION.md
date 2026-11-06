# Notifikasi wali dan koreksi cepat

## Perilaku

- Catatan guru Alfa, Sakit, atau Izin membuat pekerjaan antrean bersama transaksi
  absensi. Wali kelas menerima FCM/web push dengan jeda bawaan 0 menit. Antrean
  tetap dapat membuat penerimaan lebih lambat.
- Tautan membuka `/dashboard/kelas-binaan/koreksi` untuk satu siswa, tanggal,
  dan penugasan. Koreksi biasa dapat disimpan langsung dengan alasan opsional.
  Untuk mengubah Alfa mapel yang masih berlaku menjadi Hadir, Sakit, atau Izin,
  wali kelas mengirim ajuan dengan alasan wajib. Alur ini juga tersedia di
  Kelas Binaan dan Riwayat & Koreksi Absensi.
- Tab **Persetujuan Koreksi** tersedia untuk Wakamad Kesiswaan, Wakamad
  Kurikulum, Kepala Madrasah, dan Super Admin. Hanya Super Admin yang dapat
  menyetujui ajuan sendiri. Pemeriksa melihat status harian, usulan, blok Alfa,
  izin resmi, dan alasan. Penolakan wajib beralasan. Perubahan blok Alfa
  memerlukan peninjauan ulang melalui ajuan baru.
- Saat ajuan baru tersimpan, pemeriksa yang berwenang menerima push aplikasi
  atau web pada perangkat aktif dan pemberitahuan di **Notifikasi ajuan**.
  **Tinjau ajuan** membuka rincian dan keputusan terbaru. Isi pemberitahuan
  hanya menyebut adanya ajuan. Event aktif secara default di Notifikasi Otomatis.
  Antrean memeriksa ulang hak akses penerima dan status ajuan sebelum dikirim.
- Laporan awal Alfa mengikuti sesi mapel. Persetujuan berlaku pada rekap harian
  selama blok Alfa sesuai dengan yang ditinjau. Kandidat yang batal karena
  perubahan sumber atau izin tidak memakai kesempatan satu laporan awal per
  hari. Sesi valid lain dapat menjadi pemicu baru.
- Rekap harian tetap menunggu akhir KBM. Penutup hanya mengikuti laporan awal
  yang berhasil dikirim; perubahan status sesudahnya menghasilkan pembaruan.

## Pengaturan

Modul Notifikasi Otomatis menyediakan **Jeda pengiriman (menit)** pada tiga event:
wali kelas (bawaan 0), laporan awal orang tua (5), dan pembaruan rekap (5).
Nilai berupa menit bulat 0–60, divalidasi kembali di server. Nilai tersimpan di
`reminder_json.delayMinutes`; pengaturan lain dan template custom dipertahankan.
Perubahan berlaku untuk kandidat baru. Jatuh tempo kandidat yang sudah terbentuk
tetap tersimpan. Rekap penutup tidak mendapat jeda tambahan setelah akhir KBM.

## Arsitektur dan penerapan

1. Terapkan migrasi `0116_attendance_quick_correction_outbox.sql` dan
   `0125_attendance_correction_approval.sql` sebelum kode yang bergantung padanya.
   Keduanya mempertahankan data sumber dan waktu aktivasi dari migrasi 0114.
2. Reuse binding Queue, consumer, dan cron lima menit existing. Tidak perlu
   dependency atau Worker baru. Submit tidak menghubungi provider push.
3. Ledger menyimpan payload pekerjaan dan pengiriman tertunda. Enqueue memakai
   lease; kegagalan enqueue dipulihkan cron. Consumer memakai klaim atomik dan
   deduplikasi per revisi. Crash sesudah provider menerima pesan tetapi sebelum
   commit D1 masih bisa mengulang push; transaksi provider dan D1 tidak menyatu.
4. Pemrosesan sumber dibatasi per siswa/tanggal dan maksimal 50 siswa per
   pekerjaan. Cron membaca maksimal 100 state yang perlu diperiksa, bukan
   menghitung seluruh kelas/histori. Enqueue recovery maksimal 50 per drain.
5. `needs_recheck` adalah counter generasi perubahan. Hasil pemeriksaan hanya
   membersihkan generasi yang dibaca, sehingga perubahan serentak tidak hilang.
   Perizinan menandai ulang state existing lewat trigger atomik, tanpa memulai
   laporan baru untuk histori.

Pantau Queue/DLQ, `notification_dispatches.last_error`, durasi/CPU Worker, retry,
duplikasi, serta pengiriman sebelum akhir KBM. Uji FCM perangkat dan tampilan
browser setelah release; test lokal tidak mengukur CPU produksi atau penerimaan
push perangkat. Jika rollback diperlukan, nonaktifkan event absensi sebelum
mengembalikan kode, biarkan kolom/trigger/state dan batas aktivasi tersimpan,
serta hentikan/drain pekerjaan antrean versi baru sebelum menjalankan consumer
lama. Jangan menjalankan ulang aktivasi atau menghapus sumber absensi.
