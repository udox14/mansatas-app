// components/dashboard/KepsekDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { findTeachingBlockException, getKbmExceptionsForDate } from '@/lib/kalender-pendidikan'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'
import {
  ClipboardText as ClipboardCheck, UserGear as UserCog,
  Clipboard as ClipboardList, FileXls as FileSpreadsheet, TrendUp as TrendingUp,
  TrendDown as TrendingDown, ArrowRight, CheckCircle as CheckCircle2, Clock,
} from '@phosphor-icons/react/dist/ssr'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
  isGuruPiket?: boolean
}

export async function KepsekDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif, isGuruPiket }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const d = new Date(today + 'T00:00:00')
  const hariIni = d.getDay() === 0 ? 7 : d.getDay()

  const [taRow, pelanggaran7hari] = await Promise.all([
    db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>(),
    db.prepare(`
      SELECT DATE(tanggal) as tgl, COUNT(*) as cnt
      FROM siswa_pelanggaran
      WHERE tanggal >= date(?, '-6 days')
      GROUP BY DATE(tanggal) ORDER BY tgl
    `).bind(today).all<{ tgl: string; cnt: number }>().then(r => r.results ?? []),
  ])

  // Monitoring agenda: butuh taRow.id
  const taId = taRow?.id
  const agendaRows = taId ? await db.prepare(`
    SELECT
      jm.penugasan_id,
      MIN(jm.jam_ke) as jam_mulai,
      MAX(jm.jam_ke) as jam_selesai,
      k.id as kelas_id,
      k.tingkat,
      ag.id as agenda_id
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
    GROUP BY jm.penugasan_id, k.id, k.tingkat, ag.id
  `).bind(today, taId, hariIni, today).all<any>().then(r => r.results || []) : []

  const kbmExceptions = await getKbmExceptionsForDate(db, today)
  const activeAgendaRows = agendaRows.filter((row: any) => !findTeachingBlockException(
    kbmExceptions,
    { id: row.kelas_id, tingkat: Number(row.tingkat) },
    Number(row.jam_mulai),
    Number(row.jam_selesai)
  ))

  const totalPenugasan = activeAgendaRows.length
  const sudahIsi       = activeAgendaRows.filter((row: any) => !!row.agenda_id).length
  const pctAgenda      = totalPenugasan > 0 ? Math.round((sudahIsi / totalPenugasan) * 100) : 0
  const totalPelanggaran7 = pelanggaran7hari.reduce((s, r) => s + r.cnt, 0)

  // Build a simple 7-day bar chart data
  const maxCnt = Math.max(...pelanggaran7hari.map(r => r.cnt), 1)
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      {/* Penugasan Masuk (jika dia guru piket) */}
      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">

        {/* Monitoring Agenda Hari Ini */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-purple-50 border border-purple-100">
              <ClipboardCheck className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Agenda Guru</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Pengisian jurnal hari ini</p>
            </div>
            <Link href="/dashboard/monitoring-agenda" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-purple-600 tabular-nums">{sudahIsi}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">dari {totalPenugasan} kelas</p>
              </div>
              <span className={`text-xl font-bold tabular-nums ${pctAgenda >= 80 ? 'text-emerald-600' : pctAgenda >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                {pctAgenda}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctAgenda >= 80 ? 'bg-emerald-500' : pctAgenda >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${pctAgenda}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {totalPenugasan === 0 ? 'Tidak ada jadwal mengajar hari ini' :
               pctAgenda >= 80 ? 'Pengisian agenda berjalan baik 👍' :
               'Masih ada guru belum mengisi agenda'}
            </p>
          </div>
        </div>


        {/* Tren Pelanggaran 7 Hari */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden md:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Tren Pelanggaran</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">7 hari terakhir · Total: {totalPelanggaran7}</p>
            </div>
            <Link href="/dashboard/kedisiplinan" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-3">
            {pelanggaran7hari.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-4 text-slate-400">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <p className="text-xs">Tidak ada pelanggaran 7 hari terakhir</p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-16">
                {pelanggaran7hari.map((row, i) => {
                  const pct = Math.round((row.cnt / maxCnt) * 100)
                  const dateObj = new Date(row.tgl + 'T00:00:00')
                  const dayName = dayNames[dateObj.getDay()]
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-rose-500 font-bold tabular-nums">{row.cnt}</span>
                      <div className="w-full flex items-end" style={{ height: 40 }}>
                        <div
                          className="w-full rounded-t bg-rose-400 dark:bg-rose-600 min-h-[4px]"
                          style={{ height: `${Math.max(10, pct)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400">{dayName}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
