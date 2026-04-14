// components/dashboard/WakamadDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  ClipboardCheck, CalendarCheck, Activity, BarChart3,
  ClipboardList, FileSpreadsheet, ArrowRight, CheckCircle2,
} from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function WakamadDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const d = new Date(today + 'T00:00:00')
  const hariIni = d.getDay() === 0 ? 7 : d.getDay()

  const [taRow, kehadiranSiswa] = await Promise.all([
    db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>(),
    db.prepare(`
      SELECT
        (SELECT COUNT(DISTINCT siswa_id) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) as tidak_masuk,
        (SELECT COUNT(*) FROM siswa WHERE status = 'aktif') as total_siswa
    `).bind(today).first<any>(),
  ])

  const taId = taRow?.id

  const [agendaData] = await Promise.all([
    taId ? db.prepare(`
      SELECT
        COUNT(DISTINCT jm.penugasan_id) as total_penugasan,
        COUNT(DISTINCT ag.penugasan_id) as sudah_isi,
        COUNT(DISTINCT pm.guru_id) as total_guru,
        COUNT(DISTINCT pm2.guru_id) as guru_sudah_isi
      FROM jadwal_mengajar jm
      JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
      LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
      LEFT JOIN penugasan_mengajar pm2 ON pm2.id = ag.penugasan_id
      WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
    `).bind(today, taId, hariIni).first<any>() : Promise.resolve(null)
  ])

  const tidakMasuk     = kehadiranSiswa?.tidak_masuk ?? 0
  const totalSiswa     = kehadiranSiswa?.total_siswa ?? 0
  const hadirSiswaEst  = Math.max(0, totalSiswa - tidakMasuk)
  const totalPenugasan = agendaData?.total_penugasan ?? 0
  const sudahIsi       = agendaData?.sudah_isi ?? 0
  const pctAgenda      = totalPenugasan > 0 ? Math.round((sudahIsi / totalPenugasan) * 100) : 0
  const belumIsi       = totalPenugasan - sudahIsi

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Rekap Agenda Guru */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-cyan-50 border border-cyan-100">
              <ClipboardCheck className="h-3.5 w-3.5 text-cyan-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Agenda Guru Hari Ini</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Status pengisian jurnal</p>
            </div>
            <Link href="/dashboard/monitoring-agenda" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Monitor <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-4">
            {totalPenugasan === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
                Tidak ada jadwal mengajar hari ini
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mb-1" />
                    <span className="text-xl font-bold text-emerald-600 tabular-nums">{sudahIsi}</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Sudah diisi</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <ClipboardCheck className="h-4 w-4 text-amber-600 mb-1" />
                    <span className="text-xl font-bold text-amber-600 tabular-nums">{belumIsi}</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">Belum diisi</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                    <span>Progres pengisian</span>
                    <span className="font-medium">{pctAgenda}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pctAgenda >= 80 ? 'bg-emerald-500' : pctAgenda >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${pctAgenda}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kehadiran Siswa Hari Ini */}
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
              <span className="text-3xl font-bold text-emerald-600 tabular-nums">{hadirSiswaEst}</span>
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
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.round((hadirSiswaEst / totalSiswa) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
