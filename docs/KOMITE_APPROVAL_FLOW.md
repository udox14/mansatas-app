# Alur Persetujuan Pengajuan Komite

- Default: Bendahara → Ketua Komite (atau delegasinya) → SPB.
- Super Admin dapat mengaktifkan `Wajib persetujuan Kepala Madrasah` pada `/dashboard/komite/pengajuan`. Menggunakan tabel `system_settings` existing, key `komite_require_principal_approval`, default `0`.
- Pengaturan dibaca server saat review Ketua diproses; nominal dan hak review tetap mengikuti validasi existing. Tahap Bendahara tidak dilewati.
- Ketika persetujuan final disimpan, `approved_at` dan `final_approval_stage` disimpan dalam batch yang sama dengan riwayat review. SPB mengikuti tahap final yang tersimpan, bukan pengaturan saat dokumen diunduh.
- Pengajuan yang sudah `menunggu_kepala` tetap diselesaikan Kepala. Perubahan pengaturan tidak otomatis mengesahkan, mengembalikan, atau mengubah riwayat pengajuan tersebut.
- Pengecualian atas permintaan eksplisit Komite tanggal 6 Oktober 2026: SPB 014 dan 015 difinalisasi berdasarkan review Bendahara dan Ketua versi aktif yang sudah tercatat. Operasi terarah ada di `scripts/finalize-komite-spb-014-015.sql`, dengan validasi dua ID, nomor SPB, nominal, versi, timestamp, dan jumlah rincian. Kedua pengajuan berubah bersama atau tidak berubah sama sekali. Catatan audit dibuat atomik bersama perubahan status; tidak ada review Kepala yang ditambahkan, perubahan nominal, atau pencairan dana. `approved_at` mencatat waktu finalisasi, sementara tanggal persetujuan Ketua tetap tersimpan pada review existing.
- Data historis tanpa `final_approval_stage` dianggap mengikuti alur lama tiga tahap untuk validasi SPB.
- Notifikasi final menyebut tahap persetujuan aktual. Dalam alur dua tahap, tidak ada event permintaan review Kepala atau reminder Kepala untuk pengajuan yang disahkan Ketua.

## Schema dan kompatibilitas

`ensureKomitePengajuanSchema` menambah kolom nullable `final_approval_stage` dengan nilai `ketua` atau `kepala` secara idempotent. Tidak ada penghapusan tabel, kolom, data, atau backfill persetujuan historis.

Untuk kembali ke alur tiga tahap, aktifkan pengaturan melalui UI. Hindari rollback ke kode lama yang mewajibkan tiga persetujuan pada seluruh SPB: dokumen yang sah di alur dua tahap harus tetap dibaca dengan aturan tahap final tersimpan. Kolom dan riwayat harus dipertahankan.
