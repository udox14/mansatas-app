// components/dashboard/ResepsionisDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  MapPin, CheckCircle2, ArrowRight,
  Clock,
} from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function ResepsionisDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const [liveData, logKeluar] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI') as di_luar,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE DATE(waktu_keluar) = ? AND status = 'SUDAH KEMBALI') as sudah_kembali,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE DATE(waktu_keluar) = ?) as total_keluar
    `).bind(today, today).first<any>(),

    // Log keluar komplek hari ini
    db.prepare(`
      SELECT ik.siswa_id, si.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok,
        ik.keterangan, ik.waktu_keluar, ik.waktu_kembali, ik.status
      FROM izin_keluar_komplek ik
      JOIN siswa si ON ik.siswa_id = si.id
      JOIN kelas k ON si.kelas_id = k.id
      WHERE DATE(ik.waktu_keluar) = ?
      ORDER BY ik.created_at DESC LIMIT 10
    `).bind(today).all<any>().then(r => r.results ?? [])
  ])

  const diLuar       = liveData?.di_luar ?? 0
  const sudahKembali = liveData?.sudah_kembali ?? 0
  const totalKeluar  = liveData?.total_keluar ?? 0

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      {/* Live Counter */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border shadow-sm p-4 transition-all ${
          diLuar > 0 ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20' : 'border-surface bg-surface'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`p-1.5 rounded-md ${diLuar > 0 ? 'bg-rose-100 dark:bg-rose-800/50' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <MapPin className={`h-3.5 w-3.5 ${diLuar > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
            </div>
            {diLuar > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
              </span>
            )}
          </div>
          <p className={`text-4xl font-bold tabular-nums ${diLuar > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-700'}`}>
            {diLuar}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Siswa di luar</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Belum kembali ke komplek</p>
        </div>

        <div className="rounded-xl border border-surface bg-surface shadow-sm p-4">
          <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100 w-fit mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className={`text-4xl font-bold tabular-nums ${sudahKembali > 0 ? 'text-emerald-600' : 'text-slate-300 dark:text-slate-700'}`}>
            {sudahKembali}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Sudah kembali</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Dari {totalKeluar} yang keluar</p>
        </div>
      </div>

      {/* Remove Quick Actions */}

      {/* Log Perizinan Hari Ini */}
      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
          <div className="p-1.5 rounded-md bg-sky-50 border border-sky-100">
            <Clock className="h-3.5 w-3.5 text-sky-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Log Perizinan Hari Ini</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{totalKeluar} catatan</p>
          </div>
          <Link href="/dashboard/izin" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
            Semua <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {logKeluar.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-slate-400">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <p className="text-xs">Belum ada yang keluar hari ini</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {logKeluar.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`h-7 w-7 shrink-0 rounded-md flex items-center justify-center ${
                  r.status === 'BELUM KEMBALI'
                    ? 'bg-rose-50 dark:bg-rose-900/30'
                    : 'bg-emerald-50 dark:bg-emerald-900/30'
                }`}>
                  {r.status === 'BELUM KEMBALI'
                    ? <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{r.nama_lengkap}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {r.keterangan || '-'} · Kls {r.tingkat}{r.kelompok ?? ''}-{r.nomor_kelas}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    {r.waktu_keluar ? new Date(r.waktu_keluar).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '-'}
                  </p>
                  <p className={`text-[9px] font-medium ${r.status === 'BELUM KEMBALI' ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {r.status === 'BELUM KEMBALI' ? 'Blm kembali' : (r.waktu_kembali ? new Date(r.waktu_kembali).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : 'Kembali')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
