// components/dashboard/shared/KehadiranPribadiCard.tsx
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { findTeachingBlockException, getEffectiveDatesInRange, getKbmExceptionsForRange, hariNumFromDateString } from '@/lib/kalender-pendidikan'
import { BookOpen, Clock } from '@phosphor-icons/react/dist/ssr'

type Props = { userId: string }
const ATTENDANCE_CUTOFF_START = '2026-05-12'

function BaseCard({ title, subtitle, hadir, sakit, izin, alfa, total, telat, icon: Icon, iconBg, iconColor, telatMsg }: any) {
  const pct = total > 0 ? Math.round((hadir / total) * 100) : null
  const pctColor = pct === null ? 'text-slate-400' : pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-rose-600'

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        <div className={`p-1.5 rounded-md border ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</p>
        </div>
        {pct !== null && (
          <span className={`text-xl font-bold tabular-nums ${pctColor}`}>{pct}%</span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-6">
          <p className="text-xs text-slate-400 dark:text-slate-500">Belum ada data bulan ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
          {[
            { label: 'Hadir', val: hadir, color: 'text-emerald-600' },
            { label: 'Sakit', val: sakit, color: 'text-amber-600'   },
            { label: 'Izin',  val: izin,  color: 'text-blue-600'    },
            { label: 'Alfa',  val: alfa,  color: 'text-rose-600'    },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 py-3">
              <span className={`text-xl font-bold leading-none tabular-nums ${color}`}>{val}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {telat > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-surface-2 bg-amber-50/60 dark:bg-amber-900/10">
          <Clock className="h-3 w-3 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            Terlambat <span className="font-bold">{telat}×</span> {telatMsg || 'bulan ini'}
          </p>
        </div>
      )}
    </div>
  )
}

export async function KehadiranPribadiCard({ userId }: Props) {
  const db = await getDB()
  const today = todayWIB()
  const yearMonth = today.substring(0, 7)
  const monthStart = `${yearMonth}-01`
  const rangeStart = monthStart > ATTENDANCE_CUTOFF_START ? monthStart : ATTENDANCE_CUTOFF_START

  const monthLabel = new Date(yearMonth + '-01').toLocaleDateString('id-ID', {
    month: 'long', year: 'numeric',
  })
  const cutoffLabel = new Date(ATTENDANCE_CUTOFF_START + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Cek role user
  const user = await db.prepare(`
    SELECT role,
    (SELECT GROUP_CONCAT(role) FROM user_roles WHERE user_id = u.id) as secondary_roles
    FROM "user" u WHERE id = ?
  `).bind(userId).first<any>() || {}

  const secRoles = user.secondary_roles ? user.secondary_roles.split(',') : []
  const allRoles = [user.role, ...secRoles].filter(Boolean)
  const isGuru = allRoles.includes('guru')

  // Data Agenda Mengajar (Khusus Guru), dihitung month-to-date.
  // Denominator memakai jadwal efektif, bukan hanya agenda yang sudah tersimpan.
  let dataGuru: any = null
  if (isGuru) {
    const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
    const effectiveDates = ta ? await getEffectiveDatesInRange(db, rangeStart, today) : []

    if (ta && effectiveDates.length > 0) {
      const jadwalRes = await db.prepare(`
        SELECT DISTINCT jm.penugasan_id, jm.hari, jm.jam_ke, k.id as kelas_id, k.tingkat, k.kbm_nonaktif_mulai
        FROM jadwal_mengajar jm
        JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
        JOIN kelas k ON pm.kelas_id = k.id
        WHERE jm.tahun_ajaran_id = ? AND pm.guru_id = ?
      `).bind(ta.id, userId).all<any>()

      const jadwalHari = new Map<string, { hariMap: Map<number, Set<number>>; kelasId: string; tingkat: number; kbmNonaktifMulai: string | null }>()
      for (const row of jadwalRes.results || []) {
        if (!jadwalHari.has(row.penugasan_id)) {
          jadwalHari.set(row.penugasan_id, {
            hariMap: new Map(),
            kelasId: row.kelas_id,
            tingkat: Number(row.tingkat),
            kbmNonaktifMulai: row.kbm_nonaktif_mulai || null,
          })
        }
        const jadwal = jadwalHari.get(row.penugasan_id)!
        if (!jadwal.hariMap.has(Number(row.hari))) jadwal.hariMap.set(Number(row.hari), new Set())
        jadwal.hariMap.get(Number(row.hari))!.add(Number(row.jam_ke))
      }

      const exceptionsByDate = new Map<string, Awaited<ReturnType<typeof getKbmExceptionsForRange>>>()
      for (const exception of await getKbmExceptionsForRange(db, rangeStart, today)) {
        if (!exceptionsByDate.has(exception.tanggal)) exceptionsByDate.set(exception.tanggal, [])
        exceptionsByDate.get(exception.tanggal)!.push(exception)
      }

      let totalBlok = 0
      for (const tanggal of effectiveDates) {
        const hari = hariNumFromDateString(tanggal)
        for (const jadwal of jadwalHari.values()) {
          if (jadwal.kbmNonaktifMulai && jadwal.kbmNonaktifMulai <= tanggal) continue
          const jamSet = jadwal.hariMap.get(hari)
          if (!jamSet) continue
          const jamList = Array.from(jamSet).sort((a, b) => a - b)
          if (findTeachingBlockException(exceptionsByDate.get(tanggal) || [], { id: jadwal.kelasId, tingkat: jadwal.tingkat }, jamList[0], jamList[jamList.length - 1])) continue
          totalBlok++
        }
      }

      const agendaRes = await db.prepare(`
        SELECT status, COUNT(*) as cnt
        FROM agenda_guru
        WHERE guru_id = ?
          AND tanggal BETWEEN ? AND ?
          AND tanggal IN (${effectiveDates.map(() => '?').join(',')})
        GROUP BY status
      `).bind(userId, rangeStart, today, ...effectiveDates).all<any>()

      const counts = { hadir: 0, sakit: 0, izin: 0, alfa: 0, telat: 0 }
      for (const row of agendaRes.results || []) {
        const cnt = Number(row.cnt) || 0
        if (row.status === 'TEPAT_WAKTU') counts.hadir += cnt
        else if (row.status === 'TELAT') {
          counts.hadir += cnt
          counts.telat += cnt
        } else if (row.status === 'SAKIT') counts.sakit += cnt
        else if (row.status === 'IZIN') counts.izin += cnt
        else if (row.status === 'ALFA') counts.alfa += cnt
      }

      const tercatat = counts.hadir + counts.sakit + counts.izin + counts.alfa
      const alfaBelumIsi = Math.max(0, totalBlok - tercatat)

      dataGuru = {
        hadir: counts.hadir,
        sakit: counts.sakit,
        izin: counts.izin,
        alfa: counts.alfa + alfaBelumIsi,
        total: Math.max(totalBlok, tercatat),
        telat: counts.telat,
      }
    } else {
      dataGuru = { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0, telat: 0 }
    }
  }

  if (!isGuru) return null

  return (
    <div className="flex flex-col gap-4">
      <BaseCard
        title="Performa Kehadiran"
        subtitle={monthStart < ATTENDANCE_CUTOFF_START ? `${cutoffLabel} sampai hari ini` : `${monthLabel} sampai hari ini`}
        hadir={dataGuru?.hadir ?? 0}
        sakit={dataGuru?.sakit ?? 0}
        izin={dataGuru?.izin ?? 0}
        alfa={dataGuru?.alfa ?? 0}
        total={dataGuru?.total ?? 0}
        telat={dataGuru?.telat ?? 0}
        icon={BookOpen}
        iconBg="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"
        iconColor="text-emerald-600 dark:text-emerald-400"
        telatMsg="sesi mengajar bulan ini"
      />
    </div>
  )
}
