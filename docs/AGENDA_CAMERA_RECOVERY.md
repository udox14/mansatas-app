# Perbaikan Agenda Guru setelah kamera bawaan

## Temuan audit

- `MainActivity` memperlakukan error foto/API sebagai error halaman. Saat kembali dari kamera, aplikasi dapat reload `lastGoodUrl`, yang tidak mengikuti navigasi Next.js, dan kembali ke dashboard.
- Draft belum dipersist dan hasil kamera ketika Android menghentikan proses aplikasi belum ditangani. [Dokumentasi Capacitor](https://capacitorjs.com/docs/apis/camera) menjelaskan perlunya `appRestoredResult`.
- Timeout `Promise.race` tidak menghentikan Server Action. Percobaan berikutnya dapat menunggu antrean pengiriman lama.
- Respons tanpa `error` dianggap berhasil, sementara identitas baris hasil INSERT tidak diperiksa.
- Cache halaman privat dapat menampilkan status agenda lama saat halaman dibuka ulang.
- Decoder gambar mengembalikan file asli saat gagal; exception callback dapat meninggalkan promise pemrosesan belum selesai.

Jalur kegagalan tersebut ditemukan dalam kode. Penyebab setiap laporan historis belum dikonfirmasi melalui log produksi atau reproduksi perangkat. Agenda yang tidak tersimpan tidak direkonstruksi otomatis.

## Perubahan

Pengiriman menggunakan fetch dengan batas 45 detik melalui endpoint yang memakai otorisasi dan validasi `submitAgenda` existing, pemeriksaan origin, dan respons no-store. Keberhasilan wajib menyertakan ID serta status agenda. Retry membaca baris existing berdasarkan unique penugasan/tanggal, tanpa mengganti materi/foto/histori; race INSERT juga ditangani.

Draft materi/foto terkompresi disimpan per identitas guru efektif dan tanggal, kedaluwarsa setelah 24 jam, dan dibersihkan ketika penyimpanan terkonfirmasi. Draft yang dipulihkan memerlukan konfirmasi kirim pengguna. Listener native memulihkan foto dan membuka rute agenda asal. Error subresource tidak lagi memicu reload Android saat resume.

Agenda/monitoring tidak mengambil snapshot service worker, termasuk RSC. Agenda memeriksa status terbaru ketika dibuka atau kembali dari background. Error status, izin/kamera, pembacaan/kompresi foto, penyimpanan draft, koneksi, sesi login, waktu jadwal, respons, upload, dan penyimpanan server ditampilkan dengan langkah lanjutan. Error pengiriman juga tampil dekat tombol retry. Timeout menjelaskan bahwa status penyimpanan belum pasti.

Tidak ada dependency atau migration baru. Perubahan lain yang sudah ada di working tree tidak termasuk task ini.

## Verifikasi dan rilis

Test regresi mencakup acknowledgment kosong, retry setelah timeout, unique-key race, akses penugasan, foto wajib, gagal upload, draft per akun, hasil kamera dipulihkan, decoder macet, fallback encoder PNG, serta cache/offline. Test terkait agenda: 56 test lulus. Typecheck, guard Server Action, dan kompilasi Java Android diperiksa. Lint tidak memiliki error; warning preview img existing masih ada.

Perubahan server/web membutuhkan rilis web. `MainActivity.java` membutuhkan APK/AAB baru; APK lama tidak menerima perubahan Java melalui rilis web.

Uji perangkat sebelum rilis: kamera depan/belakang; batal/izin ditolak; jaringan putus saat upload lalu retry; proses aplikasi dihentikan saat kamera terbuka lalu kembali; buka ulang agenda/monitoring setelah sukses; foto besar/format tak terbaca; penyimpanan penuh; sesi berakhir. Kompilasi tidak menggantikan uji kamera dan lifecycle perangkat fisik. Deployment dan uji perangkat belum dilakukan.
