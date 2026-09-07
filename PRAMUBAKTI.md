# Modul Pramubakti

## Aktivasi

Jalankan `migrations/0096_pramubakti.sql` pada database tujuan **sebelum** merilis kode aplikasi ini. Migrasi menambahkan tabel, masa kepesertaan melalui trigger perubahan role, pilihan pekerjaan, template CKH, dan izin fitur. Migrasi tidak membuat jadwal atau kewajiban historis.

Admin membuka **Pengaturan Pramubakti**, menetapkan hari/rentang jam bersama, lalu menyimpan tanggal berlaku mulai besok. Jadwal kosong berarti tidak ada kewajiban. Versi mendatang pada tanggal yang sama dapat diganti sebelum berlaku; versi lama dipertahankan. Libur khusus juga diatur sebelum tanggalnya berlangsung.

Pembatasan slot, pengaktifan telat, dan batas menit default mengikuti **Perilaku Input Guru dan Pramubakti** di Pengaturan Sistem. Batas per jam pelajaran hanya digunakan guru. Semua tanggal/waktu pelaporan memakai WIB.

## Akses dan pencatatan

- Pramubakti: laporan serta riwayat sendiri, CKH Generator, dan kartu performa.
- Wakamad dengan `jabatan_struktural_id = jbt_waka_sarpras`: monitoring, cetak, izin/sakit, dan koreksi laporan.
- Super Admin/Admin TU: monitoring dan pengaturan. Kepala Madrasah: baca/cetak monitoring.
- Hak CRUD tetap mengikuti konfigurasi fitur; pemeriksaan jabatan dan kepemilikan juga diterapkan di server dan akses foto.

Setiap slot wajib menerima satu laporan. Laporan tambahan memakai identitas pengiriman tersendiri dan dapat diisi kapan saja pada hari ini, termasuk libur. Pekerjaan, tempat, dan foto wajib. Pengiriman ulang identitas yang sama tidak menggandakan laporan.

Foto tersimpan melalui jalur media privat `pramubakti/<user_id>/...`. Nama pekerjaan disimpan sebagai snapshot JSON agar penggantian opsi admin tidak mengubah sejarah. Koreksi mempertahankan foto dan waktu pengiriman asli; setiap perubahan memiliki alasan, pelaku, serta nilai sebelum/sesudah di `pb_audit`.

Izin/sakit dapat diterapkan per slot atau rentang tanggal. Laporan hadir yang sudah ada membutuhkan konfirmasi koreksi eksplisit. Membatalkan izin mengembalikan status berdasarkan bukti laporan; tanpa laporan, slot yang berakhir menjadi alfa.

## Performa dan CKH

Pelaporan, monitoring, cetak, dan dashboard menggunakan `buildPbItems` dan `summarizePb`. Tepat waktu dan telat dihitung hadir. Izin sekolah mendapat kredit penuh; izin biasa/sakit tidak, kecuali pilihan kebijakan alternatif pada cetakan. Tambahan dan slot belum selesai tidak masuk penyebut.

CKH menghasilkan satu baris ber-volume 1 Kegiatan per laporan, dengan identitas `pramubakti:<id>`. Tanggal digabung oleh renderer CKH yang sudah ada. Pola Harian tidak berlaku bagi pemilik ber-role Pramubakti. Hari kerja berasal dari jadwal khusus dan tanggal laporan tambahan; hari yang seluruh slotnya izin/sakit tidak menuntut kegiatan fiktif.

Draft disinkronkan ketika dibuka atau melalui tombol sinkronisasi. Baris manual tidak ditimpa; perubahan sumber ditandai konflik. Jika sumber dikecualikan akibat izin/sakit, menerima konflik menghapus baris tersebut. Membuka dokumen final tidak mengubahnya; sinkronisasi eksplisit mengikuti alur kembali ke draft.

## Verifikasi

Pengujian menggunakan SQLite sementara (termasuk migrasi/trigger sebenarnya), Vitest untuk tindakan server dan CKH, lint terarah, serta TypeScript tanpa emit. UI diuji dengan data fixture lokal pada viewport 390 piksel dan desktop. Fixture bukan database produksi. Pengambilan foto pada perangkat fisik Android serta hasil printer fisik tetap memerlukan uji perangkat saat rilis.
