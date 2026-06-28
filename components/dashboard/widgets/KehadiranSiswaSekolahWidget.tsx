// components/dashboard/widgets/KehadiranSiswaSekolahWidget.tsx
// Widget katalog: ringkasan kehadiran siswa se-sekolah hari ini (estimasi).
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { Calendar as CalendarCheck, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { WidgetProps } from '@/lib/dashboard-widgets-meta'

export async function KehadiranSiswaSekolahWidget(_props: WidgetProps) {
  const db = await getDB()
  const today = todayWIB()

  const row = await db.prepare(`
    SELECT
      (SELECT COUNT(DISTINCT siswa_id) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) AS tidak_masuk,
      (SELECT COUNT(*) FROM siswa WHERE status = 'aktif') AS total_siswa
  `).bind(today).first<any>()

  const tidakMasuk = row?.tidak_masuk ?? 0
  const totalSiswa = row?.total_siswa ?? 0
  const hadirEst = Math.max(0, totalSiswa - tidakMasuk)

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
          <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Kehadiran Siswa</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Hari ini · {totalSiswa} siswa aktif</p>
        </div>
        <Link href="/dashboard/rekap-absensi" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
          Rekap <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
        <div className="flex flex-col items-center gap-1 py-5">
          <span className="text-3xl font-bold text-emerald-600 tabular-nums">{hadirEst}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Hadir (estimasi)</span>
        </div>
        <div className="flex flex-col items-center gap-1 py-5">
          <span className="text-3xl font-bold text-rose-500 tabular-nums">{tidakMasuk}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Izin tidak masuk</span>
        </div>
      </div>
      {totalSiswa > 0 && (
        <div className="px-4 py-2 border-t border-surface-2">
          <div className="w-full h-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((hadirEst / totalSiswa) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
