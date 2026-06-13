# Fonts untuk PDF (Browser Rendering)

Template PDF (Nilai Harian, CKH) pakai `@font-face` ke file di folder ini.
Copy file font asli dari `C:\Windows\Fonts` ke sini dengan **nama persis** berikut:

| File wajib    | Sumber Windows         | Dipakai            |
|---------------|------------------------|--------------------|
| `times.ttf`   | Times New Roman Regular | Nilai Harian (rekap) |
| `timesbd.ttf` | Times New Roman Bold    | Nilai Harian (rekap) |
| `tahoma.ttf`  | Tahoma Regular          | CKH                 |
| `tahomabd.ttf`| Tahoma Bold             | CKH                 |

Format `.ttf` mentah dari Windows langsung jalan (tak perlu convert ke woff2).

Setelah file ditaruh, commit + deploy. Font di-serve sebagai static asset dan
dimuat headless Chromium saat render PDF, jadi hasil 100% sama dengan cetak lama.

> Catatan lisensi: font Microsoft (Tahoma/Times New Roman) proprietary.
> Embedding di app internal sekolah = tanggung jawab pemilik lisensi Windows.
