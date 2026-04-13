// components/dashboard/shared/JadwalMengajarToday.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { ClipboardPen, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react'

type Props = {
  userId: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function JadwalMengajarToday({ userId, taAktif }: Props) {
  if (!taAktif?.id) return null

  const db = await getDB()
  
  // Cek apakah user punya penugasan mengajar
  const isGuru = await db.prepare('SELECT id FROM penugasan_mengajar WHERE guru_id = ? AND tahun_ajaran_id = ? LIMIT 1')
    .bind(userId, taAktif.id).first()

  if (!isGuru) return null

  const today = todayWIB()
  const d = new Date(today + 'T00:00:00')
  const hariIni = d.getDay() === 0 ? 7 : d.getDay()

  const taRow = await db.prepare('SELECT jam_pelajaran FROM tahun_ajaran WHERE id = ?').bind(taAktif.id).first<any>()
  
  const jadwalRows = await db.prepare(`
    SELECT
      MIN(jm.jam_ke) as jam_mulai, MAX(jm.jam_ke) as jam_selesai,
      jm.penugasan_id,
      mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok,
      ag.id as agenda_id
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ? AND pm.guru_id = ?
    GROUP BY jm.penugasan_id, mp.nama_mapel, k.tingkat, k.nomor_kelas, k.kelompok, ag.id
    ORDER BY jam_mulai ASC
  `).bind(today, taAktif.id, hariIni, userId).all<any>().then(r => r.results ?? [])

  // Parse jam dari pola jam pelajaran
  let slotsMap: Record<number, { mulai: string; selesai: string }> = {}
  try {
    const pola = JSON.parse(taRow?.jam_pelajaran || '[]')
    const hari = pola.find((p: any) => p.hari?.includes(hariIni))
    if (hari?.slots) {
      for (const s of hari.slots) {
        slotsMap[s.id] = { mulai: s.mulai, selesai: s.selesai }
      }
    }
  } catch {}

  const totalJadwal = jadwalRows.length
  const sudahIsiAgenda = jadwalRows.filter((j: any) => !!j.agenda_id).length
  const belumIsi = totalJadwal - sudahIsiAgenda

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden mb-3">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
          <ClipboardPen className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Jadwal Mengajar Hari Ini</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {totalJadwal === 0 ? 'Tidak ada jadwal hari ini' : `${totalJadwal} kelas · ${sudahIsiAgenda} agenda terisi`}
          </p>
        </div>
        {totalJadwal > 0 && (
          <Link href="/dashboard/agenda"
            className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 rounded-md transition-colors"
          >
            <ClipboardPen className="h-3 w-3" />
            Isi Jurnal
          </Link>
        )}
      </div>

      {totalJadwal === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-7 text-slate-400">
          <BookOpen className="h-6 w-6" />
          <p className="text-xs">Tidak ada jadwal mengajar hari ini</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
          {jadwalRows.map((j: any, i: number) => {
            const slotMulai   = slotsMap[j.jam_mulai]?.mulai   ?? '-'
            const slotSelesai = slotsMap[j.jam_selesai]?.selesai ?? '-'
            const filled = !!j.agenda_id
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${filled ? '' : 'bg-amber-50/30 dark:bg-amber-900/10'}`}>
                <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${filled ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
                  {filled
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <AlertCircle className="h-4 w-4 text-amber-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{j.nama_mapel}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Kelas {j.tingkat}{j.kelompok ?? ''}-{j.nomor_kelas}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{slotMulai}–{slotSelesai}</p>
                  <p className={`text-[9px] font-medium ${filled ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {filled ? 'Terisi' : 'Belum isi'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {belumIsi > 0 && (
        <div className="px-4 py-2 border-t border-amber-100 bg-amber-50/60 dark:bg-amber-900/10">
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            ⚠ {belumIsi} agenda belum terisi — segera isi sebelum berakhir hari ini!
          </p>
        </div>
      )}
    </div>
  )
}
