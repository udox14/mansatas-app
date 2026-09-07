# MANSATAS Android 1.0.7 (version code 8)

## Perubahan

- **Perbaikan Masalah Standby / Background**: Mencegah WebView Chromium terlempar ke layar error sistem 
et::ERR_FAILED saat aplikasi dibuka kembali dari mode tidur / standby.
- **Auto-Recovery WebView**: Menambahkan WebViewListener dan deteksi onResume di MainActivity yang secara otomatis memuat ulang URL terakhir yang valid ketika jaringan kembali tersedia.
- **Auto-Reconnect Jaringan**: Mendaftarkan ConnectivityManager.NetworkCallback untuk mendeteksi kapan perangkat kembali terhubung ke internet dan segera me-reload WebView tanpa pengguna harus menutup paksa aplikasi.
- **Offline Fallback Lokal**: Mengonfigurasi server.errorPath = 'offline.html' pada capacitor.config.ts agar jika server tidak terjangkau, WebView memuat halaman offline lokal yang informatif dengan tombol *Coba Lagi* dan auto-retry saat online.
- **Ketahanan Low Memory / Renderer Process**: Mengimplementasikan penanganan onRenderProcessGone di MainActivity agar aplikasi tidak langsung force close/crash ketika OS Android membersihkan memori proses render di background.
- **Perbaikan Service Worker & Layout**: Menghentikan auto-reload buta pada controllerchange di background/offline/aplikasi native, dan memperbarui response offline Service Worker berstatus 200 OK.

## Upload Play Console

Gunakan AAB versi 1.0.7 / code 8 (MANSATAS-1.0.7-vc8.aab) dan catatan dalam play-store-notes-id.txt.
Pastikan code 8 belum dipakai oleh rilis lain di Play Console.

## Hasil validasi build

- undleRelease: berhasil, termasuk R8 dan lint vital.
- jarsigner -verify: jar verified; sertifikat SHA-256 cocok dengan keystore rilis resmi.
- Konfigurasi server.errorPath=offline.html dan ACCESS_NETWORK_STATE terverifikasi di dalam AAB.
- Manifest hasil build memuat version code 8 dan version name 1.0.7.
- SHA-256 AAB: D6DA5BBEFF3FC5FE9BF423601107E250A35BEB2142AE653E27A602C100E5536F.
