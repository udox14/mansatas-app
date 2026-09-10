# MANSATAS Android 1.0.8 (version code 9)

## Perubahan

- **Perbaikan Masalah Standby / Background (Android)**: Mencegah WebView Chromium terlempar ke layar error sistem `net::ERR_FAILED` saat aplikasi dibuka kembali dari mode tidur / standby.
- **Auto-Recovery & Auto-Reconnect (Android)**: WebView otomatis memuat ulang saat aplikasi kembali dibuka atau saat internet tersambung kembali via `ConnectivityManager.NetworkCallback`.
- **Ketahanan Memori & Offline Fallback (Android)**: Penanganan `onRenderProcessGone` dan konfigurasi fallback lokal `offline.html` tanpa ketergantungan jaringan.
- **Dashboard & Pintasan Cepat**: Penambahan sistem manajemen pintasan (shortcuts) pada dashboard dan pembaruan tata letak kartu ringkasan.
- **Modul Pramubakti Terintegrasi**: Dashboard tugas harian, pelaporan aktivitas kerja dengan kompresi foto & watermark otomatis, serta monitoring KPI.
- **Keuangan & Komite Madrasah**: Manajemen arus kas (cashflow), halaman nonaktif DSPT & SPP, serta ekspor laporan keuangan (HTML & XLSX) dengan caching data yang lebih cepat.
- **Cetak Dokumen & Presensi**: Perbaikan tata letak & margin cetak dokumen TPG/CKH, footer verifikasi dokumen otomatis, dan optimasi metrik presensi guru.

## Upload Play Console

Gunakan AAB versi 1.0.8 / code 9 (MANSATAS-1.0.8-vc9.aab) dan catatan dalam play-store-notes-id.txt.
Pastikan code 9 belum dipakai oleh rilis lain di Play Console.

## Hasil validasi build

- undleRelease: berhasil, termasuk R8 dan lint vital.
- jarsigner -verify: jar verified; sertifikat SHA-256 cocok dengan keystore rilis resmi.
- Konfigurasi server.errorPath=offline.html dan ACCESS_NETWORK_STATE terverifikasi di dalam AAB.
- Manifest hasil build memuat version code 9 dan version name 1.0.8.
- SHA-256 AAB: C60DB7DE2A3BCB5C0C968B182FE3D9144FA54C51C65C50CF582D7A6F81D440E1.
