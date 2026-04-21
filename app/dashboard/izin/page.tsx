// Lokasi: app/dashboard/izin/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { checkFeatureAccess, getPrimaryRole, getUserRoles } from '@/lib/features'
import { IzinClient } from './components/izin-client'
import { IzinWaliKelasClient } from './components/izin-wali-kelas-client'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { todayWIB } from '@/lib/time'
import { getKelasBinaanForIzin, getAlasanIzin } from './actions'

export const metadata = { title: 'Perizinan Siswa - MANSATAS App' }

async function IzinDataFetcher({ currentUserRole, alasanList }: { currentUserRole: string; alasanList: any[] }) {
  const db = await getDB()
  const today = todayWIB()

  const [keluarResult, kelasResult] = await Promise.all([
    db.prepare(`
      SELECT ik.id, ik.waktu_keluar, ik.waktu_kembali, ik.status, ik.keterangan,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, u.nama_lengkap as pelapor_nama
      FROM izin_keluar_komplek ik
      JOIN siswa s ON ik.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN "user" u ON ik.diinput_oleh = u.id
      WHERE ik.status = 'BELUM KEMBALI' OR date(ik.waktu_keluar) = ?
      ORDER BY ik.waktu_keluar DESC
      LIMIT 200
    `).bind(today).all<any>(),
    db.prepare(`
      SELECT itk.id, itk.tanggal, itk.jam_pelajaran, itk.alasan, itk.keterangan,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, u.nama_lengkap as pelapor_nama
      FROM izin_tidak_masuk_kelas itk
      JOIN siswa s ON itk.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN "user" u ON itk.diinput_oleh = u.id
      WHERE itk.tanggal = ?
      ORDER BY itk.created_at DESC
    `).bind(today).all<any>()
  ])

  const filteredKeluar = (keluarResult.results || [])
    .map((k: any) => ({ ...k, siswa: { nama_lengkap: k.siswa_nama, kelas: k.tingkat ? { tingkat: k.tingkat, nomor_kelas: k.nomor_kelas } : null }, pelapor: { nama_lengkap: k.pelapor_nama } }))

  const formattedIzinKelas = (kelasResult.results || []).map((itk: any) => ({
    ...itk,
    jam_pelajaran: parseJsonCol(itk.jam_pelajaran, null) ?? itk.jam_pelajaran,
    siswa: { nama_lengkap: itk.siswa_nama, kelas: itk.tingkat ? { tingkat: itk.tingkat, nomor_kelas: itk.nomor_kelas } : null },
    pelapor: { nama_lengkap: itk.pelapor_nama }
  }))

  return <IzinClient izinKeluarList={filteredKeluar} izinKelasList={formattedIzinKelas} currentUserRole={currentUserRole} initialAlasanList={alasanList} />
}

export const dynamic = 'force-dynamic'
export default async function IzinPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'izin')
  if (!allowed) redirect('/dashboard')

  const roles = await getUserRoles(db, user.id)
  const isWaliKelasOnly = roles.includes('wali_kelas') &&
    !roles.includes('super_admin') &&
    !roles.includes('admin_tu') &&
    !roles.includes('kepsek') &&
    !roles.includes('wakamad') &&
    !roles.includes('guru_bk') &&
    !roles.includes('guru_piket') &&
    !roles.includes('resepsionis')

  const [alasanList] = await Promise.all([getAlasanIzin()])

  if (isWaliKelasOnly) {
    const { kelas, error } = await getKelasBinaanForIzin()
    return (
      <div className="space-y-4 animate-in fade-in duration-500 pb-12">
        <PageHeader title="Perizinan Siswa" description="Input izin tidak masuk kelas untuk siswa kelas binaan Anda." />
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : kelas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Anda belum ditugaskan sebagai wali kelas.</p>
          </div>
        ) : (
          <IzinWaliKelasClient kelasList={kelas} alasanList={alasanList} />
        )}
      </div>
    )
  }

  const role = await getPrimaryRole(db, user.id)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Perizinan Siswa Harian" description="Posko pencatatan siswa keluar komplek dan izin meninggalkan jam pelajaran." />
      <Suspense fallback={<PageLoading text="Memuat data perizinan..." />}>
        <IzinDataFetcher currentUserRole={role} alasanList={alasanList} />
      </Suspense>
    </div>
  )
}