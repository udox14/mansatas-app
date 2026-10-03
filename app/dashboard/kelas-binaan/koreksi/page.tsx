import Link from 'next/link'
import { getKoreksiAbsensiCepat } from '../attendance-actions'
import { QuickAttendanceCorrection } from './quick-correction'

export const metadata = { title: 'Koreksi Kehadiran - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function QuickAttendancePage({ searchParams }: { searchParams: Promise<{ siswa?: string; tanggal?: string; penugasan?: string }> }) {
  const params = await searchParams
  const result = await getKoreksiAbsensiCepat(params.siswa || '', params.tanggal || '', params.penugasan || '')
  return <div className="mx-auto w-full max-w-xl space-y-4 pb-8">
    <div><h1 className="text-xl font-semibold">Koreksi Kehadiran</h1><p className="mt-1 text-sm text-muted-foreground">Periksa catatan siswa dan simpan koreksi bila diperlukan.</p></div>
    {result.data ? <QuickAttendanceCorrection key={`${result.data.userId}:${result.data.siswaId}:${result.data.tanggal}:${result.data.penugasanId}:${result.data.revision}`} data={result.data} /> : <p role="alert" className="rounded-lg border p-4 text-sm">{result.error}</p>}
    <Link className="inline-block text-sm font-medium text-purple-700 hover:underline" href={result.data ? `/dashboard/kelas-binaan?kelas=${encodeURIComponent(result.data.kelasId)}&view=keputusan&tanggal=${result.data.tanggal}` : '/dashboard/kelas-binaan'}>Lihat Kehadiran Harian</Link>
  </div>
}
