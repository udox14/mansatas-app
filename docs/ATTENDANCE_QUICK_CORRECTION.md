# Notifikasi wali dan koreksi cepat

## Perilaku

- Catatan guru Alfa, Sakit, atau Izin membuat pekerjaan antrean bersama transaksi
  absensi. Wali kelas menerima FCM/web push dengan jeda bawaan 0 menit. Antrean
  tetap dapat membuat penerimaan lebih lambat.
- Tautan membuka `/dashboard/kelas-binaan/koreksi` untuk satu siswa, tanggal,
  dan penugasan. Pilih status dan simpan; alasan opsional. Koreksi disimpan
  terpisah dari catatan guru, dengan pemeriksaan akses dan konflik perubahan.
- Laporan awal orang tua membaca ulang sumber dan koreksi saat dikirim.
  Koreksi Sakit/Izin mengubah isi laporan, Hadir membatalkan kandidat. Kandidat
  batal tidak memakai kesempatan satu laporan awal per hari. Sesi valid lain
  dapat menjadi pemicu baru dengan waktunya sendiri.
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

1. Terapkan migration `0116_attendance_quick_correction_outbox.sql` **sebelum**
   kode release ini. Migration menambah kolom ledger/state dan trigger perizinan;
   tidak mengubah sumber absensi maupun timestamp aktivasi dari migration 0114.
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
