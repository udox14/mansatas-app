# Izin guru untuk kepentingan sekolah

## Penggunaan

1. Super admin membuka **Monitoring Penugasan** atau **Rekap Kehadiran Guru**, lalu **Kelola Alasan Izin Guru**.
2. Tambahkan alasan, misalnya Rapat atau Bimbingan. Aktifkan **Kepentingan Sekolah** jika alasan tersebut mendapat kredit performa.
3. Guru memilih **Izin**, memilih alasan aktif, dan mengisi deskripsi saat mengirim tugas. Sakit tetap memakai alur sebelumnya.
4. Untuk data lama, pilih izin pada monitoring lalu **Atur alasan izin**. Satu atau beberapa izin dapat diperbarui sekaligus (maksimal 100). Pada Monitoring Penugasan perubahan berlaku bagi semua kelas dalam delegasi; pada Rekap Kehadiran Guru perubahan berlaku per sesi yang dipilih.

Kategori mengikuti master secara langsung. Mengubah kategori master memperbarui perhitungan historis setelah data dimuat ulang. Menonaktifkan alasan menghentikan pilihan baru tanpa mengubah kategori izin lama. Deskripsi tidak dihapus saat pemetaan.

## Aturan data dan performa

- Status dasar tetap `IZIN`. Referensi alasan pada agenda didahulukan atas alasan delegasi. Jika agenda belum memiliki referensi, alasan delegasi dipakai. Status selain `IZIN` tidak mendapat kredit sekolah.
- Izin lama tanpa referensi tetap izin biasa. Tidak ada pencocokan otomatis dari teks deskripsi.
- Total izin = izin biasa + izin sekolah. Jumlah hadir tidak ditambah.
- Performa dashboard = `(hadir + izin sekolah) / total sesi × 100%`, dibulatkan ke bilangan bulat. Contoh 8 hadir + 1 izin sekolah + 1 alfa menghasilkan 90%.
- Kebijakan cetak yang mengecualikan sakit/izin biasa memberi kredit kepada semua izin sekali saja. Izin sekolah mendapat kredit pada kedua kebijakan cetak.
- Kepatuhan pengisian dan kehadiran fisik tetap merupakan metrik berbeda. Ringkasan kewajiban agenda menampilkan jumlah agenda terisi dan izin sekolah secara terpisah.
- Cetak monitoring menampilkan alasan dan kategori; Agenda Kelas memakai **IS** dengan legenda pada tampilan, Word, dan Excel.
- Perubahan master, pemetaan, dan koreksi status agenda tercatat dalam `izin_guru_audit`. Hak pengelolaan master/pemetaan diperiksa di server, termasuk role tambahan super admin.

## Urutan rilis

1. Terapkan `migrations/0094_teacher_leave_reasons.sql` pada database tujuan **sebelum** merilis kode ini. Migrasi bersifat aditif: master, referensi nullable pada agenda/delegasi, indeks, audit, dan satu alasan awal “Izin lainnya”. Jalankan sekali melalui proses migrasi lingkungan tujuan.
2. Rilis kode setelah migrasi berhasil. Tidak ada pengubahan kategori produksi otomatis dan tidak ada kewajiban memetakan seluruh data lama saat rilis.
3. Masuk sebagai super admin, tambahkan alasan sekolah yang diperlukan, lalu petakan izin historis sesuai keputusan sekolah. Cek guru/periode yang sama di dashboard, monitoring, dan cetak.

Pengujian migrasi menggunakan SQLite sementara di memori, tanpa mengubah database produksi. Migrasi produksi dan deployment merupakan langkah rilis terpisah. Bila aplikasi perlu dikembalikan ke versi sebelumnya, tabel/kolom tambahan dapat tetap disimpan agar riwayat pemetaan tidak hilang.

## Verifikasi pengembang

`npx vitest run lib/teacher-leave.test.ts lib/teacher-leave-export.test.ts lib/teacher-attendance.test.ts app/dashboard/monitoring-agenda/print-summary.test.ts`

Tes mencakup migrasi nyata, kategori retroaktif, penonaktifan, pemetaan satu/multi-kelas, prioritas agenda, deskripsi historis, pembatasan akses server, serta kesamaan hasil query dashboard/harian/rekap/cetak. Ekspor diuji melalui dokumen Word dan workbook Excel yang dihasilkan. Ikuti batasan validasi Next.js dalam AGENTS.md.
