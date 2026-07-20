// components/dashboard/widgets/RekapKehadiranGuruWidget.tsx
// Widget katalog: rekap kehadiran mengajar guru hari ini (pengisian agenda KBM).
// Bisa ditambahkan ke dashboard manapun lewat pengaturan.
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { getKbmExceptionsForDate, hasActiveTeachingSlotsInRange } from '@/lib/kalender-pendidikan'
import { ClipboardText as ClipboardCheck, ArrowRight, CheckCircle as CheckCircle2, Warning as AlertTriangle } from '@phosphor-icons/react/dist/ssr'
import type { WidgetProps } from '@/lib/dashboard-widgets-meta'

export async function RekapKehadiranGuruWidget({ taAktif }: WidgetProps) {
  const db = await getDB()
  const today = todayWIB()
  const d = new Date(today + 'T00:00:00')
  const hariIni = d.getDay() === 0 ? 7 : d.getDay()

  const taId = taAktif?.id ?? (await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>())?.id

  const rows = taId ? await db.prepare(`
    SELECT
      pm.guru_id,
      u.nama_lengkap,
      MIN(jm.jam_ke) AS jam_mulai,
      MAX(jm.jam_ke) AS jam_selesai,
      k.id AS kelas_id,
      k.tingkat,
      jm.penugasan_id,
      MAX(CASE WHEN ag.id IS NOT NULL THEN 1 ELSE 0 END) AS terisi
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN "user" u ON pm.guru_id = u.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
    GROUP BY jm.penugasan_id, pm.guru_id, u.nama_lengkap, k.id, k.tingkat
  `).bind(today, taId, hariIni, today).all<any>().then(r => r.results ?? []) : []

  const kbmExceptions = await getKbmExceptionsForDate(db, today)
  const active = rows.filter((row: any) => hasActiveTeachingSlotsInRange(
    kbmExceptions,
    { id: row.kelas_id, tingkat: Number(row.tingkat) },
    Number(row.jam_mulai),
    Number(row.jam_selesai)
  ))

  // Agregasi per guru
  const perGuru = new Map<string, { nama: string; total: number; terisi: number }>()
  for (const row of active) {
    const g = perGuru.get(row.guru_id) ?? { nama: row.nama_lengkap, total: 0, terisi: 0 }
    g.total += 1
    if (Number(row.terisi) === 1) g.terisi += 1
    perGuru.set(row.guru_id, g)
  }

  const guruList = Array.from(perGuru.values())
  const totalGuru = guruList.length
  const guruLengkap = guruList.filter(g => g.terisi >= g.total && g.total > 0).length
  const belum = guruList
    .filter(g => g.terisi < g.total)
    .sort((a, b) => (a.total - a.terisi) - (b.total - b.terisi) || a.nama.localeCompare(b.nama))
  const pct = totalGuru > 0 ? Math.round((guruLengkap / totalGuru) * 100) : 0

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        <div className="p-1.5 rounded-md bg-teal-50 border border-teal-100">
          <ClipboardCheck className="h-3.5 w-3.5 text-teal-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Rekap Kehadiran Guru</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Pengisian agenda mengajar hari ini</p>
        </div>
        <Link href="/dashboard/monitoring-agenda" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
          Detail <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="p-4">
        {totalGuru === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">Tidak ada jadwal mengajar hari ini</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xl font-bold text-slate-700 dark:text-slate-200 tabular-nums">{totalGuru}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Guru mengajar</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mb-1" />
                <span className="text-xl font-bold text-emerald-600 tabular-nums">{guruLengkap}</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Lengkap</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <AlertTriangle className="h-4 w-4 text-amber-600 mb-1" />
                <span className="text-xl font-bold text-amber-600 tabular-nums">{belum.length}</span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400">Belum lengkap</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                <span>Guru sudah lengkap mengisi</span>
                <span className="font-medium">{pct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            {belum.length > 0 && (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50 -mx-1">
                {belum.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex items-center gap-2 px-1 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{g.nama}</span>
                    <span className="text-[10px] text-amber-600 font-medium shrink-0">{g.terisi}/{g.total} kelas</span>
                  </div>
                ))}
                {belum.length > 5 && (
                  <p className="px-1 pt-1.5 text-[10px] text-slate-400">+{belum.length - 5} guru lainnya belum lengkap</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
