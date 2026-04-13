// components/dashboard/KepsekDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  ClipboardCheck, UserCog, Activity, BarChart3,
  ClipboardList, FileSpreadsheet, Star, TrendingUp,
  TrendingDown, ArrowRight, CheckCircle2, Clock,
} from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function KepsekDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const d = new Date(today + 'T00:00:00')
  const hariIni = d.getDay() === 0 ? 7 : d.getDay()

  const [taRow, kehadiranPegawai, pelanggaran7hari] = await Promise.all([
    db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>(),
    db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'hadir' THEN 1 END) as hadir,
        COUNT(CASE WHEN status = 'sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN status = 'izin'  THEN 1 END) as izin,
        COUNT(CASE WHEN status = 'alfa'  THEN 1 END) as alfa,
        COUNT(CASE WHEN is_telat = 1 AND status = 'hadir' THEN 1 END) as telat
      FROM presensi_pegawai WHERE tanggal = ?
    `).bind(today).first<any>(),
    db.prepare(`
      SELECT DATE(tanggal) as tgl, COUNT(*) as cnt
      FROM siswa_pelanggaran
      WHERE tanggal >= date(?, '-6 days')
      GROUP BY DATE(tanggal) ORDER BY tgl
    `).bind(today).all<{ tgl: string; cnt: number }>().then(r => r.results ?? []),
  ])

  // Monitoring agenda: butuh taRow.id
  const taId = taRow?.id
  const agendaData = taId ? await db.prepare(`
    SELECT
      COUNT(DISTINCT jm.penugasan_id) as total_penugasan,
      COUNT(DISTINCT ag.penugasan_id) as sudah_isi
    FROM jadwal_mengajar jm
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
  `).bind(today, taId, hariIni).first<any>() : null

  // Program unggulan terbaru
  const unggulanRaw = await db.prepare(`
    SELECT pu.nama_program, k.tingkat, k.nomor_kelas, k.kelompok
    FROM program_unggulan pu
    JOIN kelas k ON pu.kelas_id = k.id
    ORDER BY pu.created_at DESC LIMIT 3
  `).all<any>().then(r => r.results ?? []).catch(() => [])

  const totalPegawai   = kehadiranPegawai?.total ?? 0
  const hadirPegawai   = kehadiranPegawai?.hadir ?? 0
  const totalPenugasan = agendaData?.total_penugasan ?? 0
  const sudahIsi       = agendaData?.sudah_isi       ?? 0
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

        {/* Kehadiran Pegawai */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-blue-50 border border-blue-100">
              <UserCog className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Kehadiran Pegawai</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{totalPegawai} tercatat hari ini</p>
            </div>
            <Link href="/dashboard/monitoring-presensi" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {totalPegawai === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-6 text-slate-400">
              <Clock className="h-5 w-5" />
              <p className="text-xs">Belum ada data presensi hari ini</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
                {[
                  { label: 'Hadir', val: kehadiranPegawai?.hadir ?? 0, color: 'text-emerald-600' },
                  { label: 'Sakit', val: kehadiranPegawai?.sakit ?? 0, color: 'text-amber-600'   },
                  { label: 'Izin',  val: kehadiranPegawai?.izin  ?? 0, color: 'text-blue-600'    },
                  { label: 'Alfa',  val: kehadiranPegawai?.alfa  ?? 0, color: 'text-rose-600'    },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 py-3">
                    <span className={`text-lg font-bold leading-none tabular-nums ${color}`}>{val}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
              {totalPegawai > 0 && (
                <div className="px-4 py-2 border-t border-surface-2">
                  <p className="text-[10px] text-slate-500">
                    Tingkat kehadiran: <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {Math.round((hadirPegawai / totalPegawai) * 100)}%
                    </span>
                    {(kehadiranPegawai?.telat ?? 0) > 0 && ` · ${kehadiranPegawai.telat} terlambat`}
                  </p>
                </div>
              )}
            </>
          )}
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

      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
