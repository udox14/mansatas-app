# Security deployment runbook

## Backup encryption recovery

Backup lokal dibuat sebagai file `.aes` menggunakan AES-256-GCM. Kunci acak disimpan
sebagai `backup-key.dpapi`, dilindungi Windows DPAPI untuk akun Windows yang membuat
backup. Untuk pemulihan, buka PowerShell sebagai akun yang sama, pulihkan nilai kunci
dengan `ConvertTo-SecureString`/`NetworkCredential`, tempatkan nilainya sementara di
environment variable `MANSATAS_BACKUP_KEY`, lalu jalankan
`node scripts/backup-crypto.js decrypt <backup.aes> <output>`. Jangan memindahkan file
kunci tanpa juga mempertahankan profil Windows/credential recovery akun tersebut.

Jalankan perubahan ini hanya melalui lingkungan staging lalu gradual rollout. Jangan menjalankan migrasi atau rotasi secret dari endpoint aplikasi.

1. Bekukan merge dan buat backup terenkripsi repository, D1, serta R2 di penyimpanan di luar Git. Catat checksum, waktu, dan operator backup.
2. Ambil snapshot `role_features`, `role_feature_permissions`, user override, dan seluruh kolom URL media. Simpan hasil di lokasi insiden terenkripsi, bukan workspace ini.
3. Terapkan `0084_security_hardening.sql` di staging. Jalankan `scripts/security-permission-preflight.sql`; selesaikan semua baris tanpa C/U/D yang tidak disengaja sebelum mengaktifkan kode fail-closed.
4. Isi secret Worker dengan `wrangler secret put AUTH_RATE_LIMIT_PEPPER` dan `wrangler secret put MEDIA_SIGNING_SECRET`. Pepper dan signing secret harus berbeda dari `BETTER_AUTH_SECRET`.
5. Deploy staging dengan `CSP_ENFORCE=false`. Uji matriks otorisasi staf/orang tua, login throttling, FCM ownership, upload, PDF, cron, dan semua prefix media.
6. Upload versi produksi tanpa mengalihkan seluruh traffic. Naikkan traffic 5%, 25%, lalu 100%; pada setiap tahap pantau error rate, 401/403, latensi login, D1 write, upload, PDF, media, dan cron.
7. Terapkan `0085_migrate_r2_public_urls.sql`, jalankan query preflight di bagian akhir migrasi, dan verifikasi tidak ada referensi `r2.dev`. Setelah proxy stabil, nonaktifkan public development URL bucket dari dashboard/API Cloudflare.
8. Perbaiki seluruh laporan CSP staging, lalu ubah `CSP_ENFORCE=true`. Jangan enforce sebelum alur staf dan orang tua lolos smoke test.
9. Rollback aplikasi dengan deployment Cloudflare sebelumnya. Migrasi bersifat aditif; pertahankan snapshot permission dan URL sampai masa observasi selesai.

Endpoint migrasi aplikasi sengaja menolak produksi. Migrasi produksi hanya boleh dilakukan oleh workflow/operator deployment terautentikasi.
