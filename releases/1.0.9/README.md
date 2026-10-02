# MANSATAS Android 1.0.9 (versionCode 10)

- AAB: `MANSATAS-1.0.9-vc10.aab`
- Package: `com.mansatas.app`
- Catatan Play Store: `whats-new-id.txt`
- Tanggal build: 2 Oktober 2026
- SHA-256 AAB: `F8D1CEFB0E1813D6854D53FCA404A827780C85D021FAE391DE92E3969E3CCE12`

## Validasi

- `npm run android:build:bundle`: berhasil, termasuk R8 dan lint vital.
- `jarsigner -verify`: `jar verified`.
- Fingerprint SHA-256 sertifikat signing cocok dengan AAB 1.0.8/code 9: `89:65:3B:D5:92:7A:D4:C2:EE:B0:91:B6:89:EA:70:6C:B4:D8:01:E4:75:85:90:C6:C4:2E:92:55:31:1E:6A:C1`.
- Manifest protobuf di dalam AAB diperiksa: package `com.mansatas.app`, versionName `1.0.9`, versionCode `10`.
- Konfigurasi di dalam AAB diperiksa: server `https://app.mansatas.com/`, errorPath `offline.html`.
- Catatan Bahasa Indonesia: 320 karakter di luar tag bahasa.

## Cakupan dan rilis

Kode native memperbaiki reload form ketika kembali dari kamera setelah error subresource/API. File AAB sudah disalin ke folder ini; belum diunggah ke Play Console. Nomor versi mengikuti versi terakhir di repository; status penggunaan code 10 di Play Console belum diperiksa.

Perbaikan draft, retry, konfirmasi agenda tersimpan, pembaruan status, dan pesan error berada pada server/web yang dimuat dari URL produksi. Perubahan web/API tersebut perlu dideploy sebelum catatan rilis ini dipublikasikan agar seluruh manfaat yang disebutkan tersedia. AAB tidak menyertakan bundle Next.js aplikasi web.

Uji kamera, putus jaringan/retry, dan pemulihan proses di perangkat fisik masih diperlukan. Detail audit ada di `docs/AGENDA_CAMERA_RECOVERY.md`.
