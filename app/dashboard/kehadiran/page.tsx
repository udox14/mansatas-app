// Lokasi: app/dashboard/kehadiran/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { KehadiranClient } from './components/kehadiran-client'
import { CalendarCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Kehadiran & Jurnal - MANSATAS App' }

async function KehadiranDataFetcher({ profile, isAdmin }: { profile: any, isAdmin: boolean }) {
  const db = await getDB()

  const [taAktif, kelasResult] = await Promise.all([
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1').first<any>(),
    db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas').all<any>()
  ])

  const kelasList = (kelasResult.results || []).sort((a: any, b: any) =>
    `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`.localeCompare(`${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`, undefined, { numeric: true, sensitivity: 'base' })
  )

  let penugasanGuru: any[] = []
  if (taAktif) {
    let query = `
      SELECT pm.id, mp.nama_mapel, k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok, u.nama_lengkap as guru_nama
      FROM penugasan_mengajar pm
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      JOIN kelas k ON pm.kelas_id = k.id
      JOIN "user" u ON pm.guru_id = u.id
      WHERE pm.tahun_ajaran_id = ?
    `
    const params: any[] = [taAktif.id]
    if (!isAdmin) { query += ' AND pm.guru_id = ?'; params.push(profile.id) }

    const res = await db.prepare(query).bind(...params).all<any>()
    penugasanGuru = (res.results || []).sort((a: any, b: any) =>
      `${a.tingkat} ${a.kelompok} ${a.nomor_kelas} ${a.nama_mapel}`.localeCompare(`${b.tingkat} ${b.kelompok} ${b.nomor_kelas} ${b.nama_mapel}`, undefined, { numeric: true, sensitivity: 'base' })
    ).map((p: any) => ({
      id: p.id,
      mapel: { nama_mapel: p.nama_mapel },
      kelas: { id: p.kelas_id, tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok },
      guru: { nama_lengkap: p.guru_nama }
    }))
  }

  return <KehadiranClient currentUser={profile} taAktif={taAktif || null} kelasList={kelasList} penugasanGuru={penugasanGuru} />
}

export default async function KehadiranPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? 'guru'
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(role)
  const profile = { id: user.id, role, nama_lengkap: (user as any).nama_lengkap ?? user.name ?? '' }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Kehadiran & Jurnal"
        description={isAdmin ? 'Rekap bulanan dan pantau jurnal harian seluruh kelas.' : 'Isi jurnal kelas harian dan catat absensi siswa.'}
        icon={CalendarCheck}
        iconColor="text-emerald-500"
      />
      <Suspense fallback={
        <div className="bg-white/50 rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
           <div className="bg-emerald-50 p-5 rounded-full mb-5 border border-emerald-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"></div>
             <CalendarCheck className="h-8 w-8 text-emerald-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menyiapkan Lembar Kehadiran...</h3>
        </div>
      }>
        <KehadiranDataFetcher profile={profile} isAdmin={isAdmin} />
      </Suspense>
    </div>
  )
}