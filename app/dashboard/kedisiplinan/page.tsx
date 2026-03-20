// Lokasi: app/dashboard/kedisiplinan/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { ShieldAlert, CalendarDays } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { KedisiplinanClient } from './components/kedisiplinan-client'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Kedisiplinan & Tata Tertib - MANSATAS App' }

async function KedisiplinanDataFetcher({ currentUser, taAktifId }: { currentUser: any, taAktifId: string }) {
  const db = await getDB()

  // FIX: Hapus query semua siswa aktif — siswa dicari via searchSiswa() lazy action
  const [kasusResult, masterResult] = await Promise.all([
    db.prepare(`
      SELECT sp.id, sp.tanggal, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, k.kelompok,
        mp.nama_pelanggaran, mp.poin, u.nama_lengkap as pelapor_nama
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      LEFT JOIN "user" u ON sp.diinput_oleh = u.id
      WHERE sp.tahun_ajaran_id = ?
      ORDER BY sp.tanggal DESC, sp.created_at DESC
      LIMIT 50
    `).bind(taAktifId).all<any>(),
    db.prepare(`SELECT id, kategori, nama_pelanggaran, poin FROM master_pelanggaran ORDER BY poin ASC`).all<any>()
  ])

  const formattedKasus = (kasusResult.results || []).map((p: any) => ({
    id: p.id, tanggal: p.tanggal, keterangan: p.keterangan, foto_url: p.foto_url,
    siswa_id: p.siswa_id, master_pelanggaran_id: p.master_pelanggaran_id, diinput_oleh: p.diinput_oleh,
    siswa: { nama_lengkap: p.siswa_nama, kelas: p.tingkat ? { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok } : null },
    master_pelanggaran: { nama_pelanggaran: p.nama_pelanggaran, poin: p.poin },
    pelapor: { nama_lengkap: p.pelapor_nama }
  }))

  return <KedisiplinanClient currentUser={currentUser} kasusList={formattedKasus} masterList={masterResult.results || []} />
}

export default async function KedisiplinanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? 'guru'
  const currentUser = { id: user.id, role, nama: (user as any).nama_lengkap ?? user.name ?? '' }

  const db = await getDB()
  const taAktif = await db.prepare('SELECT id, nama FROM tahun_ajaran WHERE is_active = 1').first<any>()
  if (!taAktif) return <div className="p-8 text-center text-rose-500 font-bold bg-rose-50 rounded-xl m-8">Tahun Ajaran aktif belum diatur oleh Admin. Hubungi Tata Usaha.</div>

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Kedisiplinan & Tata Tertib"
        description="Catat pelanggaran siswa, pantau akumulasi poin, dan lampirkan bukti."
        icon={ShieldAlert}
        iconColor="text-rose-500"
      >
        <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-slate-200 px-2.5 py-1 rounded-md bg-slate-50">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>TA: <strong className="text-slate-800 dark:text-slate-100 font-semibold">{taAktif.nama}</strong></span>
        </div>
      </PageHeader>
      <Suspense fallback={
<PageLoading text="Memuat data kedisiplinan..." />
      }>
        <KedisiplinanDataFetcher currentUser={currentUser} taAktifId={taAktif.id} />
      </Suspense>
    </div>
  )
}