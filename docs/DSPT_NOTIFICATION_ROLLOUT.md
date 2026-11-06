# Peluncuran notifikasi DSPT

1. Terapkan migrasi aditif `0124_dspt_parent_reminders.sql` sesudah migrasi outbox notifikasi. Rilis aplikasi dan consumer bersama. Gunakan binding `NOTIFICATION_QUEUE`, dead-letter queue, dan cron lima menit yang sudah ada.
2. Uji di lingkungan terisolasi dengan D1, antrean, kredensial FCM, dan langganan VAPID uji. Aktifkan pengiriman hanya pada basis data uji. Daftarkan perangkat Android dan browser/PWA, termasuk browser yang dipakai bergantian oleh dua akun. Periksa ketiga tujuan buka, termasuk setelah sesi portal berakhir.
3. Buat jumlah siswa dan perangkat uji yang setara dengan volume siswa aktif produksi. Jalankan sasaran Semua. Di Cloudflare amati CPU time consumer, backlog, retry, dan dead-letter queue. Cocokkan log `dspt_notice_work_completed` / `dspt_notice_work_failed` dengan riwayat pengiriman. Syarat lulus adalah antrean selesai, tidak ada `exceededCpu`, dan p95 CPU time di bawah separuh batas Worker yang berlaku. Durasi log per pekerjaan adalah waktu dinding, sehingga metrik CPU tetap diambil dari Cloudflare.
4. Setelah lulus, aktifkan pengiriman dengan perubahan pengaturan yang tercatat berikut. Sebelum aktif, Bendahara dapat menyiapkan templat dan memeriksa pratinjau.

```sql
INSERT INTO system_settings (key, value, updated_at)
VALUES ('keuangan_dspt_notifikasi_enabled', '1', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
```

Untuk menahan konfirmasi baru, ubah nilai menjadi `0`. Pengiriman yang sudah dikonfirmasi tetap diproses. Jika perlu menahan antrean bersama, perhitungkan dampaknya pada notifikasi lain. Pertahankan tabel, riwayat, dan pekerjaan yang sudah diterima. Periksa kegagalan di riwayat dan dead-letter queue sebelum mengulang pengiriman, agar penerima yang sudah mendapat push tidak dikirimi ulang.
