# MANSATAS — School Management System (MAN 1 Tasikmalaya)

## Stack
Next.js 16 (App Router) · TypeScript · Cloudflare Workers + D1 (SQLite) · Better Auth · Tailwind v3 + shadcn/ui

## Structure
```
app/
  (auth)/login/
  api/auth/[...all]/ · api/logout/
  auth/signout/
  dashboard/
    siswa/[id]/components, components
    guru/components
    kelas/[id]/components, components
    kehadiran/components
    akademik/analitik/components, components
    izin/components
    kedisiplinan/components
    bk/components
    psikotes/components
    plotting/components
    settings/components, profile/components
components/layout/ · components/ui/
config/ · lib/ · utils/auth/
```

## Auth — Better Auth
- Route: `app/api/auth/[...all]/route.ts`
- Pattern: `export const { GET, POST } = toNextJsHandler(auth)`
- **JANGAN modif tabel auth manual** (`user`, `session`, `account`, `verification`)
- User roles: admin · guru · wali_kelas · wali_murid · bk

## Key DB Tables
- `user` — id, email, role, nama_lengkap, avatar_url, banned (Better Auth)
- `tahun_ajaran` — id, nama, semester, is_active, daftar_jurusan(JSON), jam_pelajaran(JSON)
- `kelas` — id, tingkat(1/2/3), nomor_kelas, kelompok(UMUM/MIPA/SOSHUM/KEAGAMAAN), wali_kelas_id
- `siswa` — id, nisn UNIQUE, nama_lengkap, jenis_kelamin(L/P), tempat_tinggal(Non-Pesantren/Pesantren/Pesantren Sukahideng/Pesantren Sukamanah/Pesantren Sukaguru/Pesantren Al-Ma'mur), kelas_id, status(aktif/keluar)
- `mata_pelajaran` — id, nama_mapel UNIQUE, kelompok, tingkat, kategori
- `penugasan_mengajar` — guru_id, mapel_id, kelas_id, tahun_ajaran_id
- `rekap_kehadiran_bulanan` — siswa_id, bulan, tahun_ajaran_id, sakit, izin, alpa · UNIQUE(siswa_id, bulan, tahun_ajaran_id)
- `rekap_nilai_akademik` — siswa_id UNIQUE, nilai_smt1..nilai_smt5(JSON), nilai_um(JSON)
- `jadwal_mengajar` — penugasan_id, hari(1=Senin..6=Sabtu), jam_ke · UNIQUE(penugasan_id, hari, jam_ke)
- `bk_rekaman` — siswa_id, guru_bk_id, tahun_ajaran_id, bidang(Pribadi/Karir/Sosial/Akademik), penanganan(JSON), tindak_lanjut
- `siswa_psikotes` — siswa_id UNIQUE, iq_score, bakat_*, minat_*, riasec, rekom_jurusan, mbti, gaya_belajar
- `siswa_pelanggaran` — siswa_id, master_pelanggaran_id, tahun_ajaran_id, tanggal

## Rules (WAJIB diikuti)
1. **Tailwind v3** — jangan upgrade ke v4
2. **Next.js 16 async cookies** — `await cookies()`
3. **revalidateTag(tag)** — 1 argumen saja, tidak ada options param
4. **Complete file rewrite** — tulis ulang file lengkap, bukan patch
5. **No Node.js built-ins** — Cloudflare Workers runtime only
6. **Better Auth** — gunakan session dari `auth.api.getSession()`, bukan custom session

## Respond
Komunikasi: **Bahasa Indonesia**. Code & comments: English.
