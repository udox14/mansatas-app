# Checklist pengujian perangkat Android

Isi perangkat, versi Android, akun penguji, hasil, dan bukti singkat untuk setiap
putaran. Gunakan sekurangnya Android 10, Android 13, dan Android 15/16 bila tersedia.

## Instalasi dan akun

- [ ] Instal dari Internal Testing Play Store, bukan hanya sideload APK.
- [ ] Splash dan ikon tampil benar; tidak terpotong pada launcher bulat/themed.
- [ ] Login pegawai berhasil.
- [ ] Login orang tua/wali berhasil.
- [ ] Akun salah menampilkan pesan tanpa crash.
- [ ] Logout menghentikan sesi dan notifikasi akun sebelumnya.
- [ ] Berpindah akun tidak memperlihatkan cache/data akun lama.

## PDF, file, dan berbagi

- [ ] Nilai Harian: PDF tersimpan di `Downloads/MANSATAS` dan dapat dibuka.
- [ ] CKH: PDF POST tersimpan dengan nama yang benar.
- [ ] Absensi Guru dan Ekskul: PDF dapat dibuka/cetak.
- [ ] Lampiran PDF memakai nama/ekstensi asli dari server.
- [ ] Share ke WhatsApp, Drive, Gmail, dan aplikasi PDF berhasil.
- [ ] File besar menampilkan kegagalan yang jelas, bukan layar diam.
- [ ] Upload foto kamera/galeri berhasil.
- [ ] Upload PDF, Excel, Word, dan tanda tangan berhasil sesuai fitur.

## Notifikasi

- [ ] Izin notifikasi baru muncul setelah pengguna masuk.
- [ ] Token muncul pada diagnostik mobile app.
- [ ] Test FCM sampai saat aplikasi foreground.
- [ ] Test FCM sampai saat aplikasi background/ditutup.
- [ ] Mengetuk notifikasi membuka halaman tujuan.
- [ ] Token perangkat tercabut setelah logout.
- [ ] Login kembali mendaftarkan token untuk akun baru.

## Jaringan dan lifecycle

- [ ] Domain produksi membuka login tanpa cleartext HTTP.
- [ ] Saat offline tampil halaman/banner aman tanpa data akun lama.
- [ ] Kembali online memulihkan aplikasi.
- [ ] Tombol Back mengikuti riwayat dan keluar sesuai pengaturan.
- [ ] Rotasi layar dan resume dari background tidak mereset input penting.
- [ ] Link eksternal terbuka di browser native.

## Keamanan dan privasi

- [ ] `/privacy` dapat dibuka tanpa login.
- [ ] `/data-deletion` dapat dibuka tanpa login dan email request terbentuk.
- [ ] Permission Android hanya meminta notifikasi/kamera ketika relevan.
- [ ] Tidak ada permission lokasi atau storage “All files access”.
- [ ] Akun demo reviewer dapat mengakses fitur utama tanpa OTP/lokasi khusus.

## Play Console

- [ ] Pre-launch report tidak menunjukkan crash/ANR.
- [ ] App Bundle Explorer menyatakan dukungan 16 KB.
- [ ] Target API dan device catalog sesuai.
- [ ] Data Safety, App access, Content rating, Ads, Target audience, dan Health
      declaration selesai.
