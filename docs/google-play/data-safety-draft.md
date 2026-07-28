# Draf Data Safety

> Draf teknis, bukan pernyataan hukum. Cocokkan dengan data produksi, penyedia
> pihak ketiga, dan prosedur resmi madrasah sebelum disubmit.

## Pernyataan tingkat aplikasi

- Mengumpulkan data pengguna: **Ya**
- Membagikan data kepada pihak ketiga: **Perlu konfirmasi operasional**
- Data dienkripsi saat transit: **Ya**, produksi menggunakan HTTPS
- Pengguna dapat meminta penghapusan: **Ya**
- URL penghapusan: `https://app.mansatas.com/data-deletion`
- URL privacy policy: `https://app.mansatas.com/privacy`
- Iklan: **Tidak ditemukan SDK iklan**

## Jenis data yang kemungkinan perlu dideklarasikan

| Kelompok Play Console | Contoh pada aplikasi | Tujuan umum | Wajib/opsional |
|---|---|---|---|
| Nama | Pegawai, siswa, orang tua/wali | Fungsi aplikasi, manajemen akun | Wajib sesuai peran |
| Alamat email | Login/kontak pegawai | Autentikasi, komunikasi | Wajib pegawai |
| Nomor telepon | WhatsApp/kontak | Komunikasi madrasah | Bergantung peran |
| User ID | ID akun, NISN, ID siswa | Autentikasi dan fungsi aplikasi | Wajib |
| Alamat | Biodata siswa/pegawai | Administrasi pendidikan | Bergantung fitur |
| Foto dan video | Avatar, bukti kegiatan, dokumen foto | Fungsi aplikasi | Opsional/berdasarkan fitur |
| File dan dokumen | PDF, Word, Excel, tanda tangan | Fungsi aplikasi | Opsional/berdasarkan fitur |
| Pesan lain | Saran orang tua, respons, pengumuman | Komunikasi | Opsional |
| Aktivitas aplikasi | Riwayat aksi/audit, presensi, input | Fungsi, keamanan, audit | Umumnya wajib |
| Device/other IDs | Token FCM, informasi perangkat/UA | Notifikasi, keamanan | Opsional untuk notifikasi |
| Informasi keuangan | Administrasi tagihan/bukti pembayaran | Administrasi madrasah | Bergantung peran |
| Lokasi presisi/perkiraan | **Tidak lagi diminta oleh APK** | — | Tidak |

## Catatan pengisian

- “Collected” mencakup data yang dikirim dari perangkat ke server milik madrasah.
- Jangan menyatakan “not collected” hanya karena server dimiliki sendiri.
- Tentukan “shared” berdasarkan hubungan kontraktual dengan Cloudflare, Firebase,
  WhatsApp/provider pesan, dan penyedia lain. Service provider dapat memiliki
  perlakuan berbeda menurut definisi formulir Play.
- Untuk setiap tipe data, pilih tujuan yang benar seperti App functionality,
  Account management, Fraud prevention/security/compliance, atau
  Developer communications.
- Tandai optional hanya jika pengguna tetap dapat memakai fungsi utama tanpa
  memberikan data tersebut.
- Data siswa dan umur target harus konsisten dengan deklarasi Families/Target audience.
