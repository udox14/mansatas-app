# 🚀 MANSATAS App — Deploy Guide

Panduan deploy MANSATAS App (MAN 1 Tasikmalaya) dari source ini ke Cloudflare Workers.

---

## ⚠️ BACA DULU SEBELUM MULAI

1. **Backup DB production dulu!** Semua langkah di sini aman & non-destructive, tapi backup itu asuransi.
2. Database `mansatas-db` sudah terisi data MAN lama (user, siswa, kelas, dll). Migration ini **hanya menambahkan** tabel/kolom baru, **tidak menghapus** apapun.
3. Kamu harus sudah install: `node >= 18`, `npm`, `wrangler` CLI, dan sudah `wrangler login`.

---

## 📋 Langkah-langkah

### 1. Extract ZIP & install dependency

```bash
unzip mansatas-app.zip
cd mansatas-app
npm install
```

### 2. Backup database production

```bash
wrangler d1 export mansatas-db --remote --output=backup_before_migration.sql
```

File backup akan tersimpan di folder project. Simpan baik-baik.

### 3. Timpa logo placeholder dengan logo asli

```bash
# Copy logo asli Kemenag kamu ke:
cp /path/ke/logokemenag.png public/logokemenag.png
```

File `public/logokemenag.png` saat ini berisi placeholder (copy dari `logo-mss.png` MTs). Ganti sama logo Kemenag / MAN 1 Tasikmalaya yang asli.

Kalau ada file kopsurat MAN 1 Tasikmalaya (untuk print surat), timpa juga:

```bash
cp /path/ke/kopsurat-man.png public/kopsurat.png
```

### 4. Jalankan migration database (WAJIB sebelum deploy!)

```bash
wrangler d1 execute mansatas-db --remote --file=migrations/migration_mts_to_man.sql
```

**Pesan error yang bisa diabaikan:**
- `duplicate column name: xxx` → Kolom sudah ada, skip saja
- `table xxx already exists` → Tabel sudah ada, skip saja

Error lain, stop dan laporkan.

### 5. Verifikasi migration berhasil

```bash
# Cek jumlah role (harus 15)
wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) as total FROM master_roles"

# Cek tabel surat_keluar sudah ada
wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) FROM surat_keluar"

# Cek kelas tingkat 10 sudah dapat Tahfidz auto-assign
wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) as total FROM pu_kelas_unggulan WHERE jenis='TAHFIDZ'"
```

### 6. Build & Deploy

```bash
npm run deploy
```

Tunggu sampai selesai. URL production: `https://mansatas-app.drudox.workers.dev`

### 7. Test login

- Buka `https://mansatas-app.drudox.workers.dev`
- Login dengan user super_admin yang sudah ada (`udox@man1tasikmalaya.sch.id`)
- Pastikan dashboard kebuka, menu sidebar muncul lengkap

### 8. Konfigurasi awal via UI

Setelah login sebagai super_admin, lakukan:

1. **Settings > Profil Sekolah** — update nama, alamat, dll kalau ada yang perlu disesuaikan
2. **Settings > Fitur** — atur permission untuk 4 role baru:
   - `satpam` → recommended: dashboard, buku-tamu
   - `pramubakti` → recommended: dashboard, presensi (sendiri)
   - `operator` → recommended: dashboard, siswa, kelas, kelola-ppl
   - `bendahara_komite` → recommended: dashboard, siswa (view-only)
3. **Pegawai** — tambah pegawai baru dengan role `satpam`, `pramubakti`, `operator`, `bendahara_komite`
4. **Kelas > Tingkat 10** — cek Program Tahfidz sudah auto-attached
5. **Program Unggulan** — assign guru untuk kelas Tahfidz

---

## 🛡️ Rollback (kalau terjadi masalah)

Kalau migration gagal di tengah dan bikin DB corrupt (sangat jarang), restore dari backup:

```bash
# HATI-HATI — ini akan REPLACE semua data!
wrangler d1 execute mansatas-db --remote --file=backup_before_migration.sql
```

Tapi sebelum rollback, cek dulu apakah memang rusak atau cuma error yang bisa diabaikan.

---

## 🧪 Local Development

Untuk test lokal (pakai D1 local, bukan production):

```bash
# Jalankan migration ke local DB
wrangler d1 execute mansatas-db --file=migrations/migration_mts_to_man.sql

# Start dev server
npm run dev
```

Buka `http://localhost:3000`

---

## 📞 Troubleshooting

**Login gagal, error 500:**
- Cek apakah session/account table masih ada: `wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) FROM session"`
- Cek log: `wrangler tail`

**Menu sidebar kosong/aneh:**
- Role user mungkin belum terdaftar di `master_roles`. Cek: `wrangler d1 execute mansatas-db --remote --command="SELECT * FROM master_roles"`
- Harus ada 15 row.

**Foto siswa tidak muncul:**
- R2 public URL sudah benar di `wrangler.toml`: `https://pub-84873e7206c44c4aa6e4aa405b6a8192.r2.dev`
- Cek binding R2 di wrangler.toml: `bucket_name = "mansatas-storage"`

**Modul baru (analitik/tka/penerimaan-pt) error:**
- Pastikan tabel sudah ada setelah migration. Cek: `wrangler d1 execute mansatas-db --remote --command=".tables"` (tapi .tables mungkin gak jalan di d1 cli — pakai SELECT name FROM sqlite_master WHERE type='table')

---

## 🎯 Next Steps (after deploy)

Modul yang **belum lengkap** dan perlu development lanjutan:
- **Keuangan Komite** — modul belum dibuat, sesuai kesepakatan. Bendahara komite sementara cuma bisa login + view siswa.

Laporkan bug / issue ke bos 🚀
