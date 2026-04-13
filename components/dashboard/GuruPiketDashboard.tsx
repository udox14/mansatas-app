// components/dashboard/GuruPiketDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  MapPin, Clock, DoorOpen, AlertTriangle,
  Send, CheckCircle2, ArrowRight, Users, Plus,
} from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function GuruPiketDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const [liveData, logHariIni, delegasiMasuk] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI') as di_luar,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE DATE(waktu_keluar) = ?) as keluar_hari_ini,
        (SELECT COUNT(*) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) as izin_kelas,
        (SELECT COUNT(*) FROM siswa_pelanggaran WHERE tanggal = ?) as pelanggaran_hari_ini
    `).bind(today, today, today).first<any>(),

    // Log izin keluar hari ini
    db.prepare(`
      SELECT ik.siswa_id, si.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok,
        ik.keterangan, ik.waktu_keluar, ik.waktu_kembali, ik.status
      FROM izin_keluar_komplek ik
      JOIN siswa si ON ik.siswa_id = si.id
      JOIN kelas k ON si.kelas_id = k.id
      WHERE DATE(ik.waktu_keluar) = ?
      ORDER BY ik.created_at DESC LIMIT 8
    `).bind(today).all<any>().then(r => r.results ?? []),

    db.prepare(`
      SELECT COUNT(*) as cnt FROM delegasi_tugas
      WHERE kepada_user_id = ? AND tanggal = ?
    `).bind(userId, today).first<{ cnt: number }>(),
  ])

  const diLuar         = liveData?.di_luar ?? 0
  const keluarHariIni  = liveData?.keluar_hari_ini ?? 0
  const izinKelas      = liveData?.izin_kelas ?? 0
  const pelanggaranHariIni = liveData?.pelanggaran_hari_ini ?? 0
  const delegasiCnt    = delegasiMasuk?.cnt ?? 0

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      {/* Live Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Siswa di Luar Komplek */}
        <Link href="/dashboard/izin"
          className={`group rounded-xl border shadow-sm p-4 flex flex-col gap-2 transition-all hover:shadow-md ${
            diLuar > 0 ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20' : 'border-surface bg-surface'
          }`}>
          <div className="flex items-center justify-between">
            <div className={`p-1.5 rounded-md ${diLuar > 0 ? 'bg-rose-100 dark:bg-rose-800/50' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <MapPin className={`h-3.5 w-3.5 ${diLuar > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`} />
            </div>
            {diLuar > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
              </span>
            )}
          </div>
          <div>
            <p className={`text-3xl font-bold tabular-nums ${diLuar > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-700'}`}>
              {diLuar}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Di luar komplek</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Belum kembali</p>
          </div>
        </Link>

        {/* Izin Tidak Masuk Kelas */}
        <Link href="/dashboard/izin"
          className={`group rounded-xl border shadow-sm p-4 flex flex-col gap-2 transition-all hover:shadow-md ${
            izinKelas > 0 ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-surface bg-surface'
          }`}>
          <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-800/30 w-fit border border-amber-100 dark:border-amber-800">
            <DoorOpen className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className={`text-3xl font-bold tabular-nums ${izinKelas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300 dark:text-slate-700'}`}>
              {izinKelas}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Izin tdk masuk kelas</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Hari ini</p>
          </div>
        </Link>
      </div>

      {/* Remove Quick Actions */}

      {/* Log Izin Keluar Hari Ini */}
      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
          <div className="p-1.5 rounded-md bg-orange-50 border border-orange-100">
            <Clock className="h-3.5 w-3.5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Log Keluar Komplek</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{keluarHariIni} catatan hari ini</p>
          </div>
          <Link href="/dashboard/izin" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
            Semua <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {logHariIni.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-slate-400">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <p className="text-xs">Belum ada catatan keluar</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {logHariIni.map((r: any, i: number) => (
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
                    {r.status === 'BELUM KEMBALI' ? 'Di luar' : (r.waktu_kembali ? new Date(r.waktu_kembali).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : 'Kembali')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Penugasan Masuk */}
      {delegasiCnt > 0 && (
        <Link href="/dashboard/penugasan"
          className="flex items-center gap-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
          <div className="p-2 rounded-lg bg-purple-500 shadow-sm">
            <Send className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-purple-800 dark:text-purple-200">Penugasan Masuk hari ini</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">{delegasiCnt} delegasi kelas perlu ditangani</p>
          </div>
          <ArrowRight className="h-4 w-4 text-purple-400 shrink-0" />
        </Link>
      )}

      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
