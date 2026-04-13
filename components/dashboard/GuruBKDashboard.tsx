// components/dashboard/GuruBKDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  HeartHandshake, AlertTriangle, DoorOpen, Brain,
  Users, TrendingDown, ArrowRight, CheckCircle2, Shield,
} from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function GuruBKDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const [siswaProblematik, kasusHariIni, izinHariIni, trenPelanggaran] = await Promise.all([
    // Top 5 siswa dengan poin tertinggi
    db.prepare(`
      SELECT sp.siswa_id, si.nama_lengkap,
        k.tingkat, k.nomor_kelas, k.kelompok,
        SUM(mp.poin) as total_poin, COUNT(*) as jumlah_kasus
      FROM siswa_pelanggaran sp
      JOIN siswa si ON sp.siswa_id = si.id
      JOIN kelas k ON si.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      GROUP BY sp.siswa_id
      ORDER BY total_poin DESC LIMIT 5
    `).all<any>().then(r => r.results ?? []),

    // Kasus pelanggaran terbaru (5)
    db.prepare(`
      SELECT sp.tanggal, si.nama_lengkap, mp.nama_pelanggaran, mp.poin,
        k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa_pelanggaran sp
      JOIN siswa si ON sp.siswa_id = si.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      JOIN kelas k ON si.kelas_id = k.id
      ORDER BY sp.created_at DESC LIMIT 5
    `).all<any>().then(r => r.results ?? []),

    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI') as belum_kembali,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE DATE(waktu_keluar) = ?) as keluar,
        (SELECT COUNT(*) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) as tidak_masuk
    `).bind(today, today).first<any>(),

    // Tren pelanggaran per jenis 30 hari terakhir (top 5 jenis)
    db.prepare(`
      SELECT mp.nama_pelanggaran, COUNT(*) as cnt
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tanggal >= date(?, '-29 days')
      GROUP BY mp.id ORDER BY cnt DESC LIMIT 5
    `).bind(today).all<any>().then(r => r.results ?? []),
  ])

  const totalProblematik = siswaProblematik.length
  const keluar         = izinHariIni?.keluar ?? 0
  const tidakMasuk     = izinHariIni?.tidak_masuk ?? 0
  const belumKembali   = izinHariIni?.belum_kembali ?? 0
  const maxCnt         = Math.max(...trenPelanggaran.map((t: any) => t.cnt), 1)

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      {/* Summary Hari Ini */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-surface bg-surface shadow-sm p-4 flex flex-col gap-2">
          <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100 w-fit">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-rose-600 tabular-nums">{totalProblematik}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Siswa bermasalah</p>
          </div>
        </div>
        <div className="rounded-xl border border-surface bg-surface shadow-sm p-4 flex flex-col gap-2">
          <div className="p-1.5 rounded-md bg-amber-50 border border-amber-100 w-fit">
            <DoorOpen className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600 tabular-nums">{tidakMasuk}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Izin tdk masuk</p>
          </div>
        </div>
        <div className="rounded-xl border border-surface bg-surface shadow-sm p-4 flex flex-col gap-2">
          <div className="p-1.5 rounded-md bg-orange-50 border border-orange-100 w-fit">
            <Users className="h-3.5 w-3.5 text-orange-600" />
          </div>
          <div>
            <p className={`text-2xl font-bold tabular-nums ${belumKembali > 0 ? 'text-orange-600' : 'text-slate-300 dark:text-slate-700'}`}>
              {belumKembali}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Blm kembali</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Siswa Prioritas */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
              <Shield className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Siswa Prioritas</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Poin pelanggaran tertinggi</p>
            </div>
            <Link href="/dashboard/kedisiplinan" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {siswaProblematik.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6 text-slate-400">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-xs">Tidak ada siswa bermasalah saat ini</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {siswaProblematik.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-[11px] font-bold ${
                    i === 0 ? 'bg-rose-100 text-rose-600' : i === 1 ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Kls {s.tingkat}{s.kelompok ?? ''}-{s.nomor_kelas} · {s.jumlah_kasus}× kasus
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-rose-500 shrink-0">+{s.total_poin}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kasus Terbaru */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Kasus Terbaru</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">5 pelanggaran terakhir</p>
            </div>
          </div>
          {kasusHariIni.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6 text-slate-400">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-xs">Belum ada catatan pelanggaran</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {kasusHariIni.map((k: any, i: number) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="h-7 w-7 shrink-0 rounded-md bg-rose-50 dark:bg-rose-900/30 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-rose-500 leading-none">+{k.poin}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{k.nama_lengkap}</p>
                    <p className="text-[10px] text-rose-500 truncate">{k.nama_pelanggaran}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                    {new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tren Pelanggaran per Jenis */}
      {trenPelanggaran.length > 0 && (
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Jenis Pelanggaran Terbanyak</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">30 hari terakhir</p>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {trenPelanggaran.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 w-4 text-center">{i + 1}</span>
                <p className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate min-w-0">{t.nama_pelanggaran}</p>
                <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-rose-400 dark:bg-rose-600 rounded-full"
                    style={{ width: `${Math.round((t.cnt / maxCnt) * 100)}%` }} />
                </div>
                <span className="text-[10px] font-bold text-rose-500 shrink-0 w-6 text-right">{t.cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
