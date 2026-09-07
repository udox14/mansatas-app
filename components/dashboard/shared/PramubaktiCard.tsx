import Link from 'next/link'
import { getDB } from '@/utils/db-server'
import { getPbData } from '@/lib/pramubakti-db'
import { summarizePb } from '@/lib/pramubakti'
import { todayWIB } from '@/lib/time'
import { PbDetails } from '@/components/pramubakti/report-details'

export async function PramubaktiCard({ userId }: { userId: string }) {
  const today = todayWIB()
  const data = await getPbData(await getDB(), today.slice(0, 7) + '-01', today, userId)
  const summary = summarizePb(data.items)
  const slots = data.items.filter(i => i.tanggal === today && i.slot && i.status !== 'TAMBAHAN')
  const done = slots.filter(i => i.report || i.leave).length
  return <section className="mb-4 space-y-4 rounded-xl border border-surface bg-surface p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Performa Pramubakti</h2><p className="text-xs text-slate-500">Bulan {today.slice(0, 7)} · {done}/{slots.length} slot hari ini terselesaikan</p></div><strong className="text-2xl text-emerald-600">{summary.performance === null ? '—' : `${summary.performance}%`}</strong></div><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{[['Hadir', summary.hadir], ['Telat', summary.telat], ['Sakit', summary.sakit], ['Izin biasa', summary.izin - summary.izinSekolah], ['Izin sekolah', summary.izinSekolah], ['Alfa', summary.alfa]].map(([label, value]) => <div key={label}><p className="text-lg font-semibold">{value}</p><p className="text-xs text-slate-500">{label}</p></div>)}</div><p className="text-sm text-slate-500">{summary.tambahan} laporan tambahan bulan ini · {summary.belum} slot belum selesai. Tambahan tidak memengaruhi persentase.</p><div className="flex gap-4 text-sm text-emerald-700"><Link href="/dashboard/pelaporan-pramubakti" className="underline">Isi laporan / riwayat</Link><Link href="/dashboard/ckh-generator" className="underline">CKH Generator</Link></div><details><summary className="cursor-pointer text-sm">Rincian ketidakhadiran bulan ini</summary><div className="mt-3"><PbDetails items={data.items.filter(i => ['IZIN', 'SAKIT', 'ALFA'].includes(i.status))} /></div></details></section>
}
