# Reset data uji coba akademik

> **Rentang reset:** 13 Juli 2026 sampai 16 Juli 2026, inklusif.
> Data Mei-Juni dan tanggal di luar rentang tersebut tidak termasuk target.

Reset yang akan disiapkan hanya menghapus data dalam rentang tanggal uji coba:

1. Agenda guru (`agenda_guru`, serta tabel agenda legacy `jurnal_guru_harian`)
2. Absensi dan keterangan kehadiran
3. Delegasi tugas
4. Nilai harian dan KKM

Reset ini **tidak menghapus** penugasan mengajar, jadwal mengajar, akun, guru,
siswa, kelas, mata pelajaran, tahun ajaran, izin, pelanggaran, SP, keuangan,
PMB, konfigurasi, atau data modul lainnya. `agenda_piket` juga tidak disentuh.

## Prasyarat

- Wrangler sudah memiliki `CLOUDFLARE_API_TOKEN` yang berhak membaca/menulis D1.
- Tidak ada pengguna yang sedang menginput data selama proses reset.

## Urutan eksekusi produksi

Jalankan dari root proyek menggunakan PowerShell.

### 1. Backup penuh

```powershell
$env:WRANGLER_LOG_PATH='C:\tmp\mansatas-wrangler.log'
npx.cmd wrangler d1 export mansatas-db --remote --output "C:\tmp\mansatas-db-before-reset-2026-07-19.sql"
```

### 2. Preview jumlah baris (read-only)

```powershell
npx.cmd wrangler d1 execute mansatas-db --remote --file scripts/reset-uji-coba-akademik-preview.sql
```

Periksa hasilnya. Lanjutkan hanya jika seluruh tabel memang berisi data uji coba.

### 3. Jalankan reset

```powershell
npx.cmd wrangler d1 execute mansatas-db --remote --file scripts/reset-uji-coba-akademik.sql
```

### 4. Verifikasi

Jalankan kembali file preview. Semua jumlah dalam scope harus `0`.

```powershell
npx.cmd wrangler d1 execute mansatas-db --remote --file scripts/reset-uji-coba-akademik-preview.sql
```

## Catatan foto agenda

Baris agenda di D1 terhapus, tetapi file foto uji coba di folder R2 `agenda/`
tidak otomatis terhapus. File tersebut tidak lagi tampil atau direferensikan
aplikasi. Pembersihan R2 harus menjadi tindakan terpisah agar folder lain tidak
ikut tersentuh.
