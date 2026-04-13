// components/dashboard/GuruDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { Send, Star, ArrowRight } from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function GuruDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()
  const taId = taAktif?.id

  const [delegasiMasuk, unggulanRaw] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as cnt FROM delegasi_tugas
      WHERE kepada_user_id = ? AND tanggal = ?
    `).bind(userId, today).first<{ cnt: number }>(),

    db.prepare(`
      SELECT pu.nama_program, k.tingkat, k.nomor_kelas, k.kelompok
      FROM program_unggulan pu
      JOIN kelas k ON pu.kelas_id = k.id
      JOIN penugasan_mengajar pm ON pm.kelas_id = k.id AND pm.guru_id = ?
      WHERE pm.tahun_ajaran_id = ?
      GROUP BY pu.id
      LIMIT 3
    `).bind(userId, taId ?? '').all<any>().then(r => r.results ?? []).catch(() => []),
  ])

  const delegasiCnt = delegasiMasuk?.cnt ?? 0

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      {/* Jadwal via Shared Component */}
      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      {/* Penugasan Masuk + Program Unggulan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Delegasi Masuk */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-purple-50 border border-purple-100">
              <Send className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Penugasan Masuk</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Delegasi hari ini</p>
            </div>
            <Link href="/dashboard/penugasan" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Kelola <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5 py-6">
            <span className={`text-4xl font-bold tabular-nums ${delegasiCnt > 0 ? 'text-purple-600' : 'text-slate-300 dark:text-slate-700'}`}>
              {delegasiCnt}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {delegasiCnt > 0 ? 'tugas diterima hari ini' : 'Tidak ada tugas hari ini'}
            </span>
          </div>
        </div>

        {/* Program Unggulan Kelas */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-amber-50 border border-amber-100">
              <Star className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Program Unggulan</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Kelas yang diampu</p>
            </div>
            <Link href="/dashboard/program-unggulan" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Lihat <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {unggulanRaw.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-slate-400">
              <Star className="h-5 w-5" />
              <p className="text-xs">Belum ada program unggulan</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {unggulanRaw.map((u: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <p className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{u.nama_program}</p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">Kls {u.tingkat}{u.kelompok ?? ''}-{u.nomor_kelas}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
