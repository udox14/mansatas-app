import Link from 'next/link'
import { getOwnAttendanceCorrectionResult } from '@/app/dashboard/keterangan-absensi/correction-actions'
import { attendanceStatusLabel } from '@/lib/attendance-status'

export const metadata = { title: 'Hasil Ajuan Koreksi Absensi - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function HasilKoreksiPage({ searchParams }: { searchParams: Promise<{ ajuan?: string }> }) {
  const { ajuan } = await searchParams
  const result = await getOwnAttendanceCorrectionResult(ajuan ?? '')
  const date = result && new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(`${result.tanggal}T00:00:00+07:00`))

  return <section className="mx-auto max-w-xl space-y-3 rounded-lg border bg-surface p-4">
    <h1 className="text-lg font-semibold">Hasil ajuan koreksi absensi</h1>
    {result ? <>
      <p className="text-sm text-muted-foreground">Absensi tanggal {date}</p>
      <p className="font-semibold">{result.status === 'APPROVED'
        ? `Disetujui menjadi ${attendanceStatusLabel(result.proposed)}`
        : `Usulan menjadi ${attendanceStatusLabel(result.proposed)} ditolak`}</p>
    </> : <p role="alert" className="text-sm">Hasil ajuan tidak tersedia.</p>}
    <Link href="/dashboard/kelas-binaan/notifikasi" className="inline-flex min-h-10 items-center text-sm font-medium underline">Kembali ke notifikasi</Link>
  </section>
}
