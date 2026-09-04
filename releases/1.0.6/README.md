# MANSATAS Android 1.0.6 (version code 7)

## Perubahan

- Seluruh WebView diberi padding native berdasarkan gabungan `systemBars`,
  `displayCutout`, dan `ime`, termasuk pada Android sebelum versi 15.
- Penanganan CSS insets otomatis Capacitor dinonaktifkan agar tidak menimpa
  padding native atau menerapkan ruang aman dua kali.
- Keyboard menggunakan `adjustResize`; padding dihitung ulang dari insets terbaru,
  bukan ditambahkan berulang saat rotasi atau keyboard dibuka/ditutup.
- Edge-to-edge tetap aktif sesuai target SDK 36, tetapi konten berada di area aman.
- Tidak memerlukan perubahan atau deployment website.

## Upload Play Console

Gunakan AAB versi 1.0.6 / code 7 dan catatan dalam `play-store-notes-id.txt`.
Pastikan code 7 belum dipakai oleh rilis lain di Play Console.

## Hasil validasi build

- `bundleRelease`: berhasil, termasuk R8 dan lint vital.
- `compileDebugAndroidTestJavaWithJavac`: berhasil; tes regresi siap dijalankan di perangkat.
- `testDebugUnitTest`: berhasil (tes bawaan proyek; bukan pengujian visual insets).
- `lintRelease`: berhasil.
- `jarsigner -verify`: `jar verified`; sertifikat SHA-256 cocok dengan AAB 1.0.5.
  Peringatan self-signed/timestamp dan urutan manifest ZIP tetap dilaporkan jarsigner.
- Konfigurasi `SystemBars.insetsHandling=disable` terverifikasi di dalam AAB.
- Manifest hasil build memuat version code 7, version name 1.0.6, dan `adjustResize`.
- SHA-256 AAB: `3E11E4CC686FEDB5F8BE06FD1C9B8A32AD286A89BE5B7B82BEE1E44744612C5A`.

Referensi penanganan insets:
[Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets).

## Pemeriksaan perangkat sebelum rollout

Belum ada perangkat/emulator terhubung saat perubahan dibuat. Jalankan tes
`SafeContentInsetsTest` dan pemeriksaan visual berikut pada internal testing:

- Android 14 atau lebih lama, Android 15, dan Android 16.
- Navigasi tiga tombol dan navigasi gestur.
- Layar berponi/camera cutout, portrait dan landscape.
- Login, header dashboard, menu bawah, serta dialog/bottom sheet.
- Buka/tutup keyboard pada form; pastikan tidak ada konten tertutup atau padding ganda.
- Tema terang/gelap, kembali dari background, dan rotasi berulang.

Tes instrumentasi sintetis memeriksa nilai padding dan insets yang diteruskan ke
WebView; tes ini tidak menggantikan pemeriksaan visual pada perangkat nyata.
