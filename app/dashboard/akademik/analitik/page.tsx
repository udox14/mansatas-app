// Lokasi: app/dashboard/akademik/analitik/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { PengaturanPanel } from './components/pengaturan-panel'
import { AnalitikClient } from './components/analitik-client'
import { LineChart, Loader2 } from 'lucide-react'
import { getDaftarMapelCached } from '@/utils/cache'

export const metadata = { title: 'Analitik Kelulusan - MANSATAS App' }

async function AnalitikDataFetcher() {
  const db = await getDB()

  // FIX: Gunakan cache untuk daftar mapel — tidak query ulang setiap buka halaman
  const [pengaturan, mapelList, siswaResult] = await Promise.all([
    db
      .prepare("SELECT * FROM pengaturan_akademik WHERE id = 'global'")
      .first<any>(),
    getDaftarMapelCached(),
    // Hanya ambil siswa kelas 12 aktif + nilai — bukan semua siswa
    db
      .prepare(
        `SELECT s.id, s.nisn, s.nama_lengkap, s.kelas_id,
          k.tingkat, k.kelompok, k.nomor_kelas,
          rn.nilai_smt1, rn.nilai_smt2, rn.nilai_smt3, rn.nilai_smt4, rn.nilai_smt5, rn.nilai_um
         FROM siswa s
         JOIN kelas k ON s.kelas_id = k.id
         LEFT JOIN rekap_nilai_akademik rn ON rn.siswa_id = s.id
         WHERE k.tingkat = 12 AND s.status = 'aktif'
         ORDER BY s.nama_lengkap`
      )
      .all<any>(),
  ])

  const parsedPengaturan = pengaturan
    ? {
        ...pengaturan,
        mapel_snbp: parseJsonCol(pengaturan.mapel_snbp, []),
        mapel_span: parseJsonCol(pengaturan.mapel_span, []),
        daftar_jurusan: parseJsonCol(pengaturan.daftar_jurusan, [
          'MIPA',
          'SOSHUM',
          'KEAGAMAAN',
          'UMUM',
        ]),
      }
    : null

  const dataSiswa = (siswaResult.results ?? []).map((s: any) => ({
    ...s,
    kelas: { tingkat: s.tingkat, kelompok: s.kelompok, nomor_kelas: s.nomor_kelas },
    rekap_nilai_akademik: {
      nilai_smt1: parseJsonCol(s.nilai_smt1, null),
      nilai_smt2: parseJsonCol(s.nilai_smt2, null),
      nilai_smt3: parseJsonCol(s.nilai_smt3, null),
      nilai_smt4: parseJsonCol(s.nilai_smt4, null),
      nilai_smt5: parseJsonCol(s.nilai_smt5, null),
      nilai_um: parseJsonCol(s.nilai_um, null),
    },
  }))

  return (
    <div className="space-y-6 mt-6">
      <PengaturanPanel pengaturan={parsedPengaturan} mapelList={mapelList} />
      <AnalitikClient dataSiswa={dataSiswa} pengaturan={parsedPengaturan} />
    </div>
  )
}

export default async function AnalitikPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col gap-1.5 border-b border-border pb-5">
        <div className="flex items-center gap-2 text-foreground">
          <LineChart className="h-6 w-6 text-muted-foreground" strokeWidth={2.5} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Analitik Kelulusan & SNBP
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Data Warehouse nilai dari RDM. Penghitungan otomatis kuota Eligible SNBP 40% &
          SPAN-PTKIN.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground space-y-4 rounded-lg border border-dashed border-border bg-muted/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium tracking-tight">Memuat Data Warehouse RDM...</p>
          </div>
        }
      >
        <AnalitikDataFetcher />
      </Suspense>
    </div>
  )
}
