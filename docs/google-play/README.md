# Google Play release kit — MANSATAS App

Dokumen ini menjadi sumber kerja untuk pengisian Play Console. Jawaban akhir tetap
harus dicocokkan dengan konfigurasi produksi dan praktik operasional MAN 1
Tasikmalaya sebelum dikirim.

## Identitas aplikasi

- Nama: MANSATAS App
- Package: `com.mansatas.app`
- Kategori yang disarankan: Education
- Situs aplikasi: `https://app.mansatas.com/`
- Kebijakan privasi: `https://app.mansatas.com/privacy`
- Penghapusan data: `https://app.mansatas.com/data-deletion`
- Email dukungan: `admin@man1tasikmalaya.sch.id`
- Tidak memuat iklan berdasarkan source aplikasi saat dokumen ini dibuat.

## Urutan rilis

1. Rotasi VAPID key yang pernah berada di Git dan perbarui secret Worker.
2. Deploy source web agar URL privasi/penghapusan tersedia di produksi.
3. Build AAB dengan `npm run android:build:bundle`.
4. Buat aplikasi Play Console dengan package `com.mansatas.app`.
5. Aktifkan Play App Signing dan unggah AAB ke Internal Testing.
6. Isi App access menggunakan akun demo permanen.
7. Jalankan checklist perangkat pada `testing-checklist.md`.
8. Isi deklarasi App content dan Data safety berdasarkan `data-safety-draft.md`.
9. Setelah hasil internal bersih, naikkan `versionCode` dan mulai Closed Testing.

## Tindakan yang membutuhkan pemilik akun/infrastruktur

- memastikan akun Play Console bertipe Organization bila aplikasi diterbitkan
  resmi atas nama madrasah/lembaga pemerintah;
- merotasi dan memasang secret VAPID/FCM di Cloudflare;
- menyediakan akun demo reviewer yang tidak memakai OTP dan tidak kedaluwarsa;
- mengisi target audience sesuai usia pengguna siswa sebenarnya;
- mengunggah listing, screenshot, feature graphic, dan formulir deklarasi;
- menentukan aturan retensi/penghapusan data bersama pimpinan/operator madrasah.
