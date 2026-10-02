# Penghapusan Sarpras dan layanan pengiriman WhatsApp

Halaman Sarpras/Kirim WhatsApp, provider WA, webhook, cron WA, serta enqueue ALFA
telah dihapus. Nomor kontak siswa/orang tua/pegawai, tombol buka chat, FCM,
web push, notifikasi dalam aplikasi, reminder jadwal, dan Monitoring Pramubakti
tetap dipertahankan. Migration historis tidak diubah.

## Urutan penerapan

1. Jalankan test, typecheck, security-action check, lint file terkait, dan build Worker.
2. Periksa keenam tabel modul dan schema dependency secara read-only. Tabel yang
   tidak ada boleh dilewati. Periksa JSON navigasi tersimpan sebelum cleanup.
3. Export seluruh database ke file backup di luar Git. Verifikasi export selesai
   dan file tidak kosong; simpan juga arsip tabel WA jika ada catatan pesan.
4. Deploy aplikasi hasil build terlebih dahulu sehingga cron/absensi berhenti
   menghasilkan atau mengirim WA. Jadwal cron dan consumer notification queue tetap aktif.
5. Terapkan `0113_remove_sarpras_whatsapp.sql` sebagai satu transaksi melalui D1
   batch / Wrangler migration. Jangan menjalankan statement terpisah. Jangan
   menjalankan semua migration historis pada produksi tanpa audit migration ledger.
6. Verifikasi keenam tabel serta helper `_retired_module_*` sudah tidak ada,
   metadata fitur/provider sudah bersih, URL lama 404, dan reminder/non-WA sehat.

Migration melakukan pemeriksaan di dalam transaksi sebelum penghapusan: semua
tabel harus kosong; referensi schema eksternal membatalkan cleanup; JSON navigasi
rusak atau root dengan bentuk tidak sesuai juga membatalkan cleanup. Pemeriksaan
dependency lewat teks `sqlite_schema` sengaja konservatif: mention nama tabel
pada objek di luar modul memerlukan review. Tidak ada bypass otomatis.

Konfigurasi navigasi dibersihkan hanya pada array ID fitur (items, hiddenItemIds,
itemPlacements, mobile_nav_links, bottom_nav_override). Grup, label, urutan,
konfigurasi lain, dan record audit dipertahankan. Metadata inti dari migration
sebelumnya harus tersedia. Tabel modul yang sudah hilang dibuat sebagai
placeholder kosong di dalam transaksi lalu dihapus lagi agar rerun aman.

## Temuan preflight produksi — 1 Oktober 2026

Sarpras, kampanye WA, penerima kampanye, dan daily locks kosong. `wa_outbox`
memiliki **3.371 catatan pesan**. Tidak ditemukan dependency schema eksternal;
JSON navigasi tersimpan valid. Pemilik aplikasi kemudian mengizinkan backup dan
arsip pesan sebelum menghapus data serta keenam tabel. Migration default tetap
**menolak** tabel berisi data; persetujuan ini ditangani melalui operasi terpisah.

Catatan pesan adalah data modul WA, terpisah dari `siswa.nomor_whatsapp`,
`user.nomor_whatsapp`, serta kontak bantuan portal dan komite. Penghapusan
catatan pesan tidak menghapus nomor kontak tersebut.

## Cleanup khusus setelah arsip disetujui

Gunakan export khusus `wa_outbox` sebagai input untuk
`scripts/prepare-retired-modules-cleanup.js`. Script hanya menyiapkan SQL dan
tidak mengakses produksi. Verifikator arsip menggunakan Node.js dengan
`node:sqlite`, sesuai runtime test existing.

```powershell
npx wrangler d1 export mansatas-db --remote --output scratch/backups/full.backup.sql
npx wrangler d1 export mansatas-db --remote --table wa_outbox --output scratch/backups/wa-outbox.backup.sql
node scripts/prepare-retired-modules-cleanup.js scratch/backups/wa-outbox.backup.sql scratch/retired-modules-cleanup.sql
```

File yang dihasilkan memuat salinan verifikasi setiap pesan. Jumlah, ID, dan
seluruh isi row di produksi harus sama persis dengan arsip. Pesan baru atau
perubahan setelah export akan membatalkan transaksi; lakukan export ulang dan
review jika terjadi. Hanya outbox yang mendapat pengecualian: data pada lima
tabel lainnya tetap membatalkan seluruh operasi, termasuk purge outbox.

Setelah backup selesai dan deployment baru terverifikasi, terapkan **seluruh
file** melalui `wrangler d1 execute mansatas-db --remote --file ...` (import
atomik). Catat `0113_remove_sarpras_whatsapp.sql` pada ledger `d1_migrations`
yang telah diaudit, dalam file/transaksi yang sama. Jangan commit file arsip,
snapshot kontak, atau SQL hasil generator; semuanya mengandung data pribadi.

Bandingkan snapshot `id, nomor_whatsapp` pada siswa dan pegawai sebelum/sesudah
cleanup, dan verifikasi tidak ada tabel/helper modul tertinggal. Simpan backup
di lokasi aman sebelum membersihkan folder lokal. Panduan perintah:
[Cloudflare D1 Wrangler](https://developers.cloudflare.com/d1/wrangler-commands/).

## Pemulihan

Jika cleanup gagal, transaksi harus rollback dan seluruh data/schema tetap utuh.
Jika perlu memulihkan setelah cleanup berhasil, pulihkan schema/data modul dan
metadata khusus dari backup dahulu, baru rollback deployment. Jangan rollback
aplikasi lama saat tabel WA sudah tidak ada; aplikasi lama dapat membuatnya ulang
atau kembali menghasilkan pesan. Hindari restore seluruh database yang menimpa
transaksi baru pada modul lain setelah waktu backup.

## Hasil penerapan — 1 Oktober 2026

- Deployment: `7d6497e3-eb96-4f34-bb99-cf1e4e7ac791`.
- Cleanup produksi dan pencatatan migration `0113` selesai dalam satu import atomik.
- Keenam tabel, helper cleanup, metadata akses, dan setting provider WA sudah tidak ada.
- Seluruh nomor kontak pada 2.294 siswa dan 169 pegawai identik sebelum/sesudah.
- Kelima URL lama menghasilkan 404; login tetap 200.
- 387 test, typecheck, build Worker, security-action check, dan lint file yang
  diubah lulus. Lint seluruh repo masih gagal pada masalah existing di luar scope.

Backup dan arsip berada di `scratch/backups/` (diabaikan Git). Gunakan
`mansatas-before-module-removal-20261001.verified.backup.sql` untuk restore,
bukan export mentah. Export penuh mentah mengandung INSERT absensi yang tidak
valid; seluruh dataset tabel tersebut diexport ulang dan dimasukkan ke salinan
backup terverifikasi. Export asli tetap disimpan untuk provenance. Tidak ada
record produksi yang diubah untuk memperbaiki export.

Backup terverifikasi berukuran 246.034.302 byte, lulus restore dan SQLite
`quick_check`. Simulasi cleanup pada salinan produksi membuktikan nomor kontak
dan jumlah record pada 27 tabel data bersama tetap utuh. Arsip `wa_outbox`
berisi 3.371 pesan. Ukuran, SHA-256, dan hasil verifikasi tersimpan dalam
`retired-modules-backup-manifest.json`; detail penggantian dataset export ada
pada `backup-export-repair-manifest.json`.
