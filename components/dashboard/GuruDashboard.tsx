// components/dashboard/GuruDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { Send, ArrowRight } from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function GuruDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()
  const taId = taAktif?.id

  const [delegasiMasuk] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as cnt FROM delegasi_tugas
      WHERE kepada_user_id = ? AND tanggal = ?
    `).bind(userId, today).first<{ cnt: number }>()
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

      </div>

      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
